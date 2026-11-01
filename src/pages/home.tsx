import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react'
import type { CatalogTab, CatalogSort, HighlightsResponse } from '@/api/contracts'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { EmptyState, ErrorState, Skeleton } from '@/components/common'
import { NftCard, NftCardSkeleton } from '@/components/nft-card'
import { NftImage } from '@/components/nft-image'
import { CatalogFilters } from '@/features/catalog/filters'
import { useHighlights, useNftList } from '@/features/catalog/hooks'
import { toListQuery, type CatalogSearch } from '@/features/catalog/search'
import { notAvailable } from '@/lib/out-of-scope'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

const TABS: { id: CatalogTab; label: string }[] = [
  { id: 'all', label: 'Todos os NFTs' },
  { id: 'new', label: 'Novos lançamentos' },
  { id: 'trending', label: 'Em alta' },
]

const SORTS: { id: CatalogSort; label: string }[] = [
  { id: 'recent', label: 'Listados recentemente' },
  { id: 'price-asc', label: 'Menor preço' },
  { id: 'price-desc', label: 'Maior preço' },
  { id: 'name', label: 'Nome (A–Z)' },
]

export function HomePage() {
  const search = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })
  /** Qualquer mudança de filtro reinicia a paginação. */
  const update = (patch: Partial<CatalogSearch>, opts: { resetPage?: boolean } = { resetPage: true }) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, ...(opts.resetPage ? { page: undefined } : {}) }), resetScroll: false })
  return <HomeView search={search} onChange={update} />
}

