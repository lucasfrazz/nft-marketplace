import { useMutation, useQuery } from '@tanstack/react-query'
import type { CreateOrderRequest, Order } from '@/api/contracts'
import { ordersApi } from '@/api/endpoints'
import { ApiError } from '@/api/http'
import { queryClient, qk } from '@/app/query-client'
import { useAuthUser } from '@/features/session/hooks'

export function useOrder(orderId: string) {
  const user = useAuthUser()
  return useQuery({
    queryKey: qk.order(user?.id ?? 'anon', orderId),
    queryFn: ({ signal }) => ordersApi.get(orderId, { signal }),
    enabled: !!user,
    // Rede de segurança: enquanto pendente, reconsulta (o evento é o caminho principal).
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? 5_000 : false),
  })
}

export function usePendingOrders() {
  const user = useAuthUser()
  return useQuery({
    queryKey: qk.orders(user?.id ?? 'anon', 'pending'),
    queryFn: ({ signal }) => ordersApi.list('pending', { signal }),
    enabled: !!user,
    staleTime: 0,
  })
}

/* ------------------------------------------------------------------ */
/* Tentativa de compra (chave de idempotência)                         */
/* ------------------------------------------------------------------ */

const ATTEMPT_KEY = 'kurio.checkout.attempt.v1'

interface Attempt {
  userId: string
  key: string
  fingerprint: string
}

/**
 * A chave de idempotência pertence a uma tentativa (usuário + cotação).
 * Persistida em sessionStorage: cliques repetidos, reenvios após timeout e
 * refresh reutilizam a mesma chave e recuperam o mesmo pedido.
 */
export function getAttemptKey(userId: string, fingerprint: string): string {
  try {
    const raw = sessionStorage.getItem(ATTEMPT_KEY)
    const a = raw ? (JSON.parse(raw) as Attempt) : null
    if (a && a.userId === userId && a.fingerprint === fingerprint) return a.key
  } catch {
    /* ignore */
  }
  const key = `ck_${crypto.randomUUID().replace(/-/g, '')}`
  try {
    sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify({ userId, key, fingerprint } satisfies Attempt))
  } catch {
    /* ignore */
  }
  return key
}

export function clearAttempt() {
  try {
    sessionStorage.removeItem(ATTEMPT_KEY)
  } catch {
    /* ignore */
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function useCreateOrder(onRetrying?: (attempt: number) => void) {
  const user = useAuthUser()
  return useMutation({
    mutationKey: ['create-order'],
    mutationFn: async ({ body, key }: { body: CreateOrderRequest; key: string }) => {
      // Reenvia com a MESMA chave após timeout/queda de rede (até 3 tentativas).
      for (let attempt = 0; ; attempt++) {
        try {
          return await ordersApi.create(body, key)
        } catch (e) {
          const retriable = e instanceof ApiError && (e.code === 'TIMEOUT' || e.code === 'NETWORK')
          if (!retriable || attempt >= 2) throw e
          onRetrying?.(attempt + 1)
          await wait(800 * (attempt + 1))
        }
      }
    },
    onSuccess: (order: Order) => {
      if (!user) return
      queryClient.setQueryData(qk.order(user.id, order.id), order)
      void queryClient.invalidateQueries({ queryKey: qk.orders(user.id, 'pending') })
    },
  })
}
