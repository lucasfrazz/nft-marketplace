import { expect, test } from '@playwright/test'
import { open } from './support'

test.describe('Detalhe do NFT', () => {
  test('acesso direto e edição selecionada pela URL @main', async ({ page }) => {
    await open(page, '/nft/emerald-ape-042?edition=1-10')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page.getByTestId('edition-1-10')).toHaveAttribute('aria-checked', 'true')
  })

  test('NFT inexistente e rota inexistente', async ({ page }) => {
    await open(page, '/nft/nao-existe-999')
    await expect(page.getByTestId('not-found')).toContainText('NFT não encontrado')
    await page.goto('/qualquer/rota/que/nao/existe')
    await expect(page.getByTestId('not-found')).toContainText('Página não encontrada')
  })

  test('edição esgotada fica indisponível', async ({ page }) => {
    await open(page, '/nft/neon-vessel-552')
    const soldOut = page.getByTestId('edition-1-1')
    await expect(soldOut).toHaveAttribute('aria-disabled', 'true')
    await soldOut.click({ force: true })
    await expect(soldOut).toHaveAttribute('aria-checked', 'false')
    await page.goto('/nft/neon-vessel-552?edition=1-1')
    await expect(page.getByTestId('edition-availability')).toContainText('esgotada')
    await expect(page.getByTestId('buy')).toBeDisabled()
  })

  test('limite de quantidade por edição', async ({ page }) => {
    await open(page, '/nft/emerald-ape-042?edition=1-10')
    const plus = page.getByRole('button', { name: /Aumentar quantidade/ }).first()
    for (let i = 0; i < 5; i++) if (await plus.isEnabled()) await plus.click()
    await expect(page.getByTestId('qty-value').first()).toHaveText('3')
    await expect(plus).toBeDisabled()
    await expect(page.getByTestId('edition-availability')).toContainText('máximo de 3 por pedido')
  })
})
