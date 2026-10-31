import { useRef, useState } from 'react'
import type { NftSummary } from '@/api/contracts'
import { cn } from '@/lib/utils'
import { NftCard, NftCardSkeleton } from './nft-card'

/** Carrossel horizontal ("Mais desta coleção" / "Colecionadores também viram"). */
export function NftRail({ items, loading, label }: { items?: NftSummary[]; loading?: boolean; label: string }) {
  const ref = useRef<HTMLUListElement>(null)
  const [page, setPage] = useState(0)
  const pages = items ? Math.max(1, Math.ceil(items.length / 5)) : 1
  const go = (p: number) => {
    const el = ref.current
    if (!el) return
    el.scrollTo({ left: (el.scrollWidth / pages) * p, behavior: 'smooth' })
    setPage(p)
  }
  return (
    <div>
      <ul
        ref={ref}
        aria-label={label}
        onScroll={(e) => {
          const el = e.currentTarget
          setPage(Math.round((el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth)) * (pages - 1)))
        }}
        className="-mx-1 mt-8 flex snap-x snap-mandatory gap-6 overflow-x-auto px-1 pb-2 [scrollbar-width:none]"
      >
        {loading || !items
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="w-[44%] shrink-0 snap-start sm:w-[30%] lg:w-[calc(20%-19.2px)]">
                <NftCardSkeleton />
              </li>
            ))
          : items.map((n) => (
              <li key={n.id} className="w-[44%] shrink-0 snap-start sm:w-[30%] lg:w-[calc(20%-19.2px)]">
                <NftCard nft={n} compact />
              </li>
            ))}
      </ul>
      {pages > 1 && (
        <div className="mt-6 flex justify-center gap-2" role="group" aria-label={`Páginas de ${label}`}>
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} type="button" onClick={() => go(i)} aria-label={`Ir para o grupo ${i + 1}`} aria-pressed={i === page} className={cn('size-3 rounded-full border border-copper', i === page && 'bg-copper')} />
          ))}
        </div>
      )}
    </div>
  )
}
