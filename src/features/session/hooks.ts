import { useMutation, useQuery } from '@tanstack/react-query'
import type { LoginRequest, Session, SignupRequest } from '@/api/contracts'
import { authApi } from '@/api/endpoints'
import { queryClient, qk } from '@/app/query-client'
import { getGuestCartId, resetGuestCartId, sessionStore, useSession } from './session-store'

export function useAuthUser() {
  return useSession().user
}

/** Dono do carrinho: usuário autenticado ou visitante. */
export function useCartOwner() {
  const { user } = useSession()
  return user ? user.id : `guest:${getGuestCartId()}`
}

function onAuthenticated(session: Session, guestOwner: string) {
  sessionStore.start(session)
  // O carrinho do visitante foi mesclado no servidor — descarta o cache local.
  queryClient.removeQueries({ queryKey: qk.cart(guestOwner) })
  queryClient.removeQueries({ queryKey: qk.quotes(guestOwner) })
  resetGuestCartId()
}

export function useLogin() {
  return useMutation({
    mutationFn: (body: Omit<LoginRequest, 'guestCartId'>) => authApi.login({ ...body, guestCartId: getGuestCartId() }),
    onSuccess: (session) => onAuthenticated(session, `guest:${getGuestCartId()}`),
  })
}

export function useSignup() {
  return useMutation({
    mutationFn: (body: Omit<SignupRequest, 'guestCartId'>) => authApi.signup({ ...body, guestCartId: getGuestCartId() }),
    onSuccess: (session) => onAuthenticated(session, `guest:${getGuestCartId()}`),
  })
}

export function useLogout() {
  return useMutation({
    mutationFn: () => authApi.logout(),
    // Mesmo se a API falhar, a sessão local é encerrada.
    onSettled: () => sessionStore.end('logout'),
  })
}

/**
 * Valida a sessão persistida no boot e mantém o usuário sincronizado.
 * Em 401 o interceptor encerra a sessão (motivo: expired).
 */
export function useSessionValidation() {
  const { token, user } = useSession()
  return useQuery({
    queryKey: ['session', token],
    enabled: !!token,
    queryFn: async ({ signal }) => {
      const s = await authApi.session({ signal })
      if (user && s.user.version !== user.version) sessionStore.updateUser(s.user)
      return s
    },
    staleTime: 60_000,
    retry: false,
  })
}
