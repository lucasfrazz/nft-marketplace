import { useEffect, useState } from 'react'
import type { NftListResponse } from '@/api/contracts'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/common'
import { cn } from '@/lib/utils'
import { toggleInList, type CatalogSearch } from './search'

const toCents = (eth: string) => {
  const [i, f = ''] = eth.split('.')
  return Number(i) * 100 + Number((f + '00').slice(0, 2))
}
const fromCents = (c: number) => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`
const ptBr = (eth: string) => eth.replace('.', ',')

export function CatalogFilters({
  search,
  facets,
  onChange,
  idPrefix = 'f',
}: {
  search: CatalogSearch
  facets: NftListResponse['facets'] | undefined
  onChange: (patch: Partial<CatalogSearch>) => void
  idPrefix?: string
}) {
  const range = facets?.priceRange
  const lo = range ? toCents(range.min) : 0
  const hi = range ? toCents(range.max) : 0
  const [value, setValue] = useState<[number, number]>([0, 0])

  useEffect(() => {
    if (!range) return
    setValue([search.min ? Math.max(lo, toCents(search.min)) : lo, search.max ? Math.min(hi, toCents(search.max)) : hi])
  }, [range, lo, hi, search.min, search.max])

  const selectedCols = new Set(search.col?.split(',') ?? [])
  const selectedNets = new Set(search.net?.split(',') ?? [])

  const facetItem = (active: boolean) =>
    cn('flex w-full items-center justify-between rounded-[3px] px-3 py-2 text-left text-[15px] transition-colors', active ? 'bg-copper/15 font-bold text-copper' : 'text-copper/90 hover:bg-surface-2')

  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="mb-2 text-lg font-bold text-cream">Coleções</legend>
        <ul className="space-y-0.5">
          {facets
            ? facets.collections.map((c) => {
                const active = selectedCols.has(c.id)
                return (
                  <li key={c.id}>
                    <button type="button" role="checkbox" aria-checked={active} className={facetItem(active)} onClick={() => onChange({ col: toggleInList(search.col, c.id) })} data-testid={`${idPrefix}-col-${c.id}`}>
                      <span>{c.label}</span>
                      <span aria-label={`${c.count} itens`} className="font-bold">
                        ({c.count})
                      </span>
                    </button>
                  </li>
                )
              })
            : Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="my-2 h-6" />)}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-lg font-bold text-cream">Faixa de preço</legend>
        {range ? (
          <>
            <Slider
              min={lo}
              max={hi}
              step={1}
              value={value}
              minStepsBetweenThumbs={1}
              onValueChange={(v) => setValue([v[0], v[1]] as [number, number])}
              aria-label="Faixa de preço"
              thumbLabels={['Preço mínimo', 'Preço máximo']}
              className="px-1"
            />
            <p className="mt-4 text-[15px] text-cream" aria-live="polite">
              Preço: {ptBr(fromCents(value[0]))} - {ptBr(fromCents(value[1]))} ETH
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="rounded-[3px] bg-copper px-3 py-1.5 text-base font-medium text-ink hover:bg-copper-bright"
                onClick={() => onChange({ min: value[0] > lo ? fromCents(value[0]) : undefined, max: value[1] < hi ? fromCents(value[1]) : undefined })}
                data-testid={`${idPrefix}-price-apply`}
              >
                Aplicar
              </button>
              {(search.min || search.max) && (
                <button type="button" className="rounded-[3px] px-3 py-1.5 text-sm text-sand underline-offset-4 hover:underline" onClick={() => onChange({ min: undefined, max: undefined })}>
                  Limpar
                </button>
              )}
            </div>
          </>
        ) : (
          <Skeleton className="h-16" />
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-lg font-bold text-cream">Rede</legend>
        <ul className="space-y-0.5">
          {facets
            ? facets.networks.map((n) => {
                const active = selectedNets.has(n.id)
                return (
                  <li key={n.id}>
                    <button type="button" role="checkbox" aria-checked={active} className={cn(facetItem(active), !active && 'text-sand')} onClick={() => onChange({ net: toggleInList(search.net, n.id) })} data-testid={`${idPrefix}-net-${n.id}`}>
                      <span>{n.label}</span>
                      <span>({n.count})</span>
                    </button>
                  </li>
                )
              })
            : Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="my-2 h-6" />)}
        </ul>
      </fieldset>
    </div>
  )
}
