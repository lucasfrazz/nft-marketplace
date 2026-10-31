import { QueryClient } from '@tanstack/react-query'
import type { NftListQuery, Network, OrderStatus } from '@/api/contracts'
import { isApiError } from '@/api/http'

/**
 * Política de cache/retry (documentada no ARCHITECTURE.md):
 * - Queries: até 2 novas tentativas apenas para falhas transitórias (rede,
 *   timeout, 5xx), backoff exponencial 400ms→1.6s; 4xx nunca são repetidos.
 * - Mutations: sem retry automático (evita duplicar operações). O pedido
 *   tem recuperação própria via chave de idempotência.
 * - staleTime padrão 30s; catálogo usa `placeholderData` para manter a
 *   página anterior visível enquanto a nova carrega (sem layout shift).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => isApiError(error) && error.isTransient && failureCount < 2,
      retryDelay: (attempt) => Math.min(400 * 2 ** attempt, 1600),
    },
    mutations: { retry: false },
  },
})

/**
 * Chaves de query. Dados privados ficam SEMPRE sob `['user', userId, ...]`
 * e o carrinho sob `['cart', ownerKey]`, garantindo isolamento por usuário
 * e limpeza seletiva no logout/troca de usuário.
 */
export const qk = {
  nftList: (q: NftListQuery) => ['nfts', 'list', q] as const,
  nftLists: () => ['nfts', 'list'] as const,
  nftDetail: (id: string) => ['nfts', 'detail', id] as const,
  nftRelated: (id: string) => ['nfts', 'related', id] as const,
  highlights: () => ['highlights'] as const,
  user: (userId: string) => ['user', userId] as const,
  favorites: (userId: string) => ['user', userId, 'favorites'] as const,
  profile: (userId: string) => ['user', userId, 'profile'] as const,
  wallets: (userId: string) => ['user', userId, 'wallets'] as const,
  order: (userId: string, orderId: string) => ['user', userId, 'order', orderId] as const,
  orders: (userId: string, status?: OrderStatus) => ['user', userId, 'orders', status ?? 'all'] as const,
  cart: (owner: string) => ['cart', owner] as const,
  quote: (owner: string, network: Network) => ['quote', owner, network] as const,
  quotes: (owner: string) => ['quote', owner] as const,
}
