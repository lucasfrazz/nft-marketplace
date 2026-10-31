/**
 * Store de sessão (fora do React) — fonte única do token e do usuário.
 * Persistida em localStorage para recuperar a sessão após refresh; a validade
 * é sempre confirmada pela API (`GET /auth/session`) no boot.
 */
import { useSyncExternalStore } from 'react'
import type { Session, User } from '@/api/contracts'

export type SessionEndReason = 'logout' | 'expired' | 'switch'

interface State {
  token: string | null
  user: User | null
  /** Motivo do último encerramento (para mensagens na tela de login). */
  endedBy: SessionEndReason | null
}

const KEY = 'kurio.session.v1'
const CART_KEY = 'kurio.guestCart.v1'

function read(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as { token: string; user: User }
      if (s.token && s.user) return { token: s.token, user: s.user, endedBy: null }
    }
  } catch {
    /* ignore */
  }
  return { token: null, user: null, endedBy: null }
}

let state: State = read()
const listeners = new Set<() => void>()
type EndListener = (reason: SessionEndReason, previousUserId: string | null) => void
const endListeners = new Set<EndListener>()

function emit() {
  listeners.forEach((l) => l())
}

function persist() {
  try {
    if (state.token && state.user) localStorage.setItem(KEY, JSON.stringify({ token: state.token, user: state.user }))
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export const sessionStore = {
  get: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
  /** Notificado quando a sessão termina (logout, expiração ou troca de usuário). */
  onEnd(fn: EndListener) {
    endListeners.add(fn)
    return () => {
      endListeners.delete(fn)
    }
  },
  start(session: Session) {
    const previous = state.user?.id ?? null
    if (previous && previous !== session.user.id) endListeners.forEach((l) => l('switch', previous))
    state = { token: session.token, user: session.user, endedBy: null }
    persist()
    emit()
  },
  updateUser(user: User) {
    if (!state.user || state.user.id !== user.id) return
    state = { ...state, user }
    persist()
    emit()
  },
  end(reason: SessionEndReason) {
    if (!state.token) return
    const previous = state.user?.id ?? null
    state = { token: null, user: null, endedBy: reason }
    persist()
    endListeners.forEach((l) => l(reason, previous))
    emit()
  },
  clearReason() {
    if (state.endedBy) {
      state = { ...state, endedBy: null }
      emit()
    }
  },
}

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get)
}

/** Identificador do carrinho de visitante (gerado no cliente). */
export function getGuestCartId(): string {
  try {
    let id = localStorage.getItem(CART_KEY)
    if (!id) {
      id = `g_${crypto.randomUUID().replace(/-/g, '')}`
      localStorage.setItem(CART_KEY, id)
    }
    return id
  } catch {
    return 'g_ephemeral_cart'
  }
}

export function resetGuestCartId() {
  try {
    localStorage.removeItem(CART_KEY)
  } catch {
    /* ignore */
  }
}
