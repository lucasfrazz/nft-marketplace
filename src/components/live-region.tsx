/**
 * Região aria-live global para anunciar mutations e alterações em tempo real
 * a leitores de tela (complementa os toasts visuais).
 */
import { useSyncExternalStore } from 'react'

let message = ''
let seq = 0
const listeners = new Set<() => void>()

export function announce(text: string) {
  seq++
  // Alterna um caractere invisível para forçar novo anúncio de texto repetido.
  message = text + (seq % 2 ? '​' : '')
  listeners.forEach((l) => l())
}

export function LiveRegion() {
  const text = useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => message,
  )
  return (
    <div aria-live="polite" aria-atomic="true" role="status" className="sr-only" data-testid="live-region">
      {text}
    </div>
  )
}
