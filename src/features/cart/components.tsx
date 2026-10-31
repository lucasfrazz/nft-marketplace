import { useId, useState, type FormEvent } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Quote } from '@/api/contracts'
import { isApiError } from '@/api/http'
import { Skeleton } from '@/components/common'
import { announce } from '@/components/live-region'
import { formatEth, isZero } from '@/lib/eth'
import { cn } from '@/lib/utils'
import { useAcknowledgeChanges, useApplyCoupon, useCart, useRemoveCoupon } from './hooks'

export function CouponForm({ compact = false }: { compact?: boolean }) {
  const cart = useCart()
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const id = useId()

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!code.trim()) return setError('Informe um código promocional.')
    apply.mutate(code.trim(), {
      onSuccess: (c) => {
        setCode('')
        announce(`Cupom ${c.couponCode} aplicado.`)
        toast.success(`Cupom ${c.couponCode} aplicado.`)
      },
      onError: (err) => {
        const msg = isApiError(err) ? (err.fields.code ?? err.message) : 'Não foi possível aplicar o cupom.'
        setError(msg)
        announce(msg)
      },
    })
  }

  const applied = cart.data?.couponCode
  if (applied)
    return (
      <div className="flex items-center justify-between rounded-[3px] border border-copper/60 bg-band px-3 py-2 text-sm" data-testid="coupon-applied">
        <span className="text-cream">
          Cupom <b className="text-copper">{applied}</b> aplicado
        </span>
        <button
          type="button"
          onClick={() => remove.mutate(undefined, { onSuccess: () => announce('Cupom removido.') })}
          disabled={remove.isPending}
          className="inline-flex items-center gap-1 text-sand hover:text-copper"
          aria-label={`Remover cupom ${applied}`}
          data-testid="coupon-remove"
        >
          <X className="size-4" aria-hidden /> Remover
        </button>
      </div>
    )

  return (
    <form onSubmit={onSubmit} noValidate>
      {!compact && (
        <label htmlFor={id} className="mb-2 block text-sm font-bold text-cream">
          Código promocional
        </label>
      )}
      <div className={cn('flex', compact ? 'h-[50px] overflow-hidden rounded-[25px] border border-line-strong bg-surface' : 'h-10')}>
        <input
          id={id}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Digite o código promocional..."
          aria-label={compact ? 'Código promocional' : undefined}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          className={cn('min-w-0 flex-1 bg-transparent px-3 text-[13px] text-cream placeholder:text-sand-2 focus:outline-none', !compact && 'border border-copper/70')}
          data-testid="coupon-input"
        />
        <button type="submit" disabled={apply.isPending} className={cn('bg-copper px-4 text-base font-bold text-ink hover:bg-copper-bright disabled:opacity-60', compact ? 'rounded-[25px] px-5' : 'w-[102px]')} data-testid="coupon-apply">
          {apply.isPending ? '…' : 'Aplicar'}
        </button>
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1.5 text-xs text-coral" data-testid="coupon-error">
          {error}
        </p>
      )}
    </form>
  )
}

/** Resumo de valores — reflete exatamente a cotação retornada pela API. */
export function QuoteSummary({ quote, loading, className }: { quote?: Quote; loading?: boolean; className?: string }) {
  if (!quote)
    return (
      <div className={cn('space-y-3', className)} aria-busy="true" aria-label="Calculando resumo" data-testid="summary-skeleton">
        {loading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-6" />)}
      </div>
    )
  const row = 'flex items-center justify-between text-[15px] text-cream md:text-base'
  return (
    <dl className={cn('space-y-2', className)} data-testid="quote-summary">
      <div className={row}>
        <dt>Subtotal</dt>
        <dd className="text-lg md:text-lg" data-testid="summary-subtotal">
          {formatEth(quote.subtotal)}
        </dd>
      </div>
      <div className={row}>
        <dt>Desconto do lançamento{quote.coupon && <span className="text-sand-2"> ({quote.coupon.percent}%)</span>}</dt>
        <dd data-testid="summary-discount">{isZero(quote.discount) ? '(-) 00.00' : `(-) ${formatEth(quote.discount, { unit: false })}`}</dd>
      </div>
      <div className={row}>
        <dt>Taxa de rede</dt>
        <dd className="text-lg" data-testid="summary-fee">
          {formatEth(quote.networkFee, { minDecimals: 3 })}
        </dd>
      </div>
      <p className="text-right text-xs text-copper">Taxa estimada</p>
      <div className={cn(row, 'border-t border-line pt-3')}>
        <dt className="font-bold">Total</dt>
        <dd className="text-lg font-bold text-copper" data-testid="summary-total">
          {formatEth(quote.total, { minDecimals: 3 })}
        </dd>
      </div>
    </dl>
  )
}

/** Alterações de preço/disponibilidade detectadas pela cotação (inclui eventos em tempo real). */
export function QuoteIssues({ quote }: { quote?: Quote }) {
  const ack = useAcknowledgeChanges()
  const issues = quote?.lines.filter((l) => l.issue) ?? []
  if (!issues.length) return null
  return (
    <div role="alert" className="rounded-[6px] border border-coral/60 bg-coral/10 p-4 text-sm text-cream" data-testid="quote-issues">
      <p className="flex items-center gap-2 font-bold">
        <AlertTriangle className="size-4 text-coral" aria-hidden /> Alguns itens mudaram desde que você os adicionou
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sand">
        {issues.map((l) => (
          <li key={`${l.nftId}-${l.editionId}`}>
            {l.issue === 'PRICE_CHANGED' && (
              <>
                {l.name} ({l.editionLabel}): preço de {formatEth(l.previousUnitPrice ?? l.unitPrice)} para <b className="text-cream">{formatEth(l.unitPrice)}</b>.
              </>
            )}
            {l.issue === 'INSUFFICIENT_AVAILABILITY' && (
              <>
                {l.name} ({l.editionLabel}): apenas {l.available} disponível(is); a quantidade será ajustada.
              </>
            )}
            {l.issue === 'SOLD_OUT' && (
              <>
                {l.name} ({l.editionLabel}): edição esgotada; o item será removido.
              </>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() =>
          ack.mutate(undefined, {
            onSuccess: () => announce('Novos valores aceitos. O resumo foi atualizado.'),
          })
        }
        disabled={ack.isPending}
        className="mt-3 rounded-[3px] bg-copper px-4 py-2 font-bold text-ink hover:bg-copper-bright disabled:opacity-60"
        data-testid="accept-changes"
      >
        {ack.isPending ? 'Atualizando…' : 'Aceitar novos valores'}
      </button>
    </div>
  )
}
