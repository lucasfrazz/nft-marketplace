import { expect, test } from '@playwright/test'
import { addFromDetail, isMobile, login, mock, open } from './support'

test.describe('Compra completa @main', () => {
  test('do catálogo ao recibo confirmado', async ({ page }) => {
    await open(page, '/', { settle: 800 })

    // Catálogo → detalhe
    await page.getByTestId('nft-card-link').filter({ hasText: 'Violet Nomad #314' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Violet Nomad #314' })).toBeVisible()

    // Detalhe → carrinho (2 unidades da edição 1/50)
    await addFromDetail(page, 'violet-nomad-314', { qty: 2 })
    await expect(page.getByTestId('summary-subtotal')).toHaveText('2.78 ETH')
    await expect(page.getByTestId('summary-total')).toHaveText('2.796 ETH')

    // Checkout exige login e retoma o fluxo
    await page.getByTestId('go-checkout').click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpagamento/)
    await page.getByTestId('login-email').fill('ana@kurio.dev')
    await page.getByTestId('login-password').fill('Kurio@123')
    await page.getByTestId('login-submit').click()
    await expect(page).toHaveURL(/\/pagamento$/)

    // Carrinho do visitante preservado após autenticar
    await expect(page.getByTestId('checkout-lines')).toContainText('Violet Nomad #314')
    await expect(page.getByTestId('checkout-lines')).toContainText('(x 2)')

    // Conecta a carteira e revisa
    await page.getByTestId('wallet-connect').click()
    await expect(page.getByTestId('wallet-status')).toContainText('Conectada')
    await page.getByTestId('confirm-purchase').click()
    const review = page.getByTestId('review-dialog')
    await expect(review).toBeVisible()
    await expect(review).toContainText('2.796 ETH')
    await review.getByTestId('place-order').click()

    // Pendente → confirmado (evento order.updated via Socket.IO)
    await expect(page).toHaveURL(/\/pedidos\/ord_/)
    await expect(page.getByTestId('receipt')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('receipt-total')).toHaveText('2.796 ETH')
    await expect(page.getByTestId('receipt')).toContainText('Violet Nomad #314')
    await expect(page.getByTestId('tx-id')).toHaveText(/^0x/)

    // Itens comprados removidos do carrinho
    if (isMobile(page)) await page.goto('/carrinho')
    else await page.getByTestId('header-cart').click()
    await expect(page.getByTestId('empty-state')).toContainText('Seu carrinho está vazio')

    const orders = await mock.orders(page)
    expect(orders).toHaveLength(1)
    expect(orders[0].status).toBe('confirmed')
  })

  test('recibo preserva o snapshot mesmo após mudança no catálogo', async ({ page }) => {
    await open(page, '/', { settle: 300 })
    await login(page)
    await addFromDetail(page, 'golden-signal-160')
    await page.getByTestId('go-checkout').click()
    await page.getByTestId('wallet-connect').click()
    await expect(page.getByTestId('wallet-status')).toContainText('Conectada')
    await page.getByTestId('confirm-purchase').click()
    await page.getByTestId('place-order').click()
    await expect(page.getByTestId('receipt')).toBeVisible({ timeout: 10_000 })
    await mock.updateNft(page, 'golden-signal-160', { price: '9.99' })
    await page.reload()
    await expect(page.getByTestId('receipt')).toContainText('0.39 ETH')
    await expect(page.getByTestId('receipt')).not.toContainText('9.99')
  })
})
