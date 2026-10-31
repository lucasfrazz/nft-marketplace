import { queryClient } from './query-client'
import { sessionStore } from '@/features/session/session-store'
import { clearAttempt } from '@/features/orders/hooks'
import { realtimeStore } from '@/features/realtime/store'

/**
 * Logout, expiração e troca de usuário limpam TODOS os dados privados da
 * sessão anterior: queries sob ['user', id], carrinho/cotação do usuário,
 * mutations em cache, tentativa de compra e avisos de tempo real. A conexão
 * Socket.IO é recriada pelo hook `useRealtime` ao detectar a troca de token.
 */
export function installSessionSync() {
  sessionStore.onEnd((_reason, previousUserId) => {
    void queryClient.cancelQueries()
    if (previousUserId) {
      queryClient.removeQueries({ queryKey: ['user', previousUserId] })
      queryClient.removeQueries({ queryKey: ['cart', previousUserId] })
      queryClient.removeQueries({ queryKey: ['quote', previousUserId] })
    }
    queryClient.removeQueries({ queryKey: ['session'] })
    queryClient.getMutationCache().clear()
    clearAttempt()
    realtimeStore.clearNotices()
  })
}
