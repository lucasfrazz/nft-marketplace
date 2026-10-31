import { useMutation, useQuery } from '@tanstack/react-query'
import type { Cart, CartItemInput, Network } from '@/api/contracts'
import { cartApi } from '@/api/endpoints'
import { queryClient, qk } from '@/app/query-client'
import { useCartOwner } from '@/features/session/hooks'

export function useCart() {
  const owner = useCartOwner()
  return useQuery({
    queryKey: qk.cart(owner),
    queryFn: ({ signal }) => cartApi.get({ signal }),
    staleTime: 10_000,
  })
}

export function useCartCount() {
  const { data } = useCart()
  return data?.items.reduce((s, i) => s + i.quantity, 0) ?? 0
}

/**
 * Cotação: a API é a referência de preço, desconto, taxa e total.
 * A chave inclui a versão do carrinho — qualquer alteração gera nova cotação.
 */
export function useQuote(network: Network, enabled = true) {
  const owner = useCartOwner()
  const cart = useCart()
  return useQuery({
    queryKey: [...qk.quote(owner, network), cart.data?.version ?? 0],
    queryFn: ({ signal }) => cartApi.quote({ network }, { signal }),
    enabled: enabled && !!cart.data && cart.data.items.length > 0,
    staleTime: 0,
    placeholderData: (prev) => prev,
  })
}

function useCartMutation<TVars>(fn: (vars: TVars) => Promise<Cart>) {
  const owner = useCartOwner()
  return useMutation({
    mutationFn: fn,
    onSuccess: (cart) => {
      queryClient.setQueryData(qk.cart(owner), cart)
      void queryClient.invalidateQueries({ queryKey: qk.quotes(owner) })
    },
    onError: () => {
      // Conflitos de disponibilidade: ressincroniza o carrinho com a API.
      void queryClient.invalidateQueries({ queryKey: qk.cart(owner) })
    },
  })
}

export const useAddToCart = () => useCartMutation((v: CartItemInput) => cartApi.add(v))
export const useSetQuantity = () => useCartMutation((v: { nftId: string; editionId: string; quantity: number }) => cartApi.setQuantity(v.nftId, v.editionId, v.quantity))
export const useRemoveItem = () => useCartMutation((v: { nftId: string; editionId: string }) => cartApi.remove(v.nftId, v.editionId))
export const useApplyCoupon = () => useCartMutation((code: string) => cartApi.applyCoupon(code))
export const useRemoveCoupon = () => useCartMutation(() => cartApi.removeCoupon())
export const useAcknowledgeChanges = () => useCartMutation(() => cartApi.acknowledge())
