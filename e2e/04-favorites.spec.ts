import { expect, test } from '@playwright/test'
import { login, mock, open } from './support'

test.describe('Favoritos', () => {
  test('persistem para o usuário autenticado', async ({ page }) => {
    await open(page, '/')
    await login(page)
    await page.goto('/nft/sage-nomad-009')
    await page.getByTestId('favorite').click()
    await expect(page.getByTestId('favorite')).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page.getByTestId('favorite')).toHaveAttribute('aria-pressed', 'true')
    await page.goto('/conta/favoritos')
    await expect(page.getByTestId('favorites-grid')).toContainText('Sage Nomad #009')
  })

  test('visitante é levado ao login ao favoritar', async ({ page }) => {
    await open(page, '/nft/sage-nomad-009')
    await page.getByTestId('favorite').click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fnft%2Fsage-nomad-009/)
  })

  test('falha da mutation faz rollback e recupera ao tentar de novo', async ({ page }) => {
    await open(page, '/')
    await login(page)
    await page.goto('/nft/ivory-baron-088')
    await mock.setScenarios(page, ['favorite-fail'])
    const fav = page.getByTestId('favorite')
    await fav.click()
    await expect(page.getByText(/Não foi possível favoritar "Ivory Baron #088"/).first()).toBeVisible()
    await expect(fav).toHaveAttribute('aria-pressed', 'false') // rollback do otimismo

    await mock.setScenarios(page, [])
    await fav.click()
    await expect(fav).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(fav).toHaveAttribute('aria-pressed', 'true')
  })
})
