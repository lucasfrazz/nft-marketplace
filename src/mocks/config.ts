/**
 * Configuração de cenários dos mocks.
 *
 * Fontes (em ordem de precedência na inicialização):
 *  1. Query string `?mock=<cenario>,<cenario>` (+ `&mock-latency=<modo>`,
 *     `&mock-seed=<n>`, `&mock-reset=1`). Removida da URL após a leitura.
 *  2. localStorage `kurio.mock.config.v1` (persistida entre refreshes).
 *  3. Padrão: nenhum cenário de falha e latência "realistic".
 *
 * Em tempo de execução: painel "Mock Lab" na interface ou `window.__kurioMock`.
 */

export const SCENARIOS = {
  'empty-catalog': 'Catálogo vazio (resultado sem itens)',
  'catalog-error': 'Catálogo/detalhe respondem HTTP 500',
  'flaky-catalog': 'As 3 primeiras consultas ao catálogo falham com 503',
  'out-of-order': 'Respostas do catálogo fora de ordem (1ª lenta, seguintes rápidas)',
  offline: 'Sem conexão (REST e Socket.IO falham)',
  'session-expired': 'Próxima requisição autenticada retorna sessão expirada',
  'signup-conflict': 'Cadastro sempre retorna e-mail em uso',
  'favorite-fail': 'Mutations de favoritos falham com 500',
  'wallet-reject': 'Conexão de carteira recusada pelo usuário',
  'price-change-at-checkout': 'Preço muda ao enviar o pedido (1ª tentativa)',
  'sold-out-at-checkout': 'Edição esgota ao enviar o pedido (1ª tentativa)',
  'order-timeout': 'Pedido é criado mas a resposta excede o timeout (1ª tentativa)',
  'payment-declined': 'Pagamento recusado na liquidação',
  'manual-settlement': 'Pedido fica pendente até liquidação manual',
} as const

export type ScenarioId = keyof typeof SCENARIOS
export type LatencyMode = 'none' | 'realistic' | 'slow' | 'variable'

export const LATENCY_MODES: Record<LatencyMode, string> = {
  none: 'Sem latência',
  realistic: 'Realista (120–350 ms)',
  slow: 'Lenta (2,5 s)',
  variable: 'Variável (100–1800 ms, seed)',
}

export interface MockConfig {
  scenarios: ScenarioId[]
  latency: LatencyMode
  seed: number
  /** Tempo até a liquidação do pedido (ms). */
  settleDelayMs: number
}

const KEY = 'kurio.mock.config.v1'
export const DEFAULT_CONFIG: MockConfig = { scenarios: [], latency: 'realistic', seed: 42, settleDelayMs: 2500 }

let config: MockConfig = { ...DEFAULT_CONFIG }
const listeners = new Set<(c: MockConfig) => void>()

function isScenario(v: string): v is ScenarioId {
  return v in SCENARIOS
}

export function loadConfig(): { config: MockConfig; resetRequested: boolean } {
  let stored: Partial<MockConfig> = {}
  try {
    stored = JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    /* ignore */
  }
  config = { ...DEFAULT_CONFIG, ...stored }

  let resetRequested = false
  const url = new URL(window.location.href)
  const p = url.searchParams
  if (p.has('mock')) {
    config.scenarios = (p.get('mock') ?? '').split(',').map((s) => s.trim()).filter(isScenario)
    p.delete('mock')
  }
  if (p.has('mock-latency')) {
    const l = p.get('mock-latency') as LatencyMode
    if (l in LATENCY_MODES) config.latency = l
    p.delete('mock-latency')
  }
  if (p.has('mock-seed')) {
    config.seed = Number(p.get('mock-seed')) || DEFAULT_CONFIG.seed
    p.delete('mock-seed')
  }
  if (p.has('mock-settle')) {
    config.settleDelayMs = Math.max(0, Number(p.get('mock-settle')) || DEFAULT_CONFIG.settleDelayMs)
    p.delete('mock-settle')
  }
  if (p.has('mock-reset')) {
    resetRequested = true
    p.delete('mock-reset')
  }
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  persist()
  rng = mulberry32(config.seed)
  return { config, resetRequested }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(config))
  } catch {
    /* ignore */
  }
}

export const getConfig = () => config
export const hasScenario = (id: ScenarioId) => config.scenarios.includes(id)

export function setConfig(patch: Partial<MockConfig>) {
  config = { ...config, ...patch }
  if (patch.seed !== undefined) rng = mulberry32(config.seed)
  persist()
  listeners.forEach((l) => l(config))
}

export function subscribeConfig(fn: (c: MockConfig) => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Remove um cenário "de uso único" após disparado. */
export function consumeScenario(id: ScenarioId) {
  if (!hasScenario(id)) return false
  setConfig({ scenarios: config.scenarios.filter((s) => s !== id) })
  return true
}

/* ------------------------------------------------------------------ */
/* RNG determinístico e latência                                       */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
let rng = mulberry32(DEFAULT_CONFIG.seed)
export const random = () => rng()

export function latencyMs(): number {
  switch (config.latency) {
    case 'none':
      return 0
    case 'slow':
      return 2500
    case 'variable':
      return Math.round(100 + random() * 1700)
    default:
      return Math.round(120 + random() * 230)
  }
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
