import { expect, test, type Page } from '@playwright/test'
import { BRUNO, login, open } from './support'

// PNG 1x1 válido
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

async function pick(page: Page, testId: string, option: string) {
  await page.getByTestId(testId).click()
  await page.getByRole('option', { name: option }).click()
}

test.describe('Perfil e carteiras', () => {
  test('edição de perfil com validação e persistência', async ({ page }) => {
    await open(page, '/')
    await login(page)
    await page.goto('/conta/perfil')
    await page.getByTestId('profile-email').fill('email-invalido')
    await page.getByTestId('profile-save').click()
    await expect(page.getByTestId('profile-email')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByRole('alert').filter({ hasText: 'Informe um e-mail válido.' })).toBeVisible()

    // Conflito vindo da API (e-mail de outro usuário)
    await page.getByTestId('profile-email').fill(BRUNO.email)
    await page.getByTestId('profile-save').click()
    await expect(page.getByRole('alert').filter({ hasText: 'outra conta' })).toBeVisible()

    await page.getByTestId('profile-email').fill('ana@kurio.dev')
    await page.getByTestId('profile-displayName').fill('Ana S. Colecionadora')
    await page.getByTestId('profile-save').click()
    await expect(page.getByTestId('profile-status')).toHaveText('Perfil atualizado.')
    await page.reload()
    await expect(page.getByTestId('profile-displayName')).toHaveValue('Ana S. Colecionadora')
    await expect(page.getByTestId('user-menu')).toContainText('Ana S. Colecionadora')
  })

  test('avatar: envio, validação de tipo e remoção', async ({ page }) => {
    await open(page, '/')
    await login(page)
    await page.goto('/conta/perfil')
    await page.getByTestId('avatar-input').setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') })
    await expect(page.getByTestId('avatar-error')).toContainText('PNG, JPEG ou WebP')
    await page.getByTestId('avatar-input').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByTestId('avatar-img')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('avatar-img')).toBeVisible()
    await page.getByTestId('avatar-remove').click()
    await expect(page.getByTestId('avatar-img')).toHaveCount(0)
  })

  test('alteração de senha com erro e sucesso', async ({ page }) => {
    await open(page, '/')
    await login(page)
    await page.goto('/conta/perfil')
    await page.getByTestId('pw-current').fill('errada123')
    await page.getByTestId('pw-new').fill('curta')
    await page.getByTestId('pw-confirm').fill('outra')
    await page.getByTestId('profile-save').click()
    await expect(page.getByRole('alert').filter({ hasText: 'pelo menos 8 caracteres' })).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'As senhas não conferem.' })).toBeVisible()

    await page.getByTestId('pw-new').fill('NovaSenha2026')
    await page.getByTestId('pw-confirm').fill('NovaSenha2026')
    await page.getByTestId('profile-save').click()
    await expect(page.getByRole('alert').filter({ hasText: 'Senha atual incorreta.' })).toBeVisible()

    await page.getByTestId('pw-current').fill('Kurio@123')
    await page.getByTestId('profile-save').click()
    await expect(page.getByTestId('profile-status')).toHaveText('Perfil e senha atualizados.')

    // Nova senha vale no próximo login
    await page.getByTestId('account-logout').click()
    await login(page, { email: 'ana@kurio.dev', password: 'NovaSenha2026', name: 'Ana' })
    await expect(page.getByTestId('user-menu')).toBeVisible()
  })

  test('cadastro e edição de carteiras principal e secundária', async ({ page }) => {
    await open(page, '/')
    await login(page, BRUNO)
    await page.goto('/conta/carteiras')
    await expect(page.getByText('Você ainda não adicionou')).toHaveCount(0)
    const form = page.getByTestId('wallet-form-primary')
    await form.getByTestId('w1-save').click()
    await expect(form.getByRole('alert').first()).toBeVisible()

    await form.getByTestId('w1-nickname').fill('Cofre')
    await pick(page, 'w1-network', 'Polygon')
    await form.getByTestId('w1-address').fill('0x123')
    await pick(page, 'w1-provider', 'MetaMask')
    await form.getByTestId('w1-referral').fill('BRUNO-01')
    await form.getByTestId('w1-save').click()
    await expect(form.getByRole('alert').filter({ hasText: '40 caracteres hexadecimais' })).toBeVisible()

    await form.getByTestId('w1-address').fill('0x9f8e7d6c5b4a39281706f5e4d3c2b1a098765432')
    await form.getByTestId('w1-save').click()
    await expect(form.getByRole('status')).toContainText('Carteira principal salva.')
    await page.reload()
    await expect(page.getByTestId('w1-address')).toHaveValue('0x9f8e7d6c5b4a39281706f5e4d3c2b1a098765432')

    // Secundária igual à principal
    await page.getByTestId('same-as-primary').click()
    await expect(page.getByText('Usando a carteira principal')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('same-as-primary')).toBeChecked()
  })
})
