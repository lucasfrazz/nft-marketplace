import { expect, test } from '@playwright/test'
import { addFromDetail, login, mock, open } from './support'

const emeraldPrice = (page: import('@playwright/test').Page) => page.getByTestId('nft-card').filter({ hasText: 'Emerald Ape #042' }).getByTestId('nft-price')

test.describe('Eventos em tempo real', () => {
  test('duplicatas e eventos antigos não regridem o estado', async ({ page }) => {
    await open(page, '/')
    await expect(emeraldPrice(page)).toContainText('1.19 ETH')
    await expect.poll(() => mock.connections(page)).toBeGreaterThan(0)

    const evt = await mock.updateNft(page, 'emerald-ape-042', { price: '1.50' })
    await expect(emeraldPrice(page)).toContainText('1.50 ETH')

    // Duplicata (mesmo id) e evento antigo (versão menor) chegam pelo socket
    await mock.run(page, () => window.__kurioMock!.replayLast('nft.updated'))
    const stale = { ...evt, id: 'evt_antigo', version: evt.version - 1, data: { ...evt.data, price: '0.10', editions: evt.data.editions.map((e) => ({ ...e, price: '0.10' })) } }
    await page.evaluate((e) => window.__kurioMock!.emitRaw('nft.updated', e), stale)
    await page.waitForTimeout(500)
    await expect(emeraldPrice(page)).toContainText('1.50 ETH')
  })

  test('reconexão reconcilia com a API REST', async ({ page }) => {
    await open(page, '/')
    await expect(emeraldPrice(page)).toContainText('1.19 ETH')
    await expect.poll(() => mock.connections(page)).toBeGreaterThan(0)
    // Mudança SEM evento (perdida enquanto desconectado)
    await mock.run(page, () => {
      const db = window.__kurioMock!.snapshot()
      const n = db.nfts.find((x) => x.id === 'emerald-ape-042')!
      n.price = '2.22'
      n.editions.find((e) => e.id === '1-50')!.price = '2.22'
      n.version++
      window.__kurioMock!.dropConnections()
    })
    await expect(emeraldPrice(page)).toContainText('2.22 ETH', { timeout: 10_000 })
  })

  test('pedido pendente é retomado após queda de conexão e refresh', async ({ page }) => {
    await open(page, '/', { scenarios: ['manual-settlement'] })
    await login(page)
    await addFromDetail(page, 'golden-signal-160')
    await page.getByTestId('go-checkout').click()
    await page.getByTestId('wallet-connect').click()
    await expect(page.getByTestId('wallet-status')).toContainText('Conectada')
    await page.getByTestId('confirm-purchase').click()
    await page.getByTestId('place-order').click()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    const url = page.url()

    // Refresh: o pedido pendente é recuperado (sem nova compra)
    await page.reload()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    await page.goto('/pagamento')
    await expect(page.getByTestId('pending-order-banner')).toBeVisible()
    await expect(page.getByTestId('confirm-purchase')).toBeDisabled()
    await page.goto(url)

    // Liquidação acontece enquanto o socket está caído → reconciliação ao reconectar
    const [order] = await mock.orders(page)
    await page.evaluate((id) => {
      window.__kurioMock!.dropConnections()
      window.__kurioMock!.settleOrder(id, 'confirmed')
    }, order.id)
    await expect(page.getByTestId('receipt')).toBeVisible({ timeout: 10_000 })
    expect(await mock.orders(page)).toHaveLength(1)

    // Estado terminal: um evento antigo "pending" não regride
    await page.evaluate(
      (o) => window.__kurioMock!.emitRaw('order.updated', { id: 'evt_velho', type: 'order.updated', resource: { type: 'order', id: o.id }, version: 1, occurredAt: o.createdAt, userId: o.userId, data: { status: 'pending', order: { ...o, status: 'pending' } } } as never),
      order,
    )
    await page.waitForTimeout(400)
    await expect(page.getByTestId('receipt')).toBeVisible()
  })

  test('eventos de pedido de outro usuário são ignorados', async ({ page }) => {
    await open(page, '/')
    await login(page)
    await page.evaluate(() =>
      window.__kurioMock!.emitRaw('order.updated', { id: 'evt_x', type: 'order.updated', resource: { type: 'order', id: 'ord_de_outro' }, version: 9, occurredAt: new Date().toISOString(), userId: 'u_bruno', data: { status: 'confirmed', order: {} } } as never),
    )
    await page.waitForTimeout(400)
    await expect(page.getByTestId('live-region')).not.toContainText('Pagamento confirmado')
  })
})
