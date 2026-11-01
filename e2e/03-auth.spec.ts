import { expect, test } from '@playwright/test'
import { ANA, BRUNO, login, open } from './support'

test.describe('Conta e sessão', () => {
  test('cadastro com validação, conflito e sucesso @main', async ({ page }) => {
    await open(page, '/cadastro')
    await page.getByTestId('signup-submit').click()
    await expect(page.getByTestId('signup-username')).toHaveAttribute('aria-invalid', 'true')

    await page.getByTestId('signup-username').fill('nova.colecionadora')
    await page.getByTestId('signup-email').fill(ANA.email)
    await page.getByTestId('signup-password').fill('abc')
    await page.getByTestId('signup-confirm').fill('abd')
    await page.getByTestId('signup-submit').click()
    await expect(page.getByRole('alert').filter({ hasText: 'A senha deve ter pelo menos 8 caracteres.' })).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'As senhas não conferem.' })).toBeVisible()

    await page.getByTestId('signup-password').fill('Segura123')
    await page.getByTestId('signup-confirm').fill('Segura123')
    await page.getByTestId('signup-submit').click()
    await expect(page.getByRole('alert').filter({ hasText: /já está cadastrado/ })).toBeVisible() // conflito vindo da API

    await page.getByTestId('signup-email').fill('nova@kurio.dev')
    await page.getByTestId('signup-submit').click()
    await expect(page.getByTestId('auth-dialog')).toBeHidden()
    await page.reload() // sessão recuperável após refresh
    await page.goto('/conta/perfil')
    await expect(page.getByTestId('profile-email')).toHaveValue('nova@kurio.dev')
  })

  test('login com credenciais inválidas e retorno ao fluxo anterior', async ({ page }) => {
    await open(page, '/conta/perfil')
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fconta%2Fperfil/)
    await page.getByTestId('login-email').fill(ANA.email)
    await page.getByTestId('login-password').fill('senha-errada1')
    await page.getByTestId('login-submit').click()
    await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' })).toBeVisible()
    await page.getByTestId('login-password').fill(ANA.password)
    await page.getByTestId('login-submit').click()
    await expect(page).toHaveURL(/\/conta\/perfil$/)
    await expect(page.getByTestId('profile-displayName')).toHaveValue('Ana Souza')
  })

  test('expiração de sessão preserva o contexto para retomada', async ({ page }) => {
    await open(page, '/')
    await login(page)
    await page.goto('/conta/carteiras')
    await expect(page.getByTestId('wallet-form-primary')).toBeVisible()
    await page.evaluate(() => window.__kurioMock!.expireSessions())
    await page.goto('/conta/perfil')
    await expect(page).toHaveURL(/\/entrar\?.*reason=expired/)
    await expect(page.getByTestId('session-expired-msg')).toBeVisible()
    await page.getByTestId('login-email').fill(ANA.email)
    await page.getByTestId('login-password').fill(ANA.password)
    await page.getByTestId('login-submit').click()
    await expect(page).toHaveURL(/\/conta\/perfil$/)
  })

  test('logout e troca de usuário não expõem dados do anterior', async ({ page }) => {
    await open(page, '/')
    await login(page, ANA)
    await page.goto('/nft/emerald-ape-042')
    await page.getByTestId('favorite').click()
    await expect(page.getByTestId('favorite')).toHaveAttribute('aria-pressed', 'true')
    await page.goto('/conta/favoritos')
    await expect(page.getByTestId('favorites-grid')).toContainText('Emerald Ape')

    await page.getByTestId('account-logout').click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
    // Dados privados não ficam acessíveis após logout
    await page.goto('/conta/favoritos')
    await expect(page).toHaveURL(/\/entrar/)

    await page.getByTestId('login-email').fill(BRUNO.email)
    await page.getByTestId('login-password').fill(BRUNO.password)
    await page.getByTestId('login-submit').click()
    await expect(page).toHaveURL(/\/conta\/favoritos$/)
    await expect(page.getByTestId('empty-state')).toContainText('Nenhum favorito')
    await expect(page.getByTestId('user-menu')).toContainText('Bruno Lima')
  })
})
