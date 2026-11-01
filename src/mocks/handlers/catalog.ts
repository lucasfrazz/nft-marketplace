import { http, HttpResponse } from 'msw'
import type { CatalogSort, CatalogTab, CollectionId, HighlightsResponse, Network, NftDetail, NftListResponse, NftSummary } from '@/api/contracts'
import { compare, isEthString } from '@/lib/eth'
import { hasScenario, subscribeConfig } from '../config'
import { db } from '../db'
import { COLLECTIONS, JOURNAL, NETWORKS, type DbNft } from '../fixtures'
import { API, HttpError, route } from '../http'

export function toSummary(n: DbNft): NftSummary {
  return {
    id: n.id,
    name: n.name,
    tokenId: n.tokenId,
    image: n.image,
    imageAlt: n.imageAlt,
    collection: n.collection,
    network: n.network,
    price: n.price,
    previousPrice: n.previousPrice,
    rare: n.rare,
    available: n.available,
    createdAt: n.createdAt,
    version: n.version,
  }
}

export function toDetail(n: DbNft): NftDetail {
  const { trending: _t, ...rest } = n
  return { ...toSummary(n), ...rest }
}

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

const TABS: CatalogTab[] = ['all', 'new', 'trending']
const SORTS: CatalogSort[] = ['recent', 'price-asc', 'price-desc', 'name']

let listCounter = 0
let flakyFailures = 0
subscribeConfig(() => {
  flakyFailures = 0
  listCounter = 0
})

function catalogFaults() {
  if (hasScenario('catalog-error')) throw new HttpError(500, 'INTERNAL', 'Falha ao carregar o catálogo.')
}

/** `flaky-catalog` afeta somente a listagem (1ª consulta + 2 retries falham). */
function listFaults() {
  catalogFaults()
  if (hasScenario('flaky-catalog') && flakyFailures < 3) {
    flakyFailures++
    throw new HttpError(503, 'TRANSIENT', 'Serviço temporariamente indisponível.')
  }
}

function listLatency() {
  // `out-of-order`: requisições alternam entre lenta e rápida, garantindo
  // que uma resposta antiga chegue depois de uma mais recente.
  if (hasScenario('out-of-order')) return ++listCounter % 2 === 1 ? 1800 : 150
  return undefined
}

