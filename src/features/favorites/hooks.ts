import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { FavoritesResponse } from '@/api/contracts'
import { favoritesApi } from '@/api/endpoints'
import { queryClient, qk } from '@/app/query-client'
import { useAuthUser } from '@/features/session/hooks'
import { announce } from '@/components/live-region'

export function useFavorites() {
  const user = useAuthUser()
  return useQuery({
    queryKey: qk.favorites(user?.id ?? 'anon'),
    queryFn: ({ signal }) => favoritesApi.list({ signal }),
    enabled: !!user,
  })
}

/**
 * Atualização otimista com rollback: o coração muda imediatamente; se a
 * mutation falhar, o cache volta ao snapshot anterior e o erro é anunciado.
 */
export function useToggleFavorite() {
  const user = useAuthUser()
  return useMutation({
    mutationKey: ['favorite-toggle'],
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) => (favorite ? favoritesApi.add(nftId) : favoritesApi.remove(nftId)),
    onMutate: async ({ nftId, favorite }) => {
      if (!user) return { previous: undefined }
      const key = qk.favorites(user.id)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<FavoritesResponse>(key)
      queryClient.setQueryData<FavoritesResponse>(key, (old) => {
        const base = old ?? { ids: [], items: [] }
        return favorite
          ? { ...base, ids: base.ids.includes(nftId) ? base.ids : [nftId, ...base.ids] }
          : { ids: base.ids.filter((id) => id !== nftId), items: base.items.filter((i) => i.id !== nftId) }
      })
      return { previous }
    },
    onError: (_err, vars, ctx) => {
      if (user) queryClient.setQueryData(qk.favorites(user.id), ctx?.previous)
      const msg = `Não foi possível ${vars.favorite ? 'favoritar' : 'remover dos favoritos'} "${vars.name}". O estado anterior foi restaurado.`
      toast.error(msg)
      announce(msg)
    },
    onSuccess: (data, vars) => {
      if (user) queryClient.setQueryData(qk.favorites(user.id), data)
      announce(vars.favorite ? `${vars.name} adicionado aos favoritos.` : `${vars.name} removido dos favoritos.`)
    },
  })
}
