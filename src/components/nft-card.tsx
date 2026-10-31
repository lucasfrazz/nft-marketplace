import { Link, useNavigate } from '@tanstack/react-router'
import { Heart, Search, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import type { NftSummary } from '@/api/contracts'
import { isApiError } from '@/api/http'
import { useAddToCart } from '@/features/cart/hooks'
import { useFavorites, useToggleFavorite } from '@/features/favorites/hooks'
import { useAuthUser } from '@/features/session/hooks'
import { announce } from '@/components/live-region'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { NftImage } from './nft-image'
import { Skeleton } from './common'

export function NftCard({ nft, priority = false, compact = false }: { nft: NftSummary; priority?: boolean; compact?: boolean }) {
  const user = useAuthUser()
  const navigate = useNavigate()
  const favorites = useFavorites()
  const toggle = useToggleFavorite()
  const addToCart = useAddToCart()
  const isFav = !!favorites.data?.ids.includes(nft.id)

  const onFavorite = () => {
    if (!user) {
      void navigate({ to: '/entrar', search: { redirect: window.location.pathname + window.location.search } })
      return
    }
    toggle.mutate({ nftId: nft.id, favorite: !isFav, name: nft.name })
  }
  const onAdd = () =>
    addToCart.mutate(
      { nftId: nft.id, editionId: '1-50', quantity: 1 },
      {
        onSuccess: () => {
          toast.success(`${nft.name} (1/50) adicionado ao carrinho.`)
          announce(`${nft.name} adicionado ao carrinho.`)
        },
        onError: (e) => toast.error(isApiError(e) ? e.message : 'Não foi possível adicionar ao carrinho.'),
      },
    )

  return (
    <article className="group relative flex flex-col" data-testid="nft-card" aria-labelledby={`nft-${nft.id}-name`}>
      <div className={cn('relative rounded-[6px] bg-surface', compact ? 'p-3' : 'p-3 md:p-4')}>
        {nft.rare && <span className="absolute top-3 left-0 z-10 bg-copper px-3 py-1 text-sm font-medium text-ink md:top-4">RARO</span>}
        <div className="overflow-hidden rounded-[16px]">
          <NftImage art={nft.image} alt={nft.imageAlt} priority={priority} sizes="(max-width: 768px) 45vw, 260px" width={320} className="transition-transform duration-300 group-hover:scale-[1.03]" />
        </div>
        <div className="absolute inset-x-0 bottom-1 z-20 flex justify-center gap-2 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          <button type="button" onClick={onAdd} disabled={addToCart.isPending || nft.available === 0} className="grid size-[34px] place-items-center rounded-[3px] bg-surface text-cream hover:text-copper disabled:opacity-50" aria-label={`Adicionar ${nft.name} ao carrinho`}>
            <ShoppingCart className="size-5" aria-hidden />
          </button>
          <button type="button" onClick={onFavorite} aria-pressed={isFav} className={cn('grid size-[34px] place-items-center rounded-[3px] bg-surface hover:text-copper', isFav ? 'text-copper' : 'text-cream')} aria-label={isFav ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`} data-testid="card-favorite">
            <Heart className="size-5" fill={isFav ? 'currentColor' : 'none'} aria-hidden />
          </button>
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="grid size-[34px] place-items-center rounded-[3px] bg-surface text-cream hover:text-copper" aria-label={`Ver detalhes de ${nft.name}`} tabIndex={-1}>
            <Search className="size-5" aria-hidden />
          </Link>
        </div>
      </div>
      <h3 id={`nft-${nft.id}-name`} className="mt-3 text-[15px] text-cream md:text-base">
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="after:absolute after:inset-0 after:content-[''] hover:text-copper-bright focus-visible:outline-none" data-testid="nft-card-link">
          {nft.name}
        </Link>
      </h3>
      <p className="text-base font-bold text-copper" data-testid="nft-price">
        <span className="sr-only">Preço: </span>
        {formatEth(nft.price)}
        {nft.previousPrice && (
          <s className="ml-2 font-normal text-sand-2">
            <span className="sr-only">Preço anterior: </span>
            {formatEth(nft.previousPrice)}
          </s>
        )}
      </p>
      {nft.available === 0 && <p className="text-xs text-coral">Esgotado</p>}
    </article>
  )
}

/** Skeleton com as mesmas dimensões do card (sem layout shift). */
export function NftCardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col" data-testid="nft-card-skeleton">
      <div className="rounded-[6px] bg-surface p-3 md:p-4">
        <Skeleton className="aspect-square w-full rounded-[16px]" />
      </div>
      <Skeleton className="mt-3 h-5 w-3/4" />
      <Skeleton className="mt-1.5 h-5 w-1/3" />
    </div>
  )
}
