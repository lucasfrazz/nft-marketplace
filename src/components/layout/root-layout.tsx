import { lazy, Suspense, useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { LiveRegion, announce } from '@/components/live-region'
import { useRealtime } from '@/features/realtime/use-realtime'
import { useRealtimeState } from '@/features/realtime/store'
import { useSessionValidation } from '@/features/session/hooks'
import { sessionStore } from '@/features/session/session-store'
import { SiteHeader } from './site-header'
import { SiteFooter } from './site-footer'
import { MobileNav } from './mobile-nav'

const MockLab = import.meta.env.VITE_ENABLE_MOCKS === 'true' ? lazy(() => import('@/components/dev/mock-lab')) : null

const PRIVATE = /^\/(pagamento|pedidos|conta)/

export function RootLayout() {
  useRealtime()
  useSessionValidation()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { status } = useRealtimeState()

  useEffect(
    () =>
      sessionStore.onEnd((reason) => {
        if (reason !== 'expired') return
        const msg = 'Sua sessão expirou. Entre novamente para continuar de onde parou.'
        announce(msg)
        const here = window.location.pathname + window.location.search
        if (PRIVATE.test(window.location.pathname)) {
          void navigate({ to: '/entrar', search: { redirect: here, reason: 'expired' }, replace: true })
        } else {
          toast.warning(msg)
        }
      }),
    [navigate],
  )

  // Move o foco para o conteúdo principal ao trocar de página (leitores de
  // tela). No carregamento inicial o foco fica no documento, para que o 1º
  // Tab alcance o link "Pular para o conteúdo".
  const lastPath = useRef(pathname)
  useEffect(() => {
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    document.getElementById('conteudo')?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <div className="min-h-dvh overflow-x-clip px-4 md:px-8">
      <a href="#conteudo" className="sr-only z-50 rounded bg-copper px-3 py-2 text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Pular para o conteúdo
      </a>
      <SiteHeader />
      {status === 'reconnecting' && (
        <p role="status" className="mx-auto mt-2 max-w-[1200px] rounded-[3px] border border-copper/50 bg-band px-3 py-1.5 text-xs text-sand" data-testid="realtime-reconnecting">
          Reconectando ao tempo real… os dados serão sincronizados ao voltar.
        </p>
      )}
      <main id="conteudo" tabIndex={-1} className="mx-auto min-h-[calc(100dvh-69px)] w-full max-w-[1200px] outline-none">
        <Outlet />
      </main>
      <SiteFooter />
      <MobileNav />
      <Toaster position="top-center" richColors={false} closeButton />
      <LiveRegion />
      {MockLab && (
        <Suspense fallback={null}>
          <MockLab />
        </Suspense>
      )}
    </div>
  )
}
