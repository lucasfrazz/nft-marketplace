import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { CircleAlert, Download, Heart, LogOut, MapPin, ShoppingCart, TrendingUp, User } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLogout } from '@/features/session/hooks'
import { notAvailable } from '@/lib/out-of-scope'

const item = 'flex items-center gap-3 border-l-[6px] border-transparent px-4 py-2.5 text-[15px] text-copper hover:bg-surface-2'
const active = { className: 'border-copper! bg-surface-2/60 font-bold' }

function Soon({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <li>
      <button type="button" className={`${item} w-full text-left`} onClick={() => notAvailable(label)}>
        {icon} {label}
        <span className="ml-auto rounded-[3px] border border-line-strong px-1.5 text-[10px] text-sand-2">em breve</span>
      </button>
    </li>
  )
}

export function AccountLayout() {
  const logout = useLogout()
  const navigate = useNavigate()
  return (
    <div className="grid gap-8 pt-8 md:grid-cols-[310px_1fr]">
      <nav aria-label="Meu perfil" className="h-fit bg-surface py-3">
        <h1 className="px-3 pb-2 text-lg font-bold text-cream">Meu perfil</h1>
        <ul className="grid grid-cols-2 md:block">
          <li>
            <Link to="/conta/perfil" className={item} activeProps={active}>
              <User className="size-4" aria-hidden /> Dados do perfil
            </Link>
          </li>
          <li>
            <Link to="/conta/carteiras" className={item} activeProps={active}>
              <MapPin className="size-4" aria-hidden /> Carteiras
            </Link>
          </li>
          <li>
            <Link to="/conta/colecao" className={item} activeProps={active}>
              <ShoppingCart className="size-4" aria-hidden /> Minha coleção
            </Link>
          </li>
          <li>
            <Link to="/conta/favoritos" className={item} activeProps={active}>
              <Heart className="size-4" aria-hidden /> Lista de interesse
            </Link>
          </li>
          <Soon icon={<TrendingUp className="size-4" aria-hidden />} label="Ofertas" />
          <Soon icon={<Download className="size-4" aria-hidden />} label="Arquivos baixados" />
          <Soon icon={<CircleAlert className="size-4" aria-hidden />} label="Suporte" />
        </ul>
        <div className="mt-1 border-t border-line pt-1">
          <button type="button" onClick={() => logout.mutate(undefined, { onSettled: () => navigate({ to: '/' }) })} className={`${item} w-full font-bold`} data-testid="account-logout">
            <LogOut className="size-4" aria-hidden /> Sair
          </button>
        </div>
      </nav>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
