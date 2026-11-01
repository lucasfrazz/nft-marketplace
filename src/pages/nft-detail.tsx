import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { ChevronLeft, Heart, Mail, Search, ShoppingCart, Star } from 'lucide-react'
import { toast } from 'sonner'
import type { NftDetail } from '@/api/contracts'
import { isApiError } from '@/api/http'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Breadcrumb, ErrorState, QuantityStepper, SectionTitle, Skeleton } from '@/components/common'
import { LinkedinIcon, TwitterIcon } from '@/components/brand-icons'
import { NftImage } from '@/components/nft-image'
import { NftRail } from '@/components/nft-rail'
import { announce } from '@/components/live-region'
import { useAddToCart, useCart } from '@/features/cart/hooks'
import { useNftDetail, useRelated } from '@/features/catalog/hooks'
import { useFavorites, useToggleFavorite } from '@/features/favorites/hooks'
import { useAuthUser } from '@/features/session/hooks'
import { labelNetwork } from '@/lib/labels'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { NotFoundPage } from './not-found'

export function NftDetailPage() {
  const { nftId } = useParams({ from: '/nft/$nftId' })
  const detail = useNftDetail(nftId)

  if (detail.isPending) return <DetailSkeleton />
  if (detail.isError) {
    if (isApiError(detail.error) && detail.error.status === 404) return <NotFoundPage title="NFT não encontrado" message="Este NFT não existe ou foi removido do catálogo." />
    return (
      <div className="py-16">
        <ErrorState message={detail.error.message} onRetry={() => void detail.refetch()} retrying={detail.isFetching} />
      </div>
    )
  }
  return <DetailView nft={detail.data} />
}

