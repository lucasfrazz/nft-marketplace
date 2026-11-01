import { expect, test, type Page } from '@playwright/test'
import { addFromDetail, login, open } from './support'

/**
 * Regressão visual com dados estáveis (fixtures determinísticas, latência 0,
 * animações desativadas). Baselines versionadas em e2e/__screenshots__.
 */
const shot = async (page: Page, name: string) => {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    mask: [page.getByTestId('mock-lab-open')],
  })
}

test.describe('Regressão visual @visual', () => {
  test('início', async ({ page }) => {
    await open(page, '/')
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    await shot(page, 'inicio')
  })

  test('detalhe', async ({ page }) => {
    await open(page, '/nft/emerald-ape-042')
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    await shot(page, 'detalhe')
  })

  test('carrinho', async ({ page }) => {
    await open(page, '/')
    await addFromDetail(page, 'emerald-ape-042', { qty: 2 })
    await addFromDetail(page, 'violet-nomad-314')
    await expect(page.getByTestId('summary-total')).toBeVisible()
    await shot(page, 'carrinho')
  })

  test('pagamento', async ({ page }) => {
    await open(page, '/')
    await login(page)
    await addFromDetail(page, 'emerald-ape-042')
    await page.goto('/pagamento')
    await expect(page.getByTestId('summary-total')).toBeVisible()
    await shot(page, 'pagamento')
  })
})
