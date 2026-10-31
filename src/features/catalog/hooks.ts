import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { NftListQuery } from '@/api/contracts'
import { catalogApi } from '@/api/endpoints'
import { qk } from '@/app/query-client'

/**
 * A chave inclui todos os parâmetros; o `signal` do TanStack Query cancela a
 * requisição obsoleta (Axios aborta), e respostas fora de ordem são
 * descartadas porque cada resposta só popula a sua própria chave.
 */
export function useNftList(query: NftListQuery) {
  return useQuery({
    queryKey: qk.nftList(query),
    queryFn: ({ signal }) => catalogApi.list(query, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useNftDetail(id: string) {
  return useQuery({
    queryKey: qk.nftDetail(id),
    queryFn: ({ signal }) => catalogApi.detail(id, { signal }),
  })
}

export function useRelated(id: string) {
  return useQuery({
    queryKey: qk.nftRelated(id),
    queryFn: ({ signal }) => catalogApi.related(id, { signal }),
    staleTime: 60_000,
  })
}

export function useHighlights() {
  return useQuery({
    queryKey: qk.highlights(),
    queryFn: ({ signal }) => catalogApi.highlights({ signal }),
    staleTime: 5 * 60_000,
  })
}
