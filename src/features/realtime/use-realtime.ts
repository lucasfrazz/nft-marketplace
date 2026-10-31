/**
 * Integração Socket.IO ↔ TanStack Query.
 *
 * - Uma conexão por sessão: o token entra no `auth` do handshake. Ao trocar
 *   de usuário/logout, listeners são removidos e o socket é encerrado.
 * - Idempotência: eventos são deduplicados por `id` e aplicados apenas se
 *   `version` for maior que a versão conhecida do recurso (sem regressão).
 * - Isolamento: `order.updated` de outro usuário é ignorado.
 * - Reconciliação: após reconexão, queries ativas são revalidadas via REST.
 */
import { useEffect } from 'react'
import { io, type Socket } from 'socket.io-client'
import { toast } from 'sonner'
import type { Cart, FavoritesResponse, NftDetail, NftListResponse, NftSummary, NftUpdatedEvent, Order, OrderUpdatedEvent, ServerToClientEvents } from '@/api/contracts'
import { queryClient } from '@/app/query-client'
import { announce } from '@/components/live-region'
import { formatEth } from '@/lib/eth'
import { sessionStore, useSession } from '@/features/session/session-store'
import { realtimeStore } from './store'

export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string | undefined) ?? 'wss://realtime.kurio.mock'

const seen = new Set<string>()
const versions = new Map<string, number>()

function markSeen(id: string) {
  seen.add(id)
  if (seen.size > 500) seen.delete(seen.values().next().value!)
}

function knownNftVersion(id: string): number {
  let v = versions.get(`nft:${id}`) ?? 0
  const detail = queryClient.getQueryData<NftDetail>(['nfts', 'detail', id])
  if (detail) v = Math.max(v, detail.version)
  return v
}

function patchSummary<T extends NftSummary>(item: T, evt: NftUpdatedEvent): T {
  if (item.id !== evt.resource.id || item.version >= evt.version) return item
  return { ...item, price: evt.data.price, previousPrice: evt.data.previousPrice, available: evt.data.available, version: evt.version }
}

export function applyNftUpdated(evt: NftUpdatedEvent) {
  if (seen.has(evt.id)) return false
  markSeen(evt.id)
  const id = evt.resource.id
  if (evt.version <= knownNftVersion(id)) return false
  versions.set(`nft:${id}`, evt.version)

  const before = queryClient.getQueryData<NftDetail>(['nfts', 'detail', id])
  queryClient.setQueryData<NftDetail>(['nfts', 'detail', id], (old) =>
    old && old.version < evt.version
      ? {
          ...patchSummary(old, evt),
          editions: old.editions.map((e) => {
            const u = evt.data.editions.find((x) => x.id === e.id)
            return u ? { ...e, price: u.price, available: u.available } : e
          }),
        }
      : old,
  )
  queryClient.setQueriesData<NftListResponse>({ queryKey: ['nfts', 'list'] }, (old) => (old ? { ...old, items: old.items.map((i) => patchSummary(i, evt)) } : old))
  queryClient.setQueriesData<{ items: NftSummary[] }>({ queryKey: ['nfts', 'related'] }, (old) => (old ? { ...old, items: old.items.map((i) => patchSummary(i, evt)) } : old))
  const uid = sessionStore.get().user?.id
  if (uid) queryClient.setQueryData<FavoritesResponse>(['user', uid, 'favorites'], (old) => (old ? { ...old, items: old.items.map((i) => patchSummary(i, evt)) } : old))

  // Carrinho: informa a alteração e revalida carrinho + cotação.
  const carts = queryClient.getQueriesData<Cart>({ queryKey: ['cart'] })
  const inCart = carts.flatMap(([, c]) => c?.items ?? []).filter((i) => i.nftId === id)
  if (inCart.length) {
    for (const item of inCart) {
      const edition = evt.data.editions.find((e) => e.id === item.editionId)
      if (!edition) continue
      const name = item.name
      if (edition.price !== item.unitPrice) {
        const msg = `O preço de ${name} (${item.editionLabel}) mudou de ${formatEth(item.unitPrice)} para ${formatEth(edition.price)}.`
        realtimeStore.pushNotice({ id: evt.id, nftId: id, name, kind: 'price', from: item.unitPrice, to: edition.price, at: Date.now() })
        toast.warning(msg, { id: `price-${id}-${item.editionId}` })
        announce(msg)
      }
      if (edition.available < item.quantity) {
        const msg = edition.available === 0 ? `${name} (${item.editionLabel}) esgotou.` : `${name} (${item.editionLabel}) agora tem apenas ${edition.available} disponível(is).`
        realtimeStore.pushNotice({ id: `${evt.id}-a`, nftId: id, name, kind: 'availability', from: String(item.quantity), to: String(edition.available), at: Date.now() })
        toast.warning(msg, { id: `avail-${id}-${item.editionId}` })
        announce(msg)
      }
    }
    void queryClient.invalidateQueries({ queryKey: ['cart'] })
    void queryClient.invalidateQueries({ queryKey: ['quote'] })
  } else if (before && before.price !== evt.data.price) {
    announce(`Preço de ${before.name} atualizado para ${formatEth(evt.data.price)}.`)
  }
  return true
}

export function applyOrderUpdated(evt: OrderUpdatedEvent) {
  if (seen.has(evt.id)) return false
  markSeen(evt.id)
  const uid = sessionStore.get().user?.id
  // Eventos de outra sessão/usuário nunca atualizam dados locais.
  if (!uid || evt.userId !== uid) return false
  const key = ['user', uid, 'order', evt.resource.id]
  const cached = queryClient.getQueryData<Order>(key)
  const known = Math.max(versions.get(`order:${evt.resource.id}`) ?? 0, cached?.version ?? 0)
  if (evt.version <= known) return false
  // Estados terminais não regridem.
  if (cached && cached.status !== 'pending') return false
  versions.set(`order:${evt.resource.id}`, evt.version)
  queryClient.setQueryData<Order>(key, evt.data.order)
  void queryClient.invalidateQueries({ queryKey: ['user', uid, 'orders'] })
  if (evt.data.status === 'confirmed') {
    void queryClient.invalidateQueries({ queryKey: ['cart'] })
    void queryClient.invalidateQueries({ queryKey: ['quote'] })
    announce('Pagamento confirmado. Seus NFTs estão na sua carteira.')
  } else if (evt.data.status === 'declined') {
    announce('Pagamento recusado. Seus itens continuam no carrinho.')
  }
  return true
}

export function useRealtime() {
  const { token, user } = useSession()

  useEffect(() => {
    realtimeStore.setStatus('connecting')
    const socket: Socket<ServerToClientEvents> = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: token ? { token } : {},
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3_000,
      timeout: 5_000,
    })
    let connectedOnce = false

    const onConnect = () => {
      realtimeStore.setStatus('online')
      if (connectedOnce) {
        // Reconexão: reconcilia recursos ativos com a API REST.
        void queryClient.invalidateQueries({ refetchType: 'active' })
        announce('Conexão em tempo real restabelecida.')
      }
      connectedOnce = true
    }
    const onDisconnect = (reason: Socket.DisconnectReason) => {
      realtimeStore.setStatus(reason === 'io client disconnect' ? 'offline' : 'reconnecting')
    }
    const onConnectError = () => realtimeStore.setStatus('reconnecting')

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.on('nft.updated', applyNftUpdated)
    socket.on('order.updated', applyOrderUpdated)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.off('nft.updated', applyNftUpdated)
      socket.off('order.updated', applyOrderUpdated)
      socket.disconnect()
    }
    // Reconecta ao trocar a sessão (token/usuário).
  }, [token, user?.id])
}
