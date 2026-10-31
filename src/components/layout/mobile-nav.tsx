import { Link, useLocation } from '@tanstack/react-router'
import { Heart, House, ScanLine, ShoppingCart, User } from 'lucide-react'
import { useCartCount } from '@/features/cart/hooks'
import { useAuthUser } from '@/features/session/hooks'
import { notAvailable } from '@/lib/out-of-scope'
import { cn } from '@/lib/utils'

/** Barra inferior do layout mobile (frame "Mobile / Início"). */
export function MobileNav() {
  const { pathname } = useLocation()
  const user = useAuthUser()
  const count = useCartCount()
  const item = (active: boolean) => cn('grid size-11 place-items-center rounded-full', active ? 'text-copper' : 'text-sand')
  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="relative mx-auto flex h-[74px] max-w-[480px] items-center justify-between rounded-t-[37px] bg-surface px-8">
        <Link to="/" className={item(pathname === '/')} aria-label="Início" aria-current={pathname === '/' ? 'page' : undefined}>
          <House className="size-6" fill="currentColor" aria-hidden />
        </Link>
        <Link to={user ? '/conta/favoritos' : '/entrar'} search={user ? undefined : { redirect: '/conta/favoritos' }} className={item(pathname === '/conta/favoritos')} aria-label="Favoritos">
          <Heart className="size-6" fill="currentColor" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={() => notAvailable('O leitor de QR code')}
          className="-mt-14 grid size-16 place-items-center rounded-full border-4 border-ink bg-gradient-to-br from-copper to-[#a8693a] text-cream shadow-lg"
          aria-label="Ler QR code (indisponível)"
        >
          <ScanLine className="size-6" aria-hidden />
        </button>
        <Link to="/carrinho" className={cn(item(pathname === '/carrinho'), 'relative')} aria-label={`Carrinho, ${count} itens`}>
          <ShoppingCart className="size-6" aria-hidden />
          {count > 0 && <span aria-hidden className="absolute top-1 right-0 grid min-w-4 place-items-center rounded-full bg-copper px-1 text-[10px] leading-4 text-ink">{count}</span>}
        </Link>
        <Link to={user ? '/conta/perfil' : '/entrar'} className={item(pathname.startsWith('/conta'))} aria-label={user ? 'Minha conta' : 'Entrar'}>
          <User className="size-6" fill="currentColor" aria-hidden />
        </Link>
      </div>
    </nav>
  )
}
