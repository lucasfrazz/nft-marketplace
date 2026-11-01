import { expect, test } from '@playwright/test'
import { addFromDetail, login, open } from './support'

test.describe('Carrinho', () => {
  test('quantidades, limite, remoção e cupom @main', async ({ page }) => {
    await open(page, '/')
    await addFromDetail(page, 'emerald-ape-042')
    await addFromDetail(page, 'golden-beat-207')
    await expect(page.getByTestId('summary-subtotal')).toHaveText('2.18 ETH')

    const isMobile = (page.viewportSize()?.width ?? 1440) < 768
    const row = isMobile ? page.getByTestId('cart-card').filter({ hasText: 'Emerald Ape' }) : page.getByTestId('cart-row').filter({ hasText: 'Emerald Ape' })
    await row.getByRole('button', { name: /Aumentar quantidade/ }).click()
    await expect(row.getByTestId('qty-value')).toHaveText('2')
    await expect(page.getByTestId('summary-subtotal')).toHaveText('3.37 ETH')

    // Cupom inválido, expirado e válido
    const coupon = page.getByTestId('coupon-input').filter({ visible: true })
    const apply = page.getByTestId('coupon-apply').filter({ visible: true })
    await coupon.fill('NAOEXISTE')
    await apply.click()
    await expect(page.getByTestId('coupon-error').filter({ visible: true })).toHaveText('Cupom inválido.')
    await coupon.fill('VERAO2025')
    await apply.click()
    await expect(page.getByTestId('coupon-error').filter({ visible: true })).toHaveText('Este cupom expirou.')
    await coupon.fill('kurio10')
    await apply.click()
    await expect(page.getByTestId('coupon-applied').filter({ visible: true })).toContainText('KURIO10')
    await expect(page.getByTestId('summary-discount')).toHaveText('(-) 0.337')
    await expect(page.getByTestId('summary-total')).toHaveText('3.049 ETH') // 3.37 - 0.337 + 0.016

    await page.getByTestId('coupon-remove').filter({ visible: true }).click()
    await expect(page.getByTestId('summary-discount')).toHaveText('(-) 00.00')

    // Remoção
    const golden = isMobile ? page.getByTestId('cart-card').filter({ hasText: 'Golden Beat' }) : page.getByTestId('cart-row').filter({ hasText: 'Golden Beat' })
    await golden.getByRole('button', { name: /Remover Golden Beat/ }).click()
    await expect(golden).toHaveCount(0)
    await expect(page.getByTestId('summary-subtotal')).toHaveText('2.38 ETH')
  })

  test('limite por edição no carrinho', async ({ page }) => {
    await open(page, '/')
    await addFromDetail(page, 'emerald-ape-042', { edition: '1-10', qty: 3 })
    const row = page.getByTestId('cart-row').first()
    await expect(row.getByRole('button', { name: /Aumentar quantidade/ })).toBeDisabled()
  })

  test('persiste após refresh e é preservado ao autenticar', async ({ page }) => {
    await open(page, '/')
    await addFromDetail(page, 'violet-nomad-314', { qty: 2 })
    await page.reload()
    await expect(page.getByTestId('cart-row')).toContainText('Violet Nomad #314')
    await login(page)
    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-row')).toContainText('Violet Nomad #314')
    await expect(page.getByTestId('cart-row').getByTestId('qty-value')).toHaveText('2')
    await expect(page.getByTestId('header-cart')).toContainText('2')
  })
})
