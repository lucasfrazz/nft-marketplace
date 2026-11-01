import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronLeft, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { CartItem, QuoteLine } from '@/api/contracts'
import { isApiError } from '@/api/http'
import { Breadcrumb, EmptyState, ErrorState, QuantityStepper, SectionTitle, Skeleton } from '@/components/common'
import { NftImage } from '@/components/nft-image'
import { NftRail } from '@/components/nft-rail'
import { announce } from '@/components/live-region'
import { CouponForm, QuoteIssues, QuoteSummary } from '@/features/cart/components'
import { useCart, useQuote, useRemoveItem, useSetQuantity } from '@/features/cart/hooks'
import { useRelated } from '@/features/catalog/hooks'
import { formatEth, mulInt } from '@/lib/eth'

export function CartPage() {
  const cart = useCart()
  const quote = useQuote('ethereum')
  const navigate = useNavigate()
  const firstId = cart.data?.items[0]?.nftId ?? 'emerald-ape-042'
  const related = useRelated(firstId)

  const lineFor = (i: CartItem): QuoteLine | undefined => quote.data?.lines.find((l) => l.nftId === i.nftId && l.editionId === i.editionId)
  const items = cart.data?.items ?? []
  const blocked = !!quote.data?.hasIssues || quote.isFetching || !quote.data

  return (
    <div className="pt-4 md:pt-10">
      <div className="hidden md:block">
        <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/' }, { label: 'Carrinho' }]} />
      </div>
      <div className="relative flex items-center justify-center md:hidden">
        <button type="button" onClick={() => (history.length > 1 ? history.back() : navigate({ to: '/' }))} className="absolute left-0 grid size-9 place-items-center rounded-full bg-surface text-sand" aria-label="Voltar">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <h1 className="text-xl font-bold text-cream">Carrinho de NFTs</h1>
      </div>
      <h1 className="sr-only hidden md:block">Carrinho de NFTs</h1>

      {cart.isPending ? (
        <CartSkeleton />
      ) : cart.isError ? (
        <div className="mt-8">
          <ErrorState message={cart.error.message} onRetry={() => void cart.refetch()} retrying={cart.isFetching} />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="Seu carrinho está vazio">
            <p className="text-sm text-sand">Explore o catálogo e adicione NFTs para continuar.</p>
            <Link to="/" className="rounded-[3px] bg-copper px-5 py-2 font-bold text-ink">
              Explorar NFTs
            </Link>
          </EmptyState>
        </div>
      ) : (
        <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_332px] lg:gap-[86px]">
          <section aria-labelledby="cart-items-title">
            <h2 id="cart-items-title" className="sr-only">
              Itens do carrinho
            </h2>
            <div className="mb-4">
              <QuoteIssues quote={quote.data} />
            </div>
            {/* Desktop: tabela */}
            <table className="hidden w-full border-separate border-spacing-y-3 md:table">
              <thead>
                <tr className="text-left text-[15px] font-bold text-cream">
                  <th scope="col" className="border-b border-line pb-2 font-bold">NFTs</th>
                  <th scope="col" className="border-b border-line pb-2 font-bold">Preço</th>
                  <th scope="col" className="border-b border-line pb-2 font-bold">Edições</th>
                  <th scope="col" className="border-b border-line pb-2 font-bold">Total</th>
                  <th scope="col" className="border-b border-line pb-2"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <CartRow key={`${item.nftId}-${item.editionId}`} item={item} line={lineFor(item)} />
                ))}
              </tbody>
            </table>
            {/* Mobile: lista */}
            <ul className="space-y-5 md:hidden">
              {items.map((item) => (
                <CartCard key={`${item.nftId}-${item.editionId}`} item={item} line={lineFor(item)} />
              ))}
            </ul>
          </section>

          <aside aria-labelledby="summary-title" className="-mx-4 rounded-t-[30px] bg-surface px-6 pt-6 pb-8 md:mx-0 md:rounded-none md:bg-transparent md:p-0">
            <h2 id="summary-title" className="hidden border-b border-line pb-2 text-lg font-bold text-cream md:block">
              Resumo da carteira
            </h2>
            <div className="mt-6 hidden md:block">
              <CouponForm />
            </div>
            <div className="md:hidden">
              <CouponForm compact />
            </div>
            <QuoteSummary quote={quote.data} loading={quote.isPending} className="mt-6" />
            {quote.isError && <p role="alert" className="mt-3 text-sm text-coral">Não foi possível calcular o resumo. <button type="button" className="underline" onClick={() => void quote.refetch()}>Tentar novamente</button></p>}
            <button
              type="button"
              onClick={() => navigate({ to: '/pagamento' })}
              disabled={blocked}
              aria-describedby={quote.data?.hasIssues ? 'checkout-blocked' : undefined}
              className="mt-6 h-[58px] w-full rounded-[29px] bg-copper text-base font-bold text-ink hover:bg-copper-bright disabled:opacity-50 md:h-10 md:rounded-[3px]"
              data-testid="go-checkout"
            >
              Conectar e finalizar
            </button>
            {quote.data?.hasIssues && (
              <p id="checkout-blocked" className="mt-2 text-xs text-coral">
                Aceite os novos valores para continuar.
              </p>
            )}
            <Link to="/" className="mt-4 hidden text-center text-base text-copper hover:underline md:block">
              Continuar explorando
            </Link>
          </aside>
        </div>
      )}

      <section className="mt-20 hidden md:block" aria-labelledby="also-title">
        <SectionTitle id="also-title">Colecionadores também viram</SectionTitle>
        <NftRail items={related.data?.items} loading={related.isPending} label="Colecionadores também viram" />
      </section>
    </div>
  )
}

