import { expect, type Page } from '@playwright/test'

export const ANA = { email: 'ana@kurio.dev', password: 'Kurio@123', name: 'Ana Souza' }
export const BRUNO = { email: 'bruno@kurio.dev', password: 'Kurio@123', name: 'Bruno Lima' }

type Latency = 'none' | 'realistic' | 'slow' | 'variable'

/**
 * Abre a aplicação com um cenário de mock conhecido. Os parâmetros `mock*`
 * são lidos pela camada MSW na inicialização e removidos da URL.
 */
export async function open(page: Page, path = '/', opts: { scenarios?: string[]; latency?: Latency; settle?: number; reset?: boolean } = {}) {
  const u = new URL(path, 'http://x')
  u.searchParams.set('mock', (opts.scenarios ?? []).join(','))
  u.searchParams.set('mock-latency', opts.latency ?? 'none')
  if (opts.settle !== undefined) u.searchParams.set('mock-settle', String(opts.settle))
  if (opts.reset !== false) u.searchParams.set('mock-reset', '1')
  await page.goto(u.pathname + u.search + u.hash)
  await page.waitForFunction(() => !!window.__kurioMock)
}

/** Controle da camada de mocks (MSW) — nunca toca no estado da aplicação. */
export const mock = {
  setScenarios: (page: Page, scenarios: string[]) => page.evaluate((s) => window.__kurioMock!.setConfig({ scenarios: s as never }), scenarios),
  updateNft: (page: Page, id: string, patch: { price?: string; available?: number; editionId?: string }) => page.evaluate(([i, p]) => window.__kurioMock!.updateNft(i, p), [id, patch] as const),
  orders: (page: Page) => page.evaluate(() => Object.values(window.__kurioMock!.snapshot().orders)),
  connections: (page: Page) => page.evaluate(() => window.__kurioMock!.connectionCount()),
}

export async function login(page: Page, user = ANA) {
  await page.goto('/entrar')
  await page.getByTestId('login-email').fill(user.email)
  await page.getByTestId('login-password').fill(user.password)
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('auth-dialog')).toBeHidden()
}

/** Adiciona um NFT ao carrinho pela página de detalhe. */
export async function addFromDetail(page: Page, nftId: string, opts: { edition?: string; qty?: number } = {}) {
  await page.goto(`/nft/${nftId}${opts.edition ? `?edition=${opts.edition}` : ''}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const plus = page.getByRole('button', { name: /Aumentar quantidade/ }).filter({ visible: true }).first()
  for (let i = 1; i < (opts.qty ?? 1); i++) await plus.click()
  const isMobile = (page.viewportSize()?.width ?? 1440) < 768
  await (isMobile ? page.getByRole('button', { name: 'Comprar NFT', exact: true }) : page.getByTestId('buy')).click()
  await expect(page).toHaveURL(/\/carrinho/)
}

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768
