import { Link, useParams } from '@tanstack/react-router'
import { Loader2, XCircle } from 'lucide-react'
import type { Order } from '@/api/contracts'
import { isApiError } from '@/api/http'
import { ErrorState, Skeleton } from '@/components/common'
import { NftImage } from '@/components/nft-image'
import { useOrder } from '@/features/orders/hooks'
import { useRealtimeState } from '@/features/realtime/store'
import { formatEth } from '@/lib/eth'
import { formatDate, NETWORK_LABEL, PROVIDER_LABEL, shortAddress } from '@/lib/labels'
import { NotFoundPage } from './not-found'
import thankYou from '@/assets/thank-you.svg'

export function OrderPage() {
  const { orderId } = useParams({ from: '/pedidos/$orderId' })
  const order = useOrder(orderId)

  if (order.isPending) return <Skeleton className="mx-auto mt-16 h-[600px] max-w-[578px]" />
  if (order.isError) {
    if (isApiError(order.error) && (order.error.status === 404 || order.error.status === 403))
      return <NotFoundPage title="Pedido não encontrado" message="Este pedido não existe ou não pertence à sua conta." />
    return (
      <div className="py-16">
        <ErrorState message={order.error.message} onRetry={() => void order.refetch()} retrying={order.isFetching} />
      </div>
    )
  }
  const o = order.data
  return (
    <div className="py-10 md:py-16" data-testid={`order-${o.status}`}>
      {o.status === 'pending' && <Pending order={o} />}
      {o.status === 'confirmed' && <Receipt order={o} />}
      {o.status === 'declined' && <Declined order={o} />}
    </div>
  )
}

function Pending({ order }: { order: Order }) {
  const { status } = useRealtimeState()
  return (
    <section role="status" aria-live="polite" className="mx-auto flex max-w-[578px] flex-col items-center gap-4 rounded-[6px] bg-surface px-6 py-12 text-center">
      <Loader2 className="size-10 animate-spin text-copper" aria-hidden />
      <h1 className="text-xl font-bold text-cream">Aguardando confirmação na rede</h1>
      <p className="text-sm text-sand">
        Pedido <b className="text-cream">{order.id}</b> enviado em {formatDate(order.createdAt)} · total {formatEth(order.total, { minDecimals: 3 })}. Você pode sair desta página: o status será recuperado ao voltar.
      </p>
      {status !== 'online' && <p className="text-xs text-sand-2">Conexão em tempo real indisponível — verificando o status periodicamente.</p>}
    </section>
  )
}

function Declined({ order }: { order: Order }) {
  return (
    <section role="alert" className="mx-auto flex max-w-[578px] flex-col items-center gap-4 rounded-[6px] border border-coral/50 bg-surface px-6 py-12 text-center">
      <XCircle className="size-10 text-coral" aria-hidden />
      <h1 className="text-xl font-bold text-cream">Pagamento recusado</h1>
      <p className="text-sm text-sand">{order.failureReason ?? 'O pagamento não foi concluído.'} Seus itens continuam no carrinho.</p>
      <p className="text-xs text-sand-2">Pedido {order.id}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/pagamento" className="rounded-[3px] bg-copper px-5 py-2 font-bold text-ink">
          Tentar novamente
        </Link>
        <Link to="/carrinho" className="rounded-[3px] border border-copper px-5 py-2 text-copper">
          Voltar ao carrinho
        </Link>
      </div>
    </section>
  )
}

/** Recibo — reproduz o snapshot do pedido (não consulta o catálogo). */
function Receipt({ order }: { order: Order }) {
  return (
    <section aria-labelledby="receipt-title" className="mx-auto max-w-[578px] overflow-hidden rounded-[6px] bg-surface" data-testid="receipt">
      <div className="flex flex-col items-center gap-4 px-6 pt-6 pb-5">
        <img src={thankYou} alt="" width={80} height={80} />
        <h1 id="receipt-title" className="text-center text-base font-bold text-sand">
          Seus NFTs agora estão na sua carteira
        </h1>
      </div>
      <dl className="grid grid-cols-2 gap-y-3 border-y border-copper px-6 py-3 text-sm sm:grid-cols-4 sm:divide-x sm:divide-copper">
        <div className="sm:pr-3">
          <dt className="font-bold text-sand">ID da transação</dt>
          <dd className="text-sand" data-testid="tx-id">
            {order.transaction ? shortAddress(order.transaction.hash) : '—'}
          </dd>
        </div>
        <div className="sm:px-3">
          <dt className="text-sand">Data</dt>
          <dd className="text-sand">{formatDate(order.updatedAt)}</dd>
        </div>
        <div className="sm:px-3">
          <dt className="text-sand">Total</dt>
          <dd className="text-sand">{formatEth(order.total, { minDecimals: 3 })}</dd>
        </div>
        <div className="sm:pl-3">
          <dt className="font-bold text-sand">Carteira</dt>
          <dd className="text-sand">{PROVIDER_LABEL[order.provider]}</dd>
        </div>
      </dl>
      <div className="px-6 py-6 sm:px-11">
        <h2 className="text-[15px] font-bold text-cream">Detalhes da transação</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[15px] text-cream">
              <th scope="col" className="pb-2 font-bold">NFTs</th>
              <th scope="col" className="pb-2 text-center font-bold">Edições</th>
              <th scope="col" className="pb-2 text-right font-bold">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l) => (
              <tr key={`${l.nftId}-${l.editionId}`}>
                <td className="py-2">
                  <div className="flex items-center gap-3">
                    <NftImage art={l.image} alt="" width={160} sizes="66px" className="w-[66px] shrink-0 rounded-[3px]" />
                    <div>
                      <p className="text-[15px] font-bold text-cream">{l.name}</p>
                      <p className="text-sand-2">
                        ID do token: {l.tokenId} · {l.editionLabel}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="text-center text-sand">(x {l.quantity})</td>
                <td className="text-right text-base font-bold text-copper">{formatEth(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-4 ml-auto w-full max-w-[320px] space-y-1 text-[15px]">
          {order.discount !== '0' && (
            <div className="flex justify-between text-cream">
              <dt>Desconto{order.couponCode ? ` (${order.couponCode})` : ''}</dt>
              <dd>(-) {formatEth(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between text-cream">
            <dt>Taxa de rede</dt>
            <dd data-testid="receipt-fee">{formatEth(order.networkFee, { minDecimals: 3 })}</dd>
          </div>
          <div className="flex justify-between border-b border-line pb-2 font-bold text-cream">
            <dt>Total</dt>
            <dd className="text-lg text-copper" data-testid="receipt-total">
              {formatEth(order.total, { minDecimals: 3 })}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-center text-sm leading-6 text-sand">
          Transação confirmada na {NETWORK_LABEL[order.network]} (simulação). A propriedade foi transferida para sua carteira conectada ({shortAddress(order.walletAddress)}) e registrada na rede.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {order.transaction && (
            <Link to="/explorer/tx/$hash" params={{ hash: order.transaction.hash }} className="rounded-[3px] bg-copper px-4 py-3 text-base font-bold text-ink hover:bg-copper-bright">
              Ver no Etherscan <span className="sr-only">(explorador simulado)</span>
            </Link>
          )}
          <Link to="/conta/colecao" className="rounded-[3px] border border-copper px-4 py-3 text-base text-copper hover:bg-copper/10">
            Ver minha coleção
          </Link>
        </div>
      </div>
      <div className="h-2.5 bg-copper" aria-hidden />
    </section>
  )
}
