import { Link } from '@tanstack/react-router'
import type { Order } from '@/api/contracts'
import { EmptyState, ErrorState, Skeleton } from '@/components/common'
import { NftImage } from '@/components/nft-image'
import { useOrders } from '@/features/orders/hooks'
import { formatEth } from '@/lib/eth'
import { formatDate, ORDER_STATUS_LABEL } from '@/lib/labels'

interface Owned {
  key: string
  nftId: string
  name: string
  image: string
  tokenId: string
  editionLabel: string
  quantity: number
  lastOrder: Order
}

/** NFTs comprados = linhas de pedidos confirmados (snapshot do pedido), agrupadas por NFT e edição. */
function ownedFrom(orders: Order[]): Owned[] {
  const map = new Map<string, Owned>()
  for (const o of orders.filter((x) => x.status === 'confirmed')) {
    for (const l of o.lines) {
      const key = `${l.nftId}:${l.editionId}`
      const cur = map.get(key)
      if (cur) cur.quantity += l.quantity
      else map.set(key, { key, nftId: l.nftId, name: l.name, image: l.image, tokenId: l.tokenId, editionLabel: l.editionLabel, quantity: l.quantity, lastOrder: o })
    }
  }
  return [...map.values()]
}

export function CollectionPage() {
  const orders = useOrders()

  if (orders.isPending)
    return (
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-3" aria-busy="true" aria-label="Carregando coleção">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="aspect-[3/4]" />
        ))}
      </div>
    )
  if (orders.isError) return <ErrorState message={orders.error.message} onRetry={() => void orders.refetch()} />

  const owned = ownedFrom(orders.data.items)
  const history = orders.data.items

  return (
    <div className="space-y-12">
      <section aria-labelledby="collection-title">
        <h2 id="collection-title" className="text-lg font-bold text-cream">
          Minha coleção
        </h2>
        <p className="text-[13px] text-sand">NFTs de pedidos confirmados, enviados para a sua carteira.</p>
        <div className="mt-6">
          {owned.length === 0 ? (
            <EmptyState title="Você ainda não tem NFTs">
              <Link to="/" className="rounded-[3px] bg-copper px-4 py-2 text-sm font-bold text-ink">
                Explorar NFTs
              </Link>
            </EmptyState>
          ) : (
            <ul className="grid grid-cols-2 gap-6 lg:grid-cols-3" data-testid="collection-grid">
              {owned.map((n) => (
                <li key={n.key} className="rounded-[6px] bg-surface p-3">
                  <Link to="/nft/$nftId" params={{ nftId: n.nftId }} className="block overflow-hidden rounded-[16px]">
                    <NftImage art={n.image} alt="" width={320} sizes="(max-width: 768px) 45vw, 260px" />
                  </Link>
                  <h3 className="mt-3 text-[15px] font-bold text-cream">{n.name}</h3>
                  <p className="text-sm text-sand-2">
                    Edição {n.editionLabel} · {n.tokenId}
                  </p>
                  <p className="mt-1 text-sm text-copper">
                    {n.quantity} {n.quantity === 1 ? 'unidade' : 'unidades'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {history.length > 0 && (
        <section aria-labelledby="orders-title">
          <h2 id="orders-title" className="text-lg font-bold text-cream">
            Pedidos
          </h2>
          <ul className="mt-4 space-y-2" data-testid="orders-list">
            {history.map((o) => (
              <li key={o.id}>
                <Link to="/pedidos/$orderId" params={{ orderId: o.id }} className="flex flex-wrap items-center justify-between gap-2 rounded-[3px] bg-surface px-4 py-3 text-sm hover:bg-surface-2">
                  <span className="text-cream">
                    {formatDate(o.createdAt)} · {o.lines.reduce((s, l) => s + l.quantity, 0)} item(ns)
                  </span>
                  <span className={o.status === 'confirmed' ? 'text-success' : o.status === 'declined' ? 'text-coral' : 'text-sand'}>{ORDER_STATUS_LABEL[o.status]}</span>
                  <span className="font-bold text-copper">{formatEth(o.total, { minDecimals: 3 })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
