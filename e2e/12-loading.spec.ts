import { expect, test } from '@playwright/test'
import { mock, open } from './support'

test.describe('Carregamento, falha e recuperação', () => {
  test('skeletons com rede lenta (relógio controlado)', async ({ page }) => {
    await page.clock.install()
    await open(page, '/', { latency: 'slow' })
    await expect(page.getByTestId('nft-card-skeleton').first()).toBeVisible()
    await expect(page.getByTestId('nft-card-skeleton')).toHaveCount(9)
    await page.clock.runFor(3_000)
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    await expect(page.getByTestId('nft-card-skeleton')).toHaveCount(0)

    await page.goto('/nft/emerald-ape-042')
    await expect(page.getByTestId('detail-skeleton')).toBeVisible()
    await page.clock.runFor(3_000)
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()

    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-skeleton')).toBeVisible()
    await page.clock.runFor(3_000)
    await expect(page.getByTestId('empty-state')).toBeVisible()
  })

  test('falha transitória exibe erro e recupera com nova tentativa', async ({ page }) => {
    // As 3 primeiras consultas falham (1 + 2 retries automáticos)
    await open(page, '/', { scenarios: ['flaky-catalog'] })
    await expect(page.getByTestId('error-state').first()).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('error-state').first().getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
  })

  test('erro 500 no detalhe e recuperação após o serviço voltar', async ({ page }) => {
    await open(page, '/nft/emerald-ape-042', { scenarios: ['catalog-error'] })
    await expect(page.getByTestId('error-state')).toBeVisible()
    await mock.setScenarios(page, [])
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
  })

  test('sem conexão: feedback de erro e recuperação', async ({ page }) => {
    await open(page, '/carrinho', { scenarios: ['offline'] })
    await expect(page.getByTestId('error-state')).toContainText('Sem conexão', { timeout: 15_000 })
    await mock.setScenarios(page, [])
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('empty-state')).toBeVisible()
  })
})