export const catalogHandlers = [
  http.get(
    `${API}/nfts`,
    async (info) => {
      const latency = listLatency()
      if (latency !== undefined) await new Promise((r) => setTimeout(r, latency))
      return route(async ({ request }) => {
        listFaults()
        const p = new URL(request.url).searchParams
        const fields: Record<string, string> = {}

        const q = (p.get('q') ?? '').trim()
        if (q.length > 80) fields.q = 'Busca muito longa (máximo de 80 caracteres).'
        const collections = (p.get('collections') ?? '').split(',').filter(Boolean) as CollectionId[]
        const networks = (p.get('networks') ?? '').split(',').filter(Boolean) as Network[]
        const tab = (p.get('tab') ?? 'all') as CatalogTab
        const sort = (p.get('sort') ?? 'recent') as CatalogSort
        const page = Number(p.get('page') ?? '1')
        const pageSize = Number(p.get('pageSize') ?? '9')
        const minPrice = p.get('minPrice') ?? undefined
        const maxPrice = p.get('maxPrice') ?? undefined

        if (!TABS.includes(tab)) fields.tab = 'Aba inválida.'
        if (!SORTS.includes(sort)) fields.sort = 'Ordenação inválida.'
        if (!Number.isInteger(page) || page < 1) fields.page = 'Página inválida.'
        if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 48) fields.pageSize = 'Tamanho de página inválido.'
        if (minPrice && !isEthString(minPrice)) fields.minPrice = 'Preço mínimo inválido.'
        if (maxPrice && !isEthString(maxPrice)) fields.maxPrice = 'Preço máximo inválido.'
        if (collections.some((c) => !COLLECTIONS.find((x) => x.id === c))) fields.collections = 'Coleção inválida.'
        if (networks.some((n) => !NETWORKS.find((x) => x.id === n))) fields.networks = 'Rede inválida.'
        if (Object.keys(fields).length) throw new HttpError(422, 'VALIDATION_ERROR', 'Parâmetros de busca inválidos.', fields)

        const all = hasScenario('empty-catalog') ? [] : db.nfts
        const newest = all.reduce((m, n) => Math.max(m, Date.parse(n.createdAt)), 0)

        const base = (n: DbNft, skip?: 'collections' | 'networks') => {
          if (q) {
            const hay = normalize(`${n.name} ${n.tokenId} ${n.collectionName}`)
            if (!hay.includes(normalize(q))) return false
          }
          if (tab === 'new' && newest - Date.parse(n.createdAt) > 30 * 86400000) return false
          if (tab === 'trending' && !n.trending) return false
          if (minPrice && compare(n.price, minPrice) < 0) return false
          if (maxPrice && compare(n.price, maxPrice) > 0) return false
          if (skip !== 'collections' && collections.length && !collections.includes(n.collection)) return false
          if (skip !== 'networks' && networks.length && !networks.includes(n.network)) return false
          return true
        }

        const filtered = all.filter((n) => base(n))
        const sorted = [...filtered].sort((a, b) => {
          switch (sort) {
            case 'price-asc':
              return compare(a.price, b.price) || a.name.localeCompare(b.name)
            case 'price-desc':
              return compare(b.price, a.price) || a.name.localeCompare(b.name)
            case 'name':
              return a.name.localeCompare(b.name)
            default:
              return Date.parse(b.createdAt) - Date.parse(a.createdAt)
          }
        })
        const total = sorted.length
        const totalPages = Math.max(1, Math.ceil(total / pageSize))
        const items = sorted.slice((page - 1) * pageSize, page * pageSize).map(toSummary)

        const prices = db.nfts.map((n) => n.price).sort(compare)
        const body: NftListResponse = {
          items,
          page,
          pageSize,
          total,
          totalPages,
          facets: {
            collections: COLLECTIONS.map((c) => ({ ...c, count: all.filter((n) => base(n, 'collections') && n.collection === c.id).length })),
            networks: NETWORKS.map((c) => ({ ...c, count: all.filter((n) => base(n, 'networks') && n.network === c.id).length })),
            priceRange: { min: prices[0] ?? '0', max: prices.at(-1) ?? '0' },
          },
          applied: { q, collections, networks, minPrice, maxPrice, tab, sort, page, pageSize },
        }
        return HttpResponse.json(body)
      })(info)
    },
  ),

  http.get(
    `${API}/nfts/:id`,
    route(({ params }) => {
      catalogFaults()
      const nft = db.nfts.find((n) => n.id === params.id)
      if (!nft) throw new HttpError(404, 'NOT_FOUND', 'NFT não encontrado.')
      return HttpResponse.json(toDetail(nft))
    }),
  ),

  http.get(
    `${API}/nfts/:id/related`,
    route(({ params }) => {
      const nft = db.nfts.find((n) => n.id === params.id)
      if (!nft) throw new HttpError(404, 'NOT_FOUND', 'NFT não encontrado.')
      const related = db.nfts.filter((n) => n.id !== nft.id && (n.collection === nft.collection || n.image === nft.image)).slice(0, 10)
      return HttpResponse.json({ items: related.map(toSummary) })
    }),
  ),

  http.get(
    `${API}/highlights`,
    route(() => {
      catalogFaults()
      const byId = (id: string) => db.nfts.find((n) => n.id === id)!
      const body: HighlightsResponse = {
        hero: ['emerald-ape-042', 'sage-nomad-009', 'golden-beat-207'].map((id) => toSummary(byId(id))),
        featured: toSummary(byId('cosmic-bloom-118')),
        drops: [
          { id: 'd1', title: 'Lançamentos gênesis de edição limitada', body: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.', image: 'ape-a', nftId: 'emerald-ape-042' },
          { id: 'd2', title: 'Arte digital selecionada e muito mais', body: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.', image: 'ape-c', nftId: 'ivory-baron-088' },
        ],
        journal: JOURNAL,
      }
      return HttpResponse.json(body)
    }),
  ),
]
