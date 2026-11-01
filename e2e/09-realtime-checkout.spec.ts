import { expect, test, type Page } from '@playwright/test'
import { addFromDetail, login, mock, open } from './support'

async function checkoutWithEmerald(page: Page, scenarios: string[] = []) {
  await open(page, '/', { scenarios, settle: 400 })
  await login(page)
  await addFromDetail(page, 'emerald-ape-042')
  await page.getByTestId('go-checkout').click()
  await page.getByTestId('wallet-connect').click()
  await expect(page.getByTestId('wallet-status')).toContainText('Conectada')
  await expect(page.getByTestId('summary-total')).toHaveText('1.206 ETH')
}

test.describe('Tempo real durante o checkout (Socket.IO)', () => {
  test('alteração de preço exige nova confirmação @main', async ({ page }) => {
    await checkoutWithEmerald(page)
    // Evento emitido pelo servidor simulado → socket.io-client → cache
    await mock.updateNft(page, 'emerald-ape-042', { price: '1.49' })
    await expect(page.getByTestId('quote-issues')).toContainText('1.49 ETH')
    await expect(page.getByTestId('live-region')).toContainText('mudou de 1.19 ETH para 1.49 ETH')
    await expect(page.getByTestId('confirm-purchase')).toBeDisabled()

    await page.getByTestId('accept-changes').click()
    await expect(page.getByTestId('quote-issues')).toHaveCount(0)
    await expect(page.getByTestId('summary-total')).toHaveText('1.506 ETH')
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByTestId('review-dialog')).toContainText('1.506 ETH')
    await page.getByTestId('place-order').click()
    await expect(page.getByTestId('receipt-total')).toHaveText('1.506 ETH', { timeout: 10_000 })
  })

  test('edição esgotada durante a navegação bloqueia o checkout', async ({ page }) => {
    await checkoutWithEmerald(page)
    await mock.updateNft(page, 'emerald-ape-042', { available: 0 })
    await expect(page.getByTestId('quote-issues')).toContainText('esgotada')
    await expect(page.getByTestId('confirm-purchase')).toBeDisabled()
  })

  test('mudança no envio (servidor) devolve cotação nova e exige reconfirmação', async ({ page }) => {
    await checkoutWithEmerald(page, ['price-change-at-checkout'])
    await page.getByTestId('confirm-purchase').click()
    await page.getByTestId('place-order').click()
    await expect(page.getByTestId('checkout-banner')).toContainText('mudaram')
    await expect(page.getByTestId('review-dialog')).toBeHidden()
    await expect(page.getByTestId('confirm-purchase')).toBeDisabled()
    expect(await mock.orders(page)).toHaveLength(0)
    await page.getByTestId('accept-changes').click()
    await expect(page.getByTestId('summary-total')).toHaveText('1.256 ETH')
  })

  test('alteração de preço com o carrinho aberto atualiza o resumo', async ({ page }) => {
    await open(page, '/')
    await addFromDetail(page, 'golden-beat-207', { qty: 2 })
    await expect(page.getByTestId('summary-subtotal')).toHaveText('1.98 ETH')
    await mock.updateNft(page, 'golden-beat-207', { price: '0.89' })
    await expect(page.getByTestId('quote-issues')).toContainText('0.89 ETH')
    await expect(page.getByTestId('summary-subtotal')).toHaveText('1.78 ETH')
    await expect(page.getByTestId('go-checkout')).toBeDisabled()
  })
})
