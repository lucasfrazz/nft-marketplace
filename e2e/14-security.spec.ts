import { expect, test } from '@playwright/test'
import { ANA, login, mock, open } from './support'

test.describe('Segurança', () => {
  for (const evil of ['//evil.example', '/\\evil.example', 'https://evil.example', '/%5Cevil.example']) {
    test(`redirect pós-login não sai do site: ${evil}`, async ({ page }) => {
      await open(page, `/entrar?redirect=${encodeURIComponent(evil)}`)
      await page.getByTestId('login-email').fill(ANA.email)
      await page.getByTestId('login-password').fill(ANA.password)
      await page.getByTestId('login-submit').click()
      await expect(page.getByTestId('auth-dialog')).toBeHidden()
      // Continua no próprio site (nunca navega para outro host)
      expect(new URL(page.url()).host).toBe(new URL(test.info().project.use.baseURL!).host)
    })
  }

  test('bloqueio após tentativas de login erradas (429)', async ({ page }) => {
    await open(page, '/entrar')
    await page.getByTestId('login-email').fill(ANA.email)
    for (let i = 0; i < 5; i++) {
      await page.getByTestId('login-password').fill(`errada-${i}x`)
      await page.getByTestId('login-submit').click()
      await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' })).toBeVisible()
    }
    await page.getByTestId('login-password').fill(ANA.password)
    await page.getByTestId('login-submit').click()
    await expect(page.getByRole('alert').filter({ hasText: 'Muitas tentativas de login' })).toBeVisible()
  })

  test('mensagem de login não revela se o e-mail existe', async ({ page }) => {
    await open(page, '/entrar')
    await page.getByTestId('login-email').fill('ninguem@kurio.dev')
    await page.getByTestId('login-password').fill('qualquer123')
    await page.getByTestId('login-submit').click()
    await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' })).toBeVisible()
  })

  test('senhas armazenadas apenas como hash PBKDF2', async ({ page }) => {
    await open(page, '/')
    const users = await mock.run(page, () => window.__kurioMock!.snapshot().users)
    for (const u of users as unknown as Record<string, unknown>[]) {
      expect(u).not.toHaveProperty('password')
      expect(String(u.passwordHash)).toMatch(/^[0-9a-f]{64}$/)
      expect(JSON.stringify(u)).not.toContain('Kurio@123')
    }
  })

  test('conteúdo do usuário é exibido como texto (sem XSS)', async ({ page }) => {
    await open(page, '/')
    await login(page)
    await page.goto('/conta/perfil')
    const payload = '<img src=x onerror="window.__xss=1">'
    await page.getByTestId('profile-displayName').fill(payload)
    await page.getByTestId('profile-save').click()
    await expect(page.getByTestId('profile-status')).toBeVisible()
    await expect(page.getByTestId('user-menu')).toContainText('<img src=x')
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  })

  test('API valida tamanho dos campos no servidor', async ({ page }) => {
    await open(page, '/')
    await login(page)
    const status = await page.evaluate(async () => {
      const token = JSON.parse(localStorage.getItem('kurio.session.v1')!).token
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ displayName: 'x'.repeat(5000), username: 'ana.souza', email: 'ana@kurio.dev', ensName: 'ana', walletNickname: 'P' }),
      })
      return { status: res.status, body: await res.json() }
    })
    expect(status.status).toBe(422)
    expect(status.body.error.fields.displayName).toContain('Máximo')
  })

  test('pedido de outro usuário retorna 403', async ({ page }) => {
    await open(page, '/')
    await login(page)
    const res = await page.evaluate(async () => {
      const db = window.__kurioMock!.snapshot()
      db.orders['ord_alheio'] = { ...(Object.values(db.orders)[0] ?? {}), id: 'ord_alheio', userId: 'u_bruno', status: 'confirmed', lines: [] } as never
      const token = JSON.parse(localStorage.getItem('kurio.session.v1')!).token
      const r = await fetch('/api/orders/ord_alheio', { headers: { Authorization: `Bearer ${token}` } })
      return r.status
    })
    expect(res).toBe(403)
  })

  test('cabeçalhos de segurança no servidor de preview', async ({ request }) => {
    const res = await request.get('/')
    const h = res.headers()
    expect(h['content-security-policy']).toContain("default-src 'self'")
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(h['x-content-type-options']).toBe('nosniff')
    expect(h['x-frame-options']).toBe('DENY')
  })
})
