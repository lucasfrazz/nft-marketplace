import { useNavigate } from '@tanstack/react-router'
import { User as UserIcon } from 'lucide-react'
import type { User } from '@/api/contracts'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useLogout } from '@/features/session/hooks'
import { userMenuTriggerClass } from './user-menu-class'

/** Menu do usuário (carregado sob demanda — tira Radix Menu/Popper do bundle inicial). */
export default function UserMenu({ user }: { user: User }) {
  const navigate = useNavigate()
  const logout = useLogout()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={userMenuTriggerClass} data-testid="user-menu">
        {user.avatar ? <img src={user.avatar} alt="" className="size-6 rounded-full object-cover" /> : <UserIcon className="size-4" aria-hidden />}
        <span className="truncate">{user.displayName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 border-line bg-surface">
        <DropdownMenuLabel className="truncate text-sand">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate({ to: '/conta/perfil' })}>Meu perfil</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: '/conta/carteiras' })}>Carteiras</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: '/conta/colecao' })}>Minha coleção</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate({ to: '/conta/favoritos' })}>Lista de interesse</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout.mutate(undefined, { onSettled: () => navigate({ to: '/' }) })} data-testid="logout">
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
