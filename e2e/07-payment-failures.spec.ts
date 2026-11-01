import { expect, test, type Page } from '@playwright/test'
import { addFromDetail, login, mock, open } from './support'

async function toReview(page: Page, scenarios: string[] = [], settle = 400) {
  await open(page, '/', { scenarios, settle })
  await login(page)
  await addFromDetail(page, 'cosmic-bloom-118')
  await page.getByTestId('go-checkout').click()
  await page.getByTestId('wallet-connect').click()
  await expect(page.getByTestId('wallet-status')).toContainText('Conectada')
  await page.getByTestId('confirm-purchase').click()
  await expect(page.getByTestId('review-dialog')).toBeVisible()
}

test.describe('Falhas de pagamento e idempotência', () => {
  test('pagamento recusado preserva os itens no carrinho', async ({ page }) => {
    await toReview(page, ['payment-declined'])
    await page.getByTestId('place-order').click()
    await expect(page.getByTestId('order-declined')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
    await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(page.getByTestId('cart-row')).toContainText('Cosmic Bloom #118')
    // Pedido recusado é terminal
    const orders = await mock.orders(page)
    expect(orders.map((o) => o.status)).toEqual(['declined'])
  })

  test('cliques repetidos não duplicam o pedido', async ({ page }) => {
    await toReview(page)
    // 3 cliques no mesmo tick (antes de o React desabilitar o botão)
    await page.evaluate(() => {
      const b = document.querySelector<HTMLButtonElement>('[data-testid=place-order]')!
      b.click()
      b.click()
      b.click()
    })
    await expect(page.getByTestId('receipt')).toBeVisible({ timeout: 10_000 })
    expect(await mock.orders(page)).toHaveLength(1)
  })

  test('timeout após criação recupera o mesmo pedido pela chave de idempotência', async ({ page }) => {
    test.setTimeout(60_000)
    await toReview(page, ['order-timeout'])
    await page.getByTestId('place-order').click()
    // 1ª resposta excede o timeout do cliente (6s); o reenvio com a mesma chave recupera o pedido.
    await expect(page).toHaveURL(/\/pedidos\/ord_/, { timeout: 20_000 })
    await expect(page.getByTestId('order-pending')).toBeVisible()
    const orders = await mock.orders(page)
    expect(orders).toHaveLength(1)
    // Refresh durante o pendente: o estado é recuperado
    await page.reload()
    await expect(page.getByTestId('order-pending').or(page.getByTestId('receipt'))).toBeVisible()
    await expect(page.getByTestId('receipt')).toBeVisible({ timeout: 25_000 })
    expect(await mock.orders(page)).toHaveLength(1)
  })

  test('recusa e desconexão da carteira', async ({ page }) => {
    await open(page, '/', { scenarios: ['wallet-reject'] })
    await login(page)
    await addFromDetail(page, 'cosmic-bloom-118')
    await page.getByTestId('go-checkout').click()
    await page.getByTestId('wallet-connect').click()
    await expect(page.getByTestId('wallet-error')).toContainText('recusada')
    await expect(page.getByTestId('wallet-status')).toContainText('Desconectada')
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByTestId('checkout-banner')).toContainText('Conecte sua carteira')
    await page.getByTestId('wallet-connect').click()
    await expect(page.getByTestId('wallet-status')).toContainText('Conectada')
    await page.getByTestId('wallet-disconnect').click()
    await expect(page.getByTestId('wallet-status')).toContainText('Desconectada')
  })
})
