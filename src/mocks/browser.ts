/**
 * Inicialização da camada de mocks no navegador (dev, demo e testes E2E).
 * Ativada por `VITE_ENABLE_MOCKS=true` (ver `src/main.tsx`).
 */
import { setupWorker } from 'msw/browser'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/api/contracts'
import { getConfig, loadConfig, setConfig, type MockConfig } from './config'
import { db, initDb, resetDb, save } from './db'
import { accountHandlers } from './handlers/account'
import { authHandlers } from './handlers/auth'
import { cartHandlers } from './handlers/cart'
import { catalogHandlers } from './handlers/catalog'
import { orderHandlers, resumeSettlements, settleOrder } from './handlers/orders'
import { connectionCount, dropConnections, emitNftUpdated, emitRaw, lastSent, realtimeHandler } from './realtime'

export const handlers = [...authHandlers, ...catalogHandlers, ...cartHandlers, ...orderHandlers, ...accountHandlers, realtimeHandler]

export interface NftPatch {
  /** Altera o preço da edição (padrão: 1/50) — string decimal. */
  price?: string
  /** Altera a disponibilidade da edição. */
  available?: number
  editionId?: string
}

/** API de controle (painel Mock Lab e Playwright). Não é usada pela aplicação. */
export interface KurioMockControl {
  getConfig(): MockConfig
  setConfig(patch: Partial<MockConfig>): void
  reset(): Promise<void>
  /** Muda preço/disponibilidade e emite `nft.updated` pelo Socket.IO. */
  updateNft(id: string, patch: NftPatch): NftUpdatedEvent
  /** Reenvia o último evento emitido (duplicata). */
  replayLast(event: 'nft.updated' | 'order.updated'): void
  /** Envia um envelope arbitrário (ex.: versão antiga). */
  emitRaw(event: 'nft.updated' | 'order.updated', payload: NftUpdatedEvent | OrderUpdatedEvent): void
  lastEvent(event: 'nft.updated' | 'order.updated'): NftUpdatedEvent | OrderUpdatedEvent | null
  /** Derruba as conexões Socket.IO (o cliente reconecta). */
  dropConnections(): void
  connectionCount(): number
  /** Liquida manualmente um pedido pendente. */
  settleOrder(orderId: string, status: 'confirmed' | 'declined'): void
  /** Expira todas as sessões ativas. */
  expireSessions(): void
  snapshot(): typeof db
}

declare global {
  interface Window {
    __kurioMock?: KurioMockControl
  }
}

export async function startMocks() {
  performance.mark('mocks:start')
  const { resetRequested } = loadConfig()
  await initDb(resetRequested)
  resumeSettlements()
  performance.mark('mocks:db-ready')

  const worker = setupWorker(...handlers)
  await worker.start({
    quiet: true,
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
  performance.mark('mocks:worker-ready')

  window.__kurioMock = {
    getConfig,
    setConfig,
    async reset() {
      await resetDb()
      setConfig({ scenarios: [] })
    },
    updateNft(id, patch) {
      const nft = db.nfts.find((n) => n.id === id)
      if (!nft) throw new Error(`NFT ${id} não existe`)
      const edition = nft.editions.find((e) => e.id === (patch.editionId ?? '1-50'))
      if (!edition) throw new Error(`Edição inexistente`)
      if (patch.price !== undefined) {
        edition.price = patch.price
        if (edition.id === '1-50') {
          nft.previousPrice = null
          nft.price = patch.price
        }
      }
      if (patch.available !== undefined) edition.available = patch.available
      nft.available = nft.editions.reduce((s, e) => s + e.available, 0)
      nft.version++
      return emitNftUpdated(nft)
    },
    replayLast(event) {
      const last = lastSent(event) as NftUpdatedEvent | OrderUpdatedEvent | null
      if (last) emitRaw(event, last)
    },
    emitRaw,
    lastEvent: (event) => lastSent(event) as NftUpdatedEvent | OrderUpdatedEvent | null,
    dropConnections,
    connectionCount,
    settleOrder: (id, status) => void settleOrder(id, status),
    expireSessions() {
      for (const s of Object.values(db.sessions)) s.expiresAt = 0
      save()
    },
    snapshot: () => db,
  }
}
