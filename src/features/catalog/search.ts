/**
 * Estado do catálogo na URL. Busca, filtros, ordenação e paginação são
 * parâmetros de busca da rota "/" — sobrevivem a refresh e navegação pelo
 * histórico. Valores inválidos são descartados (fallback para o padrão).
 */
import type { CatalogSort, CatalogTab, CollectionId, Network, NftListQuery } from '@/api/contracts'
import { isEthString } from '@/lib/eth'

export interface CatalogSearch {
  q?: string
  /** Coleções separadas por vírgula. */
  col?: string
  /** Redes separadas por vírgula. */
  net?: string
  min?: string
  max?: string
  tab?: CatalogTab
  sort?: CatalogSort
  page?: number
}

export const COLLECTION_IDS: CollectionId[] = ['arte-digital', 'fotografia', 'musica', 'arte-3d', 'colecionaveis', 'generativa', 'jogos', 'assinaturas', 'utilidade']
export const NETWORK_IDS: Network[] = ['ethereum', 'polygon', 'solana']
const TABS: CatalogTab[] = ['all', 'new', 'trending']
const SORTS: CatalogSort[] = ['recent', 'price-asc', 'price-desc', 'name']

const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined)

function list<T extends string>(v: unknown, allowed: T[]): string | undefined {
  const s = str(v)
  if (!s) return undefined
  const items = [...new Set(s.split(',').filter((x): x is T => allowed.includes(x as T)))]
  return items.length ? items.sort().join(',') : undefined
}

export function validateCatalogSearch(raw: Record<string, unknown>): CatalogSearch {
  const q = str(raw.q)?.slice(0, 80).trim()
  const min = str(raw.min)
  const max = str(raw.max)
  const page = Number(raw.page)
  const tab = str(raw.tab) as CatalogTab | undefined
  const sort = str(raw.sort) as CatalogSort | undefined
  return {
    q: q || undefined,
    col: list(raw.col, COLLECTION_IDS),
    net: list(raw.net, NETWORK_IDS),
    min: min && isEthString(min) ? min : undefined,
    max: max && isEthString(max) ? max : undefined,
    tab: tab && TABS.includes(tab) && tab !== 'all' ? tab : undefined,
    sort: sort && SORTS.includes(sort) && sort !== 'recent' ? sort : undefined,
    page: Number.isInteger(page) && page > 1 ? page : undefined,
  }
}

export const PAGE_SIZE = 9

export function toListQuery(s: CatalogSearch): NftListQuery {
  return {
    q: s.q,
    collections: s.col ? (s.col.split(',') as CollectionId[]) : undefined,
    networks: s.net ? (s.net.split(',') as Network[]) : undefined,
    minPrice: s.min,
    maxPrice: s.max,
    tab: s.tab ?? 'all',
    sort: s.sort ?? 'recent',
    page: s.page ?? 1,
    pageSize: PAGE_SIZE,
  }
}

export function toggleInList(current: string | undefined, value: string): string | undefined {
  const set = new Set(current ? current.split(',') : [])
  if (set.has(value)) set.delete(value)
  else set.add(value)
  return set.size ? [...set].sort().join(',') : undefined
}
