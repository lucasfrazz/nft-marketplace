import { expect, test, type Page } from '@playwright/test'
import { open } from './support'

const names = (page: Page) => page.getByTestId('nft-card-link').allInnerTexts()
const prices = async (page: Page) => (await page.getByTestId('nft-price').allInnerTexts()).map((t) => Number(t.match(/(\d+\.\d+)/)![1]))

test.describe('Catálogo', () => {
  test('busca, filtros combinados, ordenação, paginação e histórico @main', async ({ page }) => {
    await open(page, '/')
    const isMobile = (page.viewportSize()?.width ?? 1440) < 768
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    await expect(page.getByTestId('results-count')).toHaveText('48 resultados')

    // Busca
    await page.getByTestId('catalog-search').filter({ visible: true }).fill('golden')
    await expect(page).toHaveURL(/q=golden/)
    await expect(page.getByTestId('results-count')).toHaveText('3 resultados')
    expect((await names(page)).every((n) => n.includes('Golden'))).toBe(true)
    await page.getByTestId('catalog-search').filter({ visible: true }).fill('')
    await expect(page.getByTestId('results-count')).toHaveText('48 resultados')

    // Paginação
    await page.getByTestId('page-2').click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByTestId('page-2')).toHaveAttribute('aria-current', 'page')

    // Filtros combinados (mudança de filtro reinicia a paginação)
    const prefix = isMobile ? 'm' : 'f'
    if (isMobile) await page.getByTestId('open-filters').click()
    await page.getByTestId(`${prefix}-col-musica`).click()
    await expect(page).toHaveURL(/col=musica/)
    await expect(page).not.toHaveURL(/page=2/)
    await page.getByTestId(`${prefix}-net-ethereum`).click()
    await expect(page).toHaveURL(/col=musica.*net=ethereum|net=ethereum.*col=musica/)
    if (isMobile) await page.keyboard.press('Escape')
    const filteredCount = await page.getByTestId('results-count').innerText()
    expect(Number(filteredCount.split(' ')[0])).toBeLessThan(48)
    expect(await names(page)).toContain('Golden Signal #160')

    // Ordenação
    if (!isMobile) {
      await page.getByTestId('sort-trigger').click()
      await page.getByTestId('sort-price-desc').click()
      await expect(page).toHaveURL(/sort=price-desc/)
      await expect(page.getByTestId('catalog-grid')).toBeVisible()
      const p = await prices(page)
      expect([...p].sort((a, b) => b - a)).toEqual(p)
    }

    // Histórico: voltar restaura o estado anterior
    await page.goBack()
    if (isMobile) {
      await expect(page).not.toHaveURL(/net=/)
      await page.goForward()
    } else {
      await expect(page).not.toHaveURL(/sort=/)
    }
    // Refresh preserva busca, filtros e página
    await expect(page.getByTestId('results-count')).toHaveText(filteredCount)
    await page.reload()
    await expect(page).toHaveURL(/col=musica/)
    await expect(page.getByTestId('results-count')).toHaveText(filteredCount)
  })

  test('resultado vazio com limpeza de filtros', async ({ page }) => {
    await open(page, '/?q=inexistente-xyz')
    await expect(page.getByTestId('empty-state')).toContainText('Nenhum NFT encontrado')
    await page.getByTestId('clear-filters').click()
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
  })

  test('catálogo vazio vindo da API', async ({ page }) => {
    await open(page, '/', { scenarios: ['empty-catalog'] })
    await expect(page.getByTestId('empty-state')).toBeVisible()
  })

  test('respostas fora de ordem não sobrescrevem a busca mais recente', async ({ page }) => {
    await open(page, '/', { scenarios: ['out-of-order'] })
    await expect(page.getByTestId('catalog-grid')).toBeVisible({ timeout: 10_000 })
    const search = page.getByTestId('catalog-search').filter({ visible: true })
    await search.fill('zz') // requisição rápida
    await expect(page.getByTestId('empty-state')).toBeVisible()
    await search.fill('golden') // requisição LENTA (1.8s)
    await page.waitForTimeout(550)
    await search.fill('sage') // requisição rápida — chega antes da anterior
    await expect(page).toHaveURL(/q=sage/)
    await page.waitForTimeout(2_500) // a resposta antiga ("golden") chega depois
    const list = await names(page)
    expect(list.length).toBeGreaterThan(0)
    expect(list.every((n) => n.toLowerCase().includes('sage'))).toBe(true)
  })

  test('parâmetros inválidos na URL caem no padrão', async ({ page }) => {
    await open(page, '/?page=-3&sort=hack&col=nada')
    await expect(page.getByTestId('results-count')).toHaveText('48 resultados')
  })
})