function useItemActions(item: CartItem) {
  const setQty = useSetQuantity()
  const remove = useRemoveItem()
  const max = Math.max(1, Math.min(item.available, item.maxPerOrder))
  const change = (quantity: number) =>
    setQty.mutate(
      { nftId: item.nftId, editionId: item.editionId, quantity },
      {
        onSuccess: () => announce(`Quantidade de ${item.name} alterada para ${quantity}.`),
        onError: (e) => toast.error(isApiError(e) ? e.message : 'Não foi possível alterar a quantidade.'),
      },
    )
  const del = () =>
    remove.mutate(
      { nftId: item.nftId, editionId: item.editionId },
      {
        onSuccess: () => {
          announce(`${item.name} removido do carrinho.`)
          toast.success(`${item.name} removido do carrinho.`)
        },
        onError: (e) => toast.error(isApiError(e) ? e.message : 'Não foi possível remover o item.'),
      },
    )
  return { change, del, max, busy: setQty.isPending || remove.isPending }
}

function CartRow({ item, line }: { item: CartItem; line?: QuoteLine }) {
  const { change, del, max, busy } = useItemActions(item)
  const unit = line?.unitPrice ?? item.unitPrice
  return (
    <tr className="bg-surface text-[15px]" data-testid="cart-row" aria-busy={busy}>
      <td className="rounded-l-[3px] py-0 pr-4">
        <div className="flex items-center gap-4">
          <Link to="/nft/$nftId" params={{ nftId: item.nftId }} search={{ edition: item.editionId }} className="block w-[70px] shrink-0">
            <NftImage art={item.image} alt="" width={160} sizes="70px" className="rounded-[3px]" />
          </Link>
          <div>
            <p className="text-base font-bold text-cream">{item.name}</p>
            <p className="text-sm text-sand-2">
              ID do token: {item.tokenId} · Edição {item.editionLabel}
            </p>
          </div>
        </div>
      </td>
      <td className="pr-4 font-medium text-sand">
        {formatEth(unit)}
        {line?.issue === 'PRICE_CHANGED' && <s className="block text-xs text-sand-2">{formatEth(line.previousUnitPrice!)}</s>}
      </td>
      <td className="pr-4">
        <QuantityStepper size="sm" value={item.quantity} max={max} onChange={change} label={item.name} disabled={busy} />
        {item.quantity >= max && <span className="sr-only">Limite atingido</span>}
      </td>
      <td className="pr-4 font-bold text-copper" data-testid="row-total">
        {formatEth(line?.lineTotal ?? mulInt(unit, item.quantity))}
      </td>
      <td className="rounded-r-[3px] pr-4 text-right">
        <button type="button" onClick={del} disabled={busy} className="rounded p-2 text-sand hover:text-coral" aria-label={`Remover ${item.name} do carrinho`} data-testid="remove-item">
          <Trash2 className="size-5" aria-hidden />
        </button>
      </td>
    </tr>
  )
}

function CartCard({ item, line }: { item: CartItem; line?: QuoteLine }) {
  const { change, del, max, busy } = useItemActions(item)
  return (
    <li className="flex overflow-hidden rounded-[10px] bg-surface" data-testid="cart-card">
      <NftImage art={item.image} alt="" width={160} sizes="100px" className="w-[100px] shrink-0" />
      <div className="flex min-w-0 flex-1 items-start justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-cream">{item.name}</p>
          <p className="text-sm text-sand-2">Edição: {item.editionLabel}</p>
          <p className="mt-3 text-lg font-bold text-copper">{formatEth(line?.lineTotal ?? mulInt(item.unitPrice, item.quantity))}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <QuantityStepper size="sm" value={item.quantity} max={max} onChange={change} label={item.name} disabled={busy} />
          <button type="button" onClick={del} disabled={busy} className="p-1 text-sand hover:text-coral" aria-label={`Remover ${item.name} do carrinho`}>
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </li>
  )
}

function CartSkeleton() {
  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_332px] lg:gap-[86px]" aria-busy="true" aria-label="Carregando carrinho" data-testid="cart-skeleton">
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[70px]" />
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-10" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-6" />
        ))}
        <Skeleton className="h-10" />
      </div>
    </div>
  )
}
