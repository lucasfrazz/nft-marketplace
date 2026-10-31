import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { AlertTriangle, Minus, Plus, RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('shimmer rounded-[6px]', className)} />
}

export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="text-sm font-bold text-cream md:text-[15px]">
      <ol className="flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <li key={it.label} className="flex gap-1.5">
            {it.to ? (
              <Link to={it.to} className="hover:text-copper-bright">
                {it.label}
              </Link>
            ) : (
              <span aria-current="page">{it.label}</span>
            )}
            {i < items.length - 1 && <span aria-hidden>/</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function ErrorState({ title = 'Não foi possível carregar', message, onRetry, retrying }: { title?: string; message?: string; onRetry?: () => void; retrying?: boolean }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-[6px] border border-coral/40 bg-surface px-6 py-10 text-center" data-testid="error-state">
      <AlertTriangle className="size-8 text-coral" aria-hidden />
      <p className="text-base font-bold text-cream">{title}</p>
      {message && <p className="max-w-md text-sm text-sand">{message}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} disabled={retrying} className="mt-1 inline-flex items-center gap-2 rounded-[3px] bg-copper px-4 py-2 text-sm font-bold text-ink hover:bg-copper-bright disabled:opacity-60">
          <RotateCw className={cn('size-4', retrying && 'animate-spin')} aria-hidden /> {retrying ? 'Tentando…' : 'Tentar novamente'}
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 rounded-[6px] border border-line bg-surface px-6 py-12 text-center" data-testid="empty-state">
      <p className="text-base font-bold text-cream">{title}</p>
      {children}
    </div>
  )
}

/** Seletor de quantidade (botões circulares cobre do layout). */
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  disabled,
  size = 'md',
}: {
  value: number
  min?: number
  max: number
  onChange: (v: number) => void
  label: string
  disabled?: boolean
  size?: 'sm' | 'md'
}) {
  const btn = cn(
    'grid place-items-center rounded-full bg-copper text-ink transition hover:bg-copper-bright disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-sand-2',
    size === 'sm' ? 'size-[22px]' : 'size-[30px] md:h-[42px] md:w-[30px] md:rounded-[15px]',
  )
  return (
    <div role="group" aria-label={label} className="flex items-center gap-3">
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label={`Diminuir quantidade de ${label}`}>
        <Minus className={size === 'sm' ? 'size-3.5' : 'size-5'} aria-hidden strokeWidth={3} />
      </button>
      <output aria-live="polite" className={cn('min-w-4 text-center text-cream', size === 'sm' ? 'text-[15px]' : 'text-lg')} data-testid="qty-value">
        {value}
      </output>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label={`Aumentar quantidade de ${label}`}>
        <Plus className={size === 'sm' ? 'size-3.5' : 'size-5'} aria-hidden strokeWidth={3} />
      </button>
    </div>
  )
}

export function SectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="border-b border-line pb-2 text-lg font-bold text-copper">
      {children}
    </h2>
  )
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-lg font-bold text-cream">{children}</h1>
}
