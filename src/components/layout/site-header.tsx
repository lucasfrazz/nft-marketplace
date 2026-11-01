import { lazy, Suspense } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { LogIn, Search, ShoppingCart, User as UserIcon } from 'lucide-react'
import { userMenuTriggerClass } from './user-menu-class'
import { useCartCount } from '@/features/cart/hooks'
import { useAuthUser } from '@/features/session/hooks'
import { notAvailable } from '@/lib/out-of-scope'
import { cn } from '@/lib/utils'

const UserMenu = lazy(() => import('./user-menu'))

const navItem = 'relative inline-flex h-[45px] items-start pt-0.5 text-base text-cream transition-colors hover:text-copper-bright'
const activeBar = 'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-copper text-copper font-bold'

export function SiteHeader() {
  const { pathname } = useLocation()
  const user = useAuthUser()
  const count = useCartCount()
  const marketActive = /^\/(nft|carrinho|pagamento|pedidos)/.test(pathname)
  const homeActive = !marketActive

  return (
    <header className="mx-auto hidden w-full max-w-[1200px] items-start justify-between border-b border-line pt-3 md:flex" style={{ minHeight: 69 }}>
      <Link to="/" className="mt-2 text-sm font-bold lg:w-40 tracking-[0.1em] text-cream" aria-label="Kurio — página inicial">
        KURIO
      </Link>

      <nav aria-label="Principal" className="flex gap-5 lg:gap-9">
        <Link to="/" className={cn(navItem, homeActive && activeBar)} aria-current={homeActive ? 'page' : undefined}>
          Início
        </Link>
        <Link to="/" hash="catalogo" className={cn(navItem, marketActive && activeBar)} aria-current={marketActive ? 'page' : undefined}>
          Mercado
        </Link>
        <button type="button" className={navItem} onClick={() => notAvailable('A seção Criadores')}>
          Criadores
        </button>
        <button type="button" className={navItem} onClick={() => notAvailable('A seção Aprenda')}>
          Aprenda
        </button>
      </nav>

      <div className="flex items-center justify-end gap-3 lg:w-52 lg:gap-5">
        <Link
          to="/"
          hash="catalogo"
          search={(s) => s}
          aria-label="Buscar NFTs"
          className="rounded p-1 text-cream hover:text-copper-bright"
          onClick={() => setTimeout(() => document.getElementById('catalog-search')?.focus(), 50)}
        >
          <Search className="size-5" aria-hidden />
        </Link>
        <Link to="/carrinho" className="relative rounded p-1 text-cream hover:text-copper-bright" aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`} data-testid="header-cart">
          <ShoppingCart className="size-6" aria-hidden />
          <span aria-hidden className="absolute -top-0.5 -right-1 grid min-w-4 place-items-center rounded-full bg-copper px-1 text-[10px] leading-4 font-medium text-ink" data-testid="cart-count">
            {count}
          </span>
        </Link>
        {user ? (
          <Suspense
            fallback={
              <span className={userMenuTriggerClass} aria-hidden>
                <UserIcon className="size-4" />
                <span className="truncate">{user.displayName}</span>
              </span>
            }
          >
            <UserMenu user={user} />
          </Suspense>
        ) : (
          <Link
            to="/entrar"
            search={{ redirect: pathname === '/entrar' ? undefined : window.location.pathname + window.location.search }}
            className="flex h-[35px] items-center gap-1 rounded-[3px] bg-copper px-2.5 text-base font-medium text-ink hover:bg-copper-bright"
          >
            <LogIn className="size-5" aria-hidden /> Entrar
          </Link>
        )}
      </div>
    </header>
  )
}