function DetailView({ nft }: { nft: NftDetail }) {
  const search = useSearch({ from: '/nft/$nftId' })
  const navigate = useNavigate({ from: '/nft/$nftId' })
  const user = useAuthUser()
  const cart = useCart()
  const favorites = useFavorites()
  const toggleFav = useToggleFavorite()
  const addToCart = useAddToCart()
  const related = useRelated(nft.id)
  const [activeImage, setActiveImage] = useState(0)
  const [zoom, setZoom] = useState(false)
  const [tab, setTab] = useState<'details' | 'reviews'>('details')

  const firstAvailable = nft.editions.find((e) => e.id === '1-50' && e.available > 0) ?? nft.editions.find((e) => e.available > 0) ?? nft.editions[0]
  const edition = nft.editions.find((e) => e.id === search.edition) ?? firstAvailable
  const inCart = cart.data?.items.find((i) => i.nftId === nft.id && i.editionId === edition.id)?.quantity ?? 0
  const limit = Math.max(0, Math.min(edition.available, edition.maxPerOrder) - inCart)
  const [qty, setQty] = useState(1)
  useEffect(() => setQty((q) => Math.max(1, Math.min(q, limit || 1))), [limit, edition.id])

  const isFav = !!favorites.data?.ids.includes(nft.id)
  const soldOut = edition.available === 0

  const onFavorite = () => {
    if (!user) return void navigate({ to: '/entrar', search: { redirect: window.location.pathname + window.location.search } })
    toggleFav.mutate({ nftId: nft.id, favorite: !isFav, name: nft.name })
  }

  const add = (then?: 'cart') =>
    addToCart.mutate(
      { nftId: nft.id, editionId: edition.id, quantity: qty },
      {
        onSuccess: () => {
          const msg = `${qty}× ${nft.name} (${edition.label}) adicionado ao carrinho.`
          announce(msg)
          if (then === 'cart') void navigate({ to: '/carrinho' })
          else toast.success(msg)
        },
        onError: (e) => toast.error(isApiError(e) ? e.message : 'Não foi possível adicionar ao carrinho.'),
      },
    )

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const shareText = encodeURIComponent(`${nft.name} na Kurio`)

  return (
    <article className="pt-4 md:pt-7" aria-labelledby="nft-title">
      <div className="hidden md:block">
        <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/' }]} />
      </div>
      {/* Barra mobile */}
      <div className="flex items-center justify-between md:hidden">
        <button type="button" onClick={() => history.length > 1 ? history.back() : navigate({ to: '/' })} className="grid size-9 place-items-center rounded-full border border-line text-sand" aria-label="Voltar">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <button type="button" onClick={onFavorite} aria-pressed={isFav} className={cn('grid size-9 place-items-center rounded-full border border-line', isFav ? 'text-copper' : 'text-sand')} aria-label={isFav ? 'Remover dos favoritos' : 'Favoritar'}>
          <Heart className="size-5" fill={isFav ? 'currentColor' : 'none'} aria-hidden />
        </button>
      </div>

      <div className="mt-3 grid gap-6 lg:grid-cols-[100px_395px_1fr] lg:gap-[26px]">
        {/* Miniaturas */}
        <ul className="hidden flex-col gap-4 lg:flex" aria-label="Galeria">
          {nft.gallery.map((art, i) => (
            <li key={i}>
              <button type="button" onClick={() => setActiveImage(i)} aria-pressed={activeImage === i} aria-label={`Imagem ${i + 1} de ${nft.gallery.length}`} className={cn('block overflow-hidden rounded-[6px] border-2', activeImage === i ? 'border-copper' : 'border-transparent')}>
                <NftImage art={art} alt="" width={160} sizes="100px" />
              </button>
            </li>
          ))}
        </ul>

        {/* Imagem principal */}
        <div className="relative rounded-[6px] md:bg-surface md:p-5">
          <NftImage art={nft.gallery[activeImage] ?? nft.image} alt={nft.imageAlt} priority width={640} sizes="(max-width: 768px) 92vw, 360px" className="rounded-[16px]" />
          <button type="button" onClick={() => setZoom(true)} className="absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-ink/80 text-cream md:top-1 md:right-1" aria-label="Ampliar imagem">
            <Search className="size-5" aria-hidden />
          </button>
        </div>

        {/* Informações */}
        <div className="-mx-4 rounded-t-[30px] bg-surface px-6 pt-6 pb-4 md:mx-0 md:rounded-none md:bg-transparent md:p-0">
          <div className="flex items-start justify-between gap-4">
            <h1 id="nft-title" className="text-xl font-bold tracking-[0.04em] text-cream md:text-[28px]">
              {nft.name}
            </h1>
            <span className="flex shrink-0 items-center gap-1 rounded-full border border-copper px-2 py-0.5 text-sm text-cream md:hidden">
              <Star className="size-3.5 text-copper" fill="currentColor" aria-hidden /> <b>{nft.rating.toFixed(1)}</b>({nft.reviewsCount})
            </span>
          </div>
          <div className="mt-2 hidden items-center justify-between border-b border-line pb-3 md:flex">
            <p className="text-[22px] font-medium text-copper" data-testid="detail-price">
              {formatEth(edition.price)}
            </p>
            <p className="flex items-center gap-1 text-sm text-cream">
              <span className="flex text-copper" aria-hidden>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className="size-3.5" fill="currentColor" />
                ))}
              </span>
              <span>
                <span className="sr-only">Nota {nft.rating.toFixed(1)} de 5, </span>
                {nft.reviewsCount} avaliações de colecionadores
              </span>
            </p>
          </div>

          <h2 className="mt-4 hidden text-[15px] font-bold text-cream md:block">Sobre este NFT:</h2>
          <p className="mt-2 text-[15px] leading-6 text-sand">{nft.description}</p>

          <fieldset className="mt-3">
            <legend className="text-[15px] font-bold text-cream">Edição:</legend>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Edição">
              {nft.editions.map((e) => {
                const selected = e.id === edition.id
                const unavailable = e.available === 0
                return (
                  <button
                    key={e.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-disabled={unavailable}
                    onClick={() => !unavailable && navigate({ search: { edition: e.id }, replace: true, resetScroll: false })}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-sm transition',
                      selected ? 'border-copper font-bold text-copper' : 'border-line-strong text-sand hover:border-copper',
                      unavailable && 'cursor-not-allowed line-through opacity-60 hover:border-line-strong',
                    )}
                    data-testid={`edition-${e.id}`}
                  >
                    {e.label}
                    {unavailable && <span className="sr-only"> (esgotada)</span>}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-sand-2" data-testid="edition-availability">
              {soldOut ? 'Edição esgotada — escolha outra edição.' : `${edition.available} disponível(is) · máximo de ${edition.maxPerOrder} por pedido${inCart ? ` · ${inCart} no seu carrinho` : ''}.`}
            </p>
          </fieldset>

          {/* Desktop: quantidade + ações */}
          <div className="mt-4 hidden items-center justify-between md:flex">
            <QuantityStepper value={qty} max={Math.max(1, limit)} onChange={setQty} label={nft.name} disabled={soldOut || limit === 0} />
            <div className="flex gap-2">
              <button type="button" onClick={() => add('cart')} disabled={soldOut || limit === 0 || addToCart.isPending} className="h-9 w-[116px] rounded-[3px] bg-copper text-sm font-bold text-ink hover:bg-copper-bright disabled:opacity-50" data-testid="buy">
                {addToCart.isPending ? 'ADICIONANDO…' : 'COMPRAR'}
              </button>
              <button type="button" onClick={onFavorite} aria-pressed={isFav} className="flex h-9 items-center gap-2 rounded-[3px] border border-copper px-3 text-sm text-copper hover:bg-copper/10" data-testid="favorite">
                <Heart className="size-5" fill={isFav ? 'currentColor' : 'none'} aria-hidden /> {isFav ? 'Favoritado' : 'Favoritar'}
              </button>
            </div>
          </div>
          {limit === 0 && !soldOut && <p className="mt-2 text-xs text-coral">Você atingiu o limite desta edição no carrinho.</p>}

          <dl className="mt-4 space-y-2 text-[15px] text-sand">
            <div className="flex gap-1">
              <dt>ID do token:</dt>
              <dd>{nft.tokenId}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Coleção:</dt>
              <dd>{nft.collectionName}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Atributos:</dt>
              <dd>{nft.attributes.join(', ')}</dd>
            </div>
          </dl>
          <div className="mt-3 hidden items-center gap-3 text-[15px] font-bold text-cream md:flex">
            Compartilhar este NFT:
            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no LinkedIn (abre em nova aba)">
              <LinkedinIcon className="size-4" />
            </a>
            <a href={`mailto:?subject=${shareText}&body=${encodeURIComponent(shareUrl)}`} aria-label="Compartilhar por e-mail">
              <Mail className="size-4" aria-hidden />
            </a>
            <a href={`https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no Twitter (abre em nova aba)">
              <TwitterIcon className="size-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Mobile: barra de compra */}
      <div className="sticky bottom-[74px] z-30 -mx-4 rounded-t-[30px] bg-surface px-6 pt-4 pb-5 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[15px] text-sand">Qtd.</span>
            <QuantityStepper size="sm" value={qty} max={Math.max(1, limit)} onChange={setQty} label={nft.name} disabled={soldOut || limit === 0} />
          </div>
          <p className="text-xl font-bold text-copper">{formatEth(edition.price)}</p>
        </div>
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={() => add('cart')} disabled={soldOut || limit === 0 || addToCart.isPending} className="h-[58px] flex-1 rounded-[29px] bg-gradient-to-r from-copper to-[#b97a45] text-base font-bold text-ink disabled:opacity-50">
            Comprar NFT
          </button>
          <button type="button" onClick={() => add()} disabled={soldOut || limit === 0 || addToCart.isPending} className="grid size-[58px] place-items-center rounded-full border border-line-strong text-copper disabled:opacity-50" aria-label="Adicionar ao carrinho">
            <ShoppingCart className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      {/* Abas */}
      <section className="mt-12 md:mt-20">
        <div role="tablist" aria-label="Informações do NFT" className="flex gap-8 border-b border-line">
          {(
            [
              ['details', 'Detalhes do NFT'],
              ['reviews', `Avaliações de colecionadores (${nft.reviewsCount})`],
            ] as const
          ).map(([id, label]) => (
            <button key={id} id={`tab-${id}`} role="tab" type="button" aria-selected={tab === id} aria-controls={`panel-${id}`} onClick={() => setTab(id)} className={cn('-mb-px border-b-2 pb-2 text-base md:text-lg', tab === id ? 'border-copper font-bold text-copper' : 'border-transparent text-cream')}>
              {label}
            </button>
          ))}
        </div>
        <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-4 space-y-4 text-[15px] leading-6 text-sand">
          {tab === 'details' ? (
            <>
              {nft.longDescription.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              <p>
                <b className="block text-cream">Rede:</b>Cunhado na {labelNetwork(nft.network)} com procedência imutável e metadados armazenados no IPFS.
              </p>
              <p>
                <b className="block text-cream">Contrato:</b>Direitos autorais do criador: {nft.royaltiesPercent}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.
              </p>
              <p>
                <b className="block text-cream">Direitos autorais:</b>
                {nft.contract} · Contrato inteligente ERC-721 verificado.
              </p>
            </>
          ) : (
            <p>
              Nota média {nft.rating.toFixed(1)} de 5 em {nft.reviewsCount} avaliações. A leitura das avaliações individuais não faz parte desta demonstração.
            </p>
          )}
        </div>
      </section>

      <section className="mt-16 md:mt-20" aria-labelledby="more-title">
        <SectionTitle id="more-title">Mais desta coleção</SectionTitle>
        <NftRail items={related.data?.items} loading={related.isPending} label="Mais desta coleção" />
      </section>

      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-[min(92vw,720px)] border-line bg-surface p-3 sm:max-w-[min(92vw,720px)]">
          <DialogTitle className="sr-only">{nft.name} ampliado</DialogTitle>
          <DialogDescription className="sr-only">{nft.imageAlt}</DialogDescription>
          <NftImage art={nft.gallery[activeImage] ?? nft.image} alt={nft.imageAlt} width={960} sizes="720px" className="rounded-[12px]" />
        </DialogContent>
      </Dialog>

      <p className="sr-only">
        <Link to="/carrinho">Ir para o carrinho</Link>
      </p>
    </article>
  )
}

function DetailSkeleton() {
  return (
    <div className="pt-7" aria-busy="true" aria-label="Carregando NFT" data-testid="detail-skeleton">
      <Skeleton className="hidden h-5 w-40 md:block" />
      <div className="mt-3 grid gap-6 lg:grid-cols-[100px_395px_1fr]">
        <div className="hidden flex-col gap-4 lg:flex">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
        <div className="rounded-[6px] md:bg-surface md:p-5">
          <Skeleton className="aspect-square w-full rounded-[16px]" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-7 w-1/4" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-2/3" />
        </div>
      </div>
    </div>
  )
}
