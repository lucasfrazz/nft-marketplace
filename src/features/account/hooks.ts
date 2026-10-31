import { useMutation, useQuery } from '@tanstack/react-query'
import type { Network, ProfileUpdateRequest, User, WalletInput, WalletProvider, WalletSlot, WalletsResponse } from '@/api/contracts'
import { profileApi, walletsApi } from '@/api/endpoints'
import { queryClient, qk } from '@/app/query-client'
import { useAuthUser } from '@/features/session/hooks'
import { sessionStore } from '@/features/session/session-store'

export function useProfile() {
  const user = useAuthUser()
  return useQuery({
    queryKey: qk.profile(user?.id ?? 'anon'),
    queryFn: ({ signal }) => profileApi.get({ signal }),
    enabled: !!user,
  })
}

function onUser(user: User) {
  queryClient.setQueryData(qk.profile(user.id), user)
  sessionStore.updateUser(user)
}

export const useUpdateProfile = () => useMutation({ mutationFn: (b: ProfileUpdateRequest) => profileApi.update(b), onSuccess: onUser })
export const useSetAvatar = () => useMutation({ mutationFn: (dataUrl: string) => profileApi.setAvatar({ dataUrl }), onSuccess: onUser })
export const useRemoveAvatar = () => useMutation({ mutationFn: () => profileApi.removeAvatar(), onSuccess: onUser })
export const useChangePassword = () => useMutation({ mutationFn: profileApi.changePassword })

export function useWallets() {
  const user = useAuthUser()
  return useQuery({
    queryKey: qk.wallets(user?.id ?? 'anon'),
    queryFn: ({ signal }) => walletsApi.get({ signal }),
    enabled: !!user,
  })
}

function useWalletMutation<V>(fn: (v: V) => Promise<WalletsResponse>) {
  const user = useAuthUser()
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      if (user) queryClient.setQueryData(qk.wallets(user.id), data)
    },
  })
}

export const useSaveWallet = () => useWalletMutation((v: { slot: WalletSlot; body: WalletInput | { sameAsPrimary: true } }) => walletsApi.save(v.slot, v.body))
export const useConnectWallet = () => useWalletMutation((v: { slot: WalletSlot; provider: WalletProvider; network: Network }) => walletsApi.connect(v.slot, { provider: v.provider, network: v.network }))
export const useDisconnectWallet = () => useWalletMutation((slot: WalletSlot) => walletsApi.disconnect(slot))
