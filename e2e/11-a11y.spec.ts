import { expect, test } from '@playwright/test'
import { open } from './support'

test.describe('Acessibilidade e teclado', () => {
  test('link de pular conteúdo e navegação por teclado', async ({ page }) => {
    await open(page, '/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#conteudo/)

    // Chega a um card e abre o detalhe só com teclado
    const firstCard = page.getByTestId('nft-card-link').first()
    await firstCard.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/nft\//)
  })

  test('foco preso no diálogo de login e fechamento com Esc', async ({ page }) => {
    await open(page, '/entrar')
    const dialog = page.getByTestId('auth-dialog')
    await expect(dialog).toBeVisible()
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('erros de formulário associados aos campos', async ({ page }) => {
    await open(page, '/entrar')
    await page.getByTestId('login-email').fill('invalido')
    await page.getByTestId('login-submit').click()
    const email = page.getByTestId('login-email')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`#${describedBy!.split(' ')[0].replace(/:/g, '\\:')}`)).toHaveText('Informe um e-mail válido.')
    await expect(email).toBeFocused()
  })

  test('filtros mobile em drawer com foco controlado', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await open(page, '/')
    await page.getByTestId('open-filters').click()
    const sheet = page.getByRole('dialog', { name: 'Filtros' })
    await expect(sheet).toBeVisible()
    expect(await sheet.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(page.getByTestId('open-filters')).toBeFocused()
  })

  test('sem overflow horizontal em 390, 768 e 1440', async ({ page }) => {
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of ['/', '/nft/emerald-ape-042', '/carrinho', '/entrar']) {
        await open(page, path)
        await page.waitForTimeout(300)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow, `${path} @ ${width}px`).toBeLessThanOrEqual(0)
      }
      // Carrinho com itens
      await page.goto('/nft/emerald-ape-042')
      await page.getByRole('button', { name: width < 768 ? 'Comprar NFT' : 'COMPRAR', exact: true }).filter({ visible: true }).click()
      await expect(page).toHaveURL(/carrinho/)
      await expect(page.getByTestId('summary-total')).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `carrinho com itens @ ${width}px`).toBeLessThanOrEqual(0)
    }
  })
})
