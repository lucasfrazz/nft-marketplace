import { useSyncExternalStore } from 'react'

export type RealtimeStatus = 'connecting' | 'online' | 'reconnecting' | 'offline'

export interface CartChangeNotice {
  id: string
  nftId: string
  name: string
  kind: 'price' | 'availability'
  from: string
  to: string
  at: number
}

interface State {
  status: RealtimeStatus
  notices: CartChangeNotice[]
}

let state: State = { status: 'connecting', notices: [] }
const listeners = new Set<() => void>()
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export const realtimeStore = {
  get: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  setStatus: (status: RealtimeStatus) => state.status !== status && set({ status }),
  pushNotice: (n: CartChangeNotice) => set({ notices: [...state.notices.filter((x) => !(x.nftId === n.nftId && x.kind === n.kind)), n].slice(-10) }),
  clearNotices: () => set({ notices: [] }),
}

export function useRealtimeState() {
  return useSyncExternalStore(realtimeStore.subscribe, realtimeStore.get, realtimeStore.get)
}