/** Visual da Home (também usado como fundo dos diálogos de login/cadastro). */
export function HomeView({ search, onChange, inert = false }: { search: CatalogSearch; onChange: (p: Partial<CatalogSearch>, o?: { resetPage?: boolean }) => void; inert?: boolean }) {
  const highlights = useHighlights()
  return (
    <div {...(inert ? { inert: true, 'aria-hidden': true } : {})}>
      <MobileSearchBar search={search} onChange={onChange} />
      <Hero data={highlights.data} />
      <Catalog search={search} onChange={onChange} featured={highlights.data?.featured} />
      <Drops data={highlights.data} />
      <Journal data={highlights.data} />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Hero({ data }: { data?: HighlightsResponse }) {
  const [index, setIndex] = useState(0)
  const slides = data?.hero ?? []
  const current = slides[index]
  return (
    <section aria-labelledby="hero-title" className="mt-4 md:mt-[18px]">
      {/* Desktop */}
      <div className="hidden min-h-[450px] items-center justify-between gap-10 md:flex">
        <div className="max-w-[640px] pl-10">
          <p className="text-sm tracking-[0.1em] text-cream">Bem-vindo à Kurio</p>
          <h1 id="hero-title" className="mt-5 text-[30px] leading-[48px] lg:text-[43px] lg:leading-[70px] font-bold tracking-[0.06em] text-cream">
            SEJA DONO DO FUTURO DA ARTE DIGITAL
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-sand">Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.</p>
          <a href="#catalogo" className="mt-10 inline-flex h-10 items-center rounded-[3px] bg-copper px-7 text-base font-bold text-ink hover:bg-copper-bright">
            EXPLORAR
          </a>
        </div>
        <div className="relative flex shrink-0 items-end gap-8">
          {slides.length > 1 && (
            <div className="mb-4 flex gap-2" role="group" aria-label="Destaques">
              {slides.map((s, i) => (
                <button key={s.id} type="button" onClick={() => setIndex(i)} aria-label={`Mostrar ${s.name}`} aria-pressed={i === index} className="grid size-6 place-items-center rounded-full">
                  <span aria-hidden className={cn('size-2.5 rounded-full', i === index ? 'bg-copper' : 'bg-copper/40')} />
                </button>
              ))}
            </div>
          )}
          <div className="w-[300px] lg:w-[450px]">
            {current ? (
              <Link to="/nft/$nftId" params={{ nftId: current.id }} aria-label={`Ver ${current.name}`}>
                <NftImage art={current.image} alt={current.imageAlt} priority width={640} sizes="450px" className="rounded-[16px]" />
              </Link>
            ) : (
              <Skeleton className="aspect-square w-full rounded-[16px]" />
            )}
          </div>
        </div>
      </div>

      {/* Mobile */}
      <div className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-surface-2 to-surface p-4 md:hidden">
        <div aria-hidden className="absolute -top-20 left-24 size-64 rounded-full bg-copper/10" />
        <div className="relative flex gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-cream">Bem-vindo à Kurio</p>
            <h1 className="mt-2 text-[17px] leading-7 font-bold tracking-[0.04em] text-cream">SEJA DONO DA CULTURA DIGITAL</h1>
            <p className="mt-1 text-[13px] leading-5 text-sand">Descubra NFTs selecionados de criadores do mundo todo.</p>
            <a href="#catalogo" className="mt-2 inline-flex items-center gap-2 text-[13px] font-bold text-copper">
              EXPLORAR <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>
          <div className="relative w-[138px] shrink-0">
            {current ? <NftImage art={current.image} alt={current.imageAlt} priority width={320} sizes="140px" className="rounded-[14px]" /> : <Skeleton className="aspect-square w-full rounded-[14px]" />}
            {slides[1] && (
              <div className="absolute -bottom-1 -left-3 w-[58px] overflow-hidden rounded-[10px] border-2 border-surface-2">
                <NftImage art={slides[1].image} alt="" width={160} sizes="58px" />
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className={cn('size-1.5 rounded-full', i === index ? 'bg-copper' : 'bg-copper/50')} />
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */

function MobileSearchBar({ search, onChange }: { search: CatalogSearch; onChange: (p: Partial<CatalogSearch>) => void }) {
  const [open, setOpen] = useState(false)
  const list = useNftList(toListQuery(search))
  return (
    <div className="flex gap-2 pt-4 md:hidden">
      <SearchField id="catalog-search-mobile" search={search} onChange={onChange} className="h-[45px] flex-1 rounded-[10px] bg-surface" />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button type="button" className="grid size-[45px] place-items-center rounded-[10px] bg-copper text-ink" aria-label="Abrir filtros" data-testid="open-filters">
            <SlidersHorizontal className="size-5" aria-hidden />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-[24px] border-line bg-surface px-5 pb-8">
          <SheetHeader className="px-0">
            <SheetTitle className="text-cream">Filtros</SheetTitle>
            <SheetDescription className="text-sand">Combine coleções, faixa de preço e rede.</SheetDescription>
          </SheetHeader>
          <SortSelect search={search} onChange={onChange} />
          <div className="mt-6">
            <CatalogFilters search={search} facets={list.data?.facets} onChange={onChange} idPrefix="m" />
          </div>
          <button type="button" onClick={() => setOpen(false)} className="mt-8 h-12 w-full rounded-[10px] bg-copper font-bold text-ink">
            Ver {list.data?.total ?? ''} resultados
          </button>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function SearchField({ id, search, onChange, className }: { id: string; search: CatalogSearch; onChange: (p: Partial<CatalogSearch>) => void; className?: string }) {
  const [value, setValue] = useState(search.q ?? '')
  const lastPushed = useRef(search.q ?? '')
  // Sincroniza com a URL (voltar/avançar no histórico).
  useEffect(() => {
    if ((search.q ?? '') !== lastPushed.current) {
      lastPushed.current = search.q ?? ''
      setValue(search.q ?? '')
    }
  }, [search.q])
  useEffect(() => {
    const t = setTimeout(() => {
      const next = value.trim()
      if (next !== lastPushed.current) {
        lastPushed.current = next
        onChange({ q: next || undefined })
      }
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <div className={cn('flex items-center gap-2 px-3', className)}>
      <Search className="size-5 shrink-0 text-sand" aria-hidden />
      <label htmlFor={id} className="sr-only">
        Buscar NFTs por nome, token ou coleção
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Explorar coleções"
        className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-cream placeholder:text-sand-2 focus:outline-none"
        data-testid="catalog-search"
      />
    </div>
  )
}

function SortSelect({ search, onChange }: { search: CatalogSearch; onChange: (p: Partial<CatalogSearch>) => void }) {
  // <select> nativo: acessível por padrão e sem custo de JS no carregamento inicial.
  return (
    <label className="flex items-center gap-1 text-[15px] text-cream">
      <span>Ordenar por:</span>
      <span className="relative">
        <select
          value={search.sort ?? 'recent'}
          onChange={(e) => onChange({ sort: e.target.value === 'recent' ? undefined : (e.target.value as CatalogSort) })}
          className="h-8 appearance-none rounded-[3px] bg-transparent pr-6 pl-1 text-[15px] text-cream focus-visible:ring-2 focus-visible:ring-copper/60"
          data-testid="sort-select"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id} className="bg-surface text-cream">
              {s.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-1 size-4 -translate-y-1/2" aria-hidden />
      </span>
    </label>
  )
}

function Catalog({ search, onChange, featured }: { search: CatalogSearch; onChange: (p: Partial<CatalogSearch>, o?: { resetPage?: boolean }) => void; featured?: HighlightsResponse['featured'] }) {
  const query = toListQuery(search)
  const list = useNftList(query)
  const tab = search.tab ?? 'all'
  const sectionRef = useRef<HTMLElement>(null)
  const goToPage = (page: number) => {
    onChange({ page: page > 1 ? page : undefined }, { resetPage: false })
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const hasFilters = !!(search.q || search.col || search.net || search.min || search.max || search.tab)

  return (
    <section id="catalogo" ref={sectionRef} aria-labelledby="catalog-title" className="mt-6 scroll-mt-4 md:mt-24 md:grid md:grid-cols-[240px_1fr] md:gap-6 lg:grid-cols-[310px_1fr] lg:gap-12">
      <h2 id="catalog-title" className="sr-only">
        Catálogo de NFTs
      </h2>
      <aside aria-label="Filtros do catálogo" className="hidden md:block">
        <div className="rounded-[3px] bg-surface px-5 py-5">
          <CatalogFilters search={search} facets={list.data?.facets} onChange={onChange} />
        </div>
        <FeaturedCard nft={featured} />
      </aside>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Seções do catálogo" className="flex gap-4 overflow-x-auto md:gap-6">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => onChange({ tab: t.id === 'all' ? undefined : t.id })}
                className={cn('shrink-0 border-b-2 pb-1 text-[15px] whitespace-nowrap', tab === t.id ? 'border-copper font-bold text-copper' : 'border-transparent text-cream hover:text-copper-bright')}
                data-testid={`tab-${t.id}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="hidden flex-wrap items-center gap-4 md:flex">
            <SearchField id="catalog-search" search={search} onChange={onChange} className="h-9 w-48 rounded-[3px] border border-line bg-surface lg:w-56" />
            <SortSelect search={search} onChange={onChange} />
          </div>
        </div>

        <div className="mt-2 flex min-h-6 items-center justify-between text-xs text-sand-2">
          <p aria-live="polite" data-testid="results-count">
            {list.data ? `${list.data.total} ${list.data.total === 1 ? 'resultado' : 'resultados'}` : ''}
          </p>
          {list.isFetching && list.data && <p role="status">Atualizando…</p>}
        </div>

        <div aria-busy={list.isPending || list.isFetching} className="mt-3">
          {list.isPending ? (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 lg:gap-x-[30px]" aria-label="Carregando NFTs">
              {Array.from({ length: 9 }, (_, i) => (
                <li key={i}>
                  <NftCardSkeleton />
                </li>
              ))}
            </ul>
          ) : list.isError && !list.data ? (
            <ErrorState message={list.error.message} onRetry={() => void list.refetch()} retrying={list.isFetching} />
          ) : list.data && list.data.items.length === 0 ? (
            <EmptyState title="Nenhum NFT encontrado">
              <p className="text-sm text-sand">Tente outros termos ou remova alguns filtros.</p>
              {hasFilters && (
                <Link to="/" className="rounded-[3px] bg-copper px-4 py-2 text-sm font-bold text-ink" data-testid="clear-filters">
                  Limpar filtros
                </Link>
              )}
            </EmptyState>
          ) : list.data ? (
            <>
              {list.isError && <ErrorState title="Falha ao atualizar" message={list.error.message} onRetry={() => void list.refetch()} retrying={list.isFetching} />}
              <ul className={cn('grid grid-cols-2 gap-x-4 gap-y-8 transition-opacity max-md:[&>li:nth-child(even)]:mt-8 lg:grid-cols-3 lg:gap-x-[30px]', list.isPlaceholderData && 'opacity-60')} data-testid="catalog-grid">
                {list.data.items.map((nft, i) => (
                  <li key={nft.id}>
                    <NftCard nft={nft} priority={i < 3} />
                  </li>
                ))}
              </ul>
              <Pagination page={list.data.page} totalPages={list.data.totalPages} onPage={goToPage} />
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  const btn = 'grid size-[30px] place-items-center rounded-[3px] border border-line text-[15px] text-cream hover:border-copper disabled:opacity-40'
  return (
    <nav aria-label="Paginação" className="mt-12 flex justify-end">
      <ul className="flex gap-2">
        <li>
          <button type="button" className={btn} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Página anterior">
            <ChevronLeft className="size-4" aria-hidden />
          </button>
        </li>
        {pages.map((p) => (
          <li key={p}>
            <button type="button" onClick={() => onPage(p)} aria-current={p === page ? 'page' : undefined} aria-label={`Página ${p}`} className={cn(btn, p === page && 'border-copper bg-copper font-bold text-ink')} data-testid={`page-${p}`}>
              {p}
            </button>
          </li>
        ))}
        <li>
          <button type="button" className={btn} onClick={() => onPage(page + 1)} disabled={page >= totalPages} aria-label="Próxima página" data-testid="page-next">
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </li>
      </ul>
    </nav>
  )
}

function FeaturedCard({ nft }: { nft?: HighlightsResponse['featured'] }) {
  return (
    <div className="mt-6 overflow-hidden rounded-[16px] bg-gradient-to-b from-surface to-transparent">
      <p className="px-5 pt-5 text-xl font-medium tracking-[0.05em] text-copper">NFT EM DESTAQUE</p>
      <p className="px-5 pb-3 text-center text-lg font-bold tracking-[0.05em] text-cream">OFERTA LIMITADA</p>
      {nft ? (
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="block" aria-label={`Destaque: ${nft.name}, ${formatEth(nft.price)}`}>
          <NftImage art={nft.image} alt={nft.imageAlt} width={320} sizes="310px" className="rounded-[16px]" />
        </Link>
      ) : (
        <Skeleton className="aspect-square w-full rounded-[16px]" />
      )}
    </div>
  )
}

function Drops({ data }: { data?: HighlightsResponse }) {
  return (
    <section aria-label="Lançamentos" className="mt-20 hidden gap-8 md:grid lg:grid-cols-2">
      {data
        ? data.drops.map((d) => (
            <article key={d.id} className="flex overflow-hidden rounded-[6px] bg-surface">
              <div className="w-[42%] shrink-0 lg:w-[285px]">
                <NftImage art={d.image} alt="" width={320} sizes="285px" className="h-full" />
              </div>
              <div className="flex flex-col items-end justify-center gap-3 p-4 text-right">
                <h3 className="text-[17px] font-bold text-cream">{d.title}</h3>
                <p className="text-[13px] leading-6 text-sand-2">{d.body}</p>
                <Link to="/nft/$nftId" params={{ nftId: d.nftId }} className="inline-flex items-center gap-1 rounded-[3px] bg-copper px-5 py-2 text-[13px] font-bold text-ink hover:bg-copper-bright">
                  Explorar <ArrowRight className="size-4" aria-hidden />
                  <span className="sr-only">: {d.title}</span>
                </Link>
              </div>
            </article>
          ))
        : [0, 1].map((i) => <Skeleton key={i} className="h-[250px]" />)}
    </section>
  )
}

function Journal({ data }: { data?: HighlightsResponse }) {
  return (
    <section aria-labelledby="journal-title" className="mt-24 hidden md:block">
      <h2 id="journal-title" className="text-center text-[28px] font-bold text-cream">
        Diário da Cunhagem
      </h2>
      <p className="mt-2 text-center text-sm text-sand-2">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      <ul className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-4">
        {(data?.journal ?? Array.from({ length: 4 }, (_, i) => ({ id: `s${i}` }) as never)).map((j: HighlightsResponse['journal'][number]) =>
          j.title ? (
            <li key={j.id} className="overflow-hidden rounded-[6px] bg-surface">
              <NftImage art={j.image} alt="" width={320} sizes="270px" className="aspect-[3/2]" />
              <div className="p-4">
                <p className="text-xs text-sand-2">
                  {j.date} | {j.readTime}
                </p>
                <h3 className="mt-2 text-base font-bold text-cream">{j.title}</h3>
                <p className="mt-2 text-[13px] text-sand">{j.excerpt}</p>
                <button type="button" onClick={() => notAvailable('O conteúdo editorial')} className="mt-2 text-[13px] font-bold text-copper hover:underline">
                  Ler mais <span aria-hidden>→</span>
                  <span className="sr-only">: {j.title}</span>
                </button>
              </div>
            </li>
          ) : (
            <li key={j.id}>
              <Skeleton className="h-[360px]" />
            </li>
          ),
        )}
      </ul>
    </section>
  )
}
