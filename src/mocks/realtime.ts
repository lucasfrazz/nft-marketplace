/**
 * Servidor Socket.IO simulado sobre o interceptador de WebSocket do MSW
 * (`ws.link`) + `@mswjs/socket.io-binding` para codificar o protocolo.
 *
 * Transporte: apenas `websocket` (o cliente é configurado com
 * `transports: ['websocket']`). Long-polling não é simulado.
 *
 * Limitações do binding (documentadas no ARCHITECTURE.md):
 *  - O binding responde o handshake Engine.IO/Socket.IO automaticamente; o
 *    payload `auth` do CONNECT é lido aqui do frame bruto "40{...}".
 *  - Não há rooms/namespaces: o roteamento por usuário é feito aqui.
 *  - O binding não envia PING; este módulo envia o heartbeat ("2") para que
 *    o cliente não encerre a conexão por ping timeout.
 */
import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/api/contracts'
import { db, nextSeq, save } from './db'
import { hasScenario } from './config'
import type { DbNft } from './fixtures'

export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string | undefined) ?? 'wss://realtime.kurio.mock'

interface LiveConnection {
  id: string
  userId: string | null
  emit: (event: string, payload: unknown) => void
  close: () => void
}

const connections = new Map<string, LiveConnection>()
const sentLog: { event: string; payload: unknown; userId: string | null }[] = []

// O MSW normaliza "/socket.io/" para "/" antes do match — por isso o padrão
// casa com a raiz do host simulado.
const escaped = SOCKET_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const realtime = ws.link(new RegExp(`^${escaped}(/|$)`))

function resolveUser(token: unknown): string | null {
  if (typeof token !== 'string') return null
  const s = db.sessions[token]
  if (!s || s.expiresAt < Date.now()) return null
  return s.userId
}

export const realtimeHandler = realtime.addEventListener('connection', (connection) => {
  const { client } = connection
  if (hasScenario('offline')) {
    queueMicrotask(() => client.close(1011, 'offline'))
    return
  }
  const io = toSocketIo(connection)
  const live: LiveConnection = {
    id: client.id,
    userId: null,
    emit: (event, payload) => io.client.emit(event, payload),
    close: () => client.close(),
  }
  connections.set(client.id, live)

  // Lê o pacote CONNECT ("40{json}") para autenticar a conexão.
  client.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') return
    if (event.data.startsWith('40')) {
      try {
        const auth = JSON.parse(event.data.slice(2) || '{}') as { token?: string }
        live.userId = resolveUser(auth.token)
      } catch {
        live.userId = null
      }
    }
  })

  // Heartbeat Engine.IO (PING) — o cliente responde com PONG ("3").
  const heartbeat = setInterval(() => {
    try {
      client.send('2')
    } catch {
      clearInterval(heartbeat)
    }
  }, 20_000)

  client.addEventListener('close', () => {
    clearInterval(heartbeat)
    connections.delete(client.id)
  })
})

/* ------------------------------------------------------------------ */
/* Emissão                                                             */
/* ------------------------------------------------------------------ */

function send(event: string, payload: unknown, userId: string | null) {
  sentLog.push({ event, payload, userId })
  if (sentLog.length > 100) sentLog.shift()
  for (const c of connections.values()) {
    // Eventos privados só para conexões autenticadas como o dono.
    if (userId && c.userId !== userId) continue
    c.emit(event, payload)
  }
}

export function emitNftUpdated(nft: DbNft) {
  const evt: NftUpdatedEvent = {
    id: `evt_${nextSeq()}`,
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: new Date().toISOString(),
    userId: null,
    data: {
      price: nft.price,
      previousPrice: nft.previousPrice,
      available: nft.available,
      editions: nft.editions.map((e) => ({ id: e.id, price: e.price, available: e.available })),
    },
  }
  save()
  send('nft.updated', evt, null)
  return evt
}

export function emitOrderUpdated(order: Order) {
  const evt: OrderUpdatedEvent = {
    id: `evt_${nextSeq()}`,
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: new Date().toISOString(),
    userId: order.userId,
    data: { status: order.status, order },
  }
  save()
  send('order.updated', evt, order.userId)
  return evt
}

/** Reenvia um envelope arbitrário (duplicatas / eventos antigos nos testes). */
export function emitRaw(event: 'nft.updated' | 'order.updated', payload: NftUpdatedEvent | OrderUpdatedEvent) {
  send(event, payload, payload.userId)
}

export function lastSent(event?: string) {
  const list = event ? sentLog.filter((s) => s.event === event) : sentLog
  return list.at(-1)?.payload ?? null
}

/** Derruba todas as conexões (o cliente reconecta automaticamente). */
export function dropConnections() {
  for (const c of [...connections.values()]) c.close()
}

/** Encerra conexões de uma sessão (logout / troca de usuário). */
export function dropUserConnections(userId: string) {
  for (const c of [...connections.values()]) if (c.userId === userId) c.close()
}

export const connectionCount = () => connections.size
