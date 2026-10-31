/**
 * Fixtures determinísticas. Geradas a partir de uma semente fixa para que
 * todo reset produza exatamente o mesmo cenário conhecido.
 */
import type { CollectionId, Edition, Network, NftDetail, WalletInput } from '@/api/contracts'
import { mulInt, percentOf } from '@/lib/eth'

export const FIXTURE_NOW = '2026-07-29T12:00:00.000Z'

export const COLLECTIONS: { id: CollectionId; label: string }[] = [
  { id: 'arte-digital', label: 'Arte digital' },
  { id: 'fotografia', label: 'Fotografia' },
  { id: 'musica', label: 'Música' },
  { id: 'arte-3d', label: 'Arte 3D' },
  { id: 'colecionaveis', label: 'Colecionáveis' },
  { id: 'generativa', label: 'Generativa' },
  { id: 'jogos', label: 'Jogos' },
  { id: 'assinaturas', label: 'Assinaturas' },
  { id: 'utilidade', label: 'Utilidade' },
]

export const NETWORKS: { id: Network; label: string }[] = [
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'solana', label: 'Solana' },
]

const ART = {
  'ape-a': 'Macaco de pelo castanho com óculos redondos verdes e jaqueta college verde',
  'ape-b': 'Gorila cinza com chapéu bucket verde-sálvia e moletom roxo',
  'ape-c': 'Gorila de pelo preto com gola alta verde e blazer creme',
  'ape-d': 'Macaco dourado com fones de ouvido verdes e jaqueta creme',
} as const
type ArtKey = keyof typeof ART

export interface DbNft extends NftDetail {
  trending: boolean
}

/** NFTs do layout (nomes, artes e preços do Figma). */
const DESIGNED: { name: string; token: string; art: ArtKey; price: string; prev?: string; rare?: boolean; collection: CollectionId; network: Network; trending?: boolean }[] = [
  { name: 'Emerald Ape', token: '042', art: 'ape-a', price: '1.19', collection: 'arte-digital', network: 'ethereum', trending: true },
  { name: 'Sage Nomad', token: '009', art: 'ape-b', price: '1.69', collection: 'arte-digital', network: 'ethereum', trending: true },
  { name: 'Neon Vessel', token: '552', art: 'ape-c', price: '1.99', prev: '2.29', rare: true, collection: 'colecionaveis', network: 'ethereum' },
  { name: 'Cosmic Bloom', token: '118', art: 'ape-b', price: '1.29', collection: 'generativa', network: 'polygon' },
  { name: 'Violet Nomad', token: '314', art: 'ape-b', price: '1.39', collection: 'arte-digital', network: 'ethereum', trending: true },
  { name: 'Ivory Baron', token: '088', art: 'ape-c', price: '1.79', collection: 'arte-3d', network: 'ethereum' },
  { name: 'Golden Beat', token: '207', art: 'ape-d', price: '0.99', collection: 'musica', network: 'polygon', trending: true },
  { name: 'Golden Frequency', token: '071', art: 'ape-d', price: '0.59', collection: 'musica', network: 'solana' },
  { name: 'Golden Signal', token: '160', art: 'ape-d', price: '0.39', collection: 'musica', network: 'ethereum' },
]

const ADJ = ['Amber', 'Velvet', 'Rustic', 'Lunar', 'Copper', 'Midnight', 'Quiet', 'Electric', 'Dusty', 'Royal', 'Hidden', 'Silent', 'Crimson', 'Jade', 'Solar', 'Feral', 'Mellow', 'Woven']
const NOUN = ['Ape', 'Nomad', 'Baron', 'Beat', 'Signal', 'Bloom', 'Vessel', 'Drifter', 'Pilot', 'Monk', 'Echo', 'Relic', 'Sage', 'Rider']

function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function editionsFor(base: string, r: () => number, soldOutOneOfOne: boolean): Edition[] {
  return [
    { id: '1-1', label: '1/1', price: mulInt(base, 4), available: soldOutOneOfOne ? 0 : 1, maxPerOrder: 1 },
    { id: '1-10', label: '1/10', price: mulInt(base, 2), available: 3 + Math.floor(r() * 8), maxPerOrder: 3 },
    { id: '1-50', label: '1/50', price: base, available: 12 + Math.floor(r() * 38), maxPerOrder: 10 },
    { id: 'open', label: 'ABERTA', price: percentOf(base, 50), available: 200, maxPerOrder: 20 },
  ]
}

const COLLECTION_NAMES: Record<CollectionId, string> = {
  'arte-digital': 'Kurio Editions',
  fotografia: 'Kurio Lens',
  musica: 'Kurio Sound',
  'arte-3d': 'Kurio Sculpt',
  colecionaveis: 'Kurio Apes',
  generativa: 'Kurio Genesis',
  jogos: 'Kurio Arcade',
  assinaturas: 'Kurio Pass',
  utilidade: 'Kurio Utility',
}

function buildNft(i: number, d: (typeof DESIGNED)[number] | null, r: () => number): DbNft {
  const art: ArtKey = d?.art ?? (['ape-a', 'ape-b', 'ape-c', 'ape-d'] as const)[i % 4]
  const name = d ? `${d.name} #${d.token}` : `${ADJ[i % ADJ.length]} ${NOUN[(i * 7) % NOUN.length]} #${String(200 + i * 13).padStart(3, '0')}`
  const tokenId = `#${(d ? d.token : String(200 + i * 13)).padStart(4, '0')}`
  const collection = d?.collection ?? COLLECTIONS[(i * 5 + Math.floor(r() * 3)) % COLLECTIONS.length].id
  const network = d?.network ?? NETWORKS[Math.floor(r() * 3)].id
  // Preços entre 0.02 e 3.08 ETH, com 2 casas (edição 1/50).
  const cents = d ? null : 2 + Math.floor(r() * 306)
  const base = d?.price ?? `${Math.floor(cents! / 100)}.${String(cents! % 100).padStart(2, '0')}`
  const editions = editionsFor(base, r, i % 3 === 0)
  const createdAt = new Date(Date.parse(FIXTURE_NOW) - i * 2.5 * 86400000 - Math.floor(r() * 3600000)).toISOString()
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const collectionName = COLLECTION_NAMES[collection]
  const attrs = ({ 'ape-a': ['Óculos', 'Esmeralda'], 'ape-b': ['Chapéu', 'Moletom'], 'ape-c': ['Blazer', 'Gola alta'], 'ape-d': ['Fones', 'Dourado'] } as const)[art]
  return {
    id,
    name,
    tokenId,
    image: art,
    imageAlt: `${name}: ${ART[art]}`,
    collection,
    network,
    price: base,
    previousPrice: d?.prev ?? null,
    rare: d?.rare ?? i % 11 === 5,
    available: editions.reduce((s, e) => s + e.available, 0),
    createdAt,
    version: 1,
    description: `Um colecionável digital finalizado à mão da coleção ${collectionName}, verificado na ${labelNetwork(network)}, com arte desbloqueável e acesso para colecionadores.`,
    longDescription: [
      `${name} é uma obra digital 1/50 finalizada à mão da coleção ${collectionName}. Cada atributo fica armazenado nos metadados do token e verificado na ${labelNetwork(network)}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
      `A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. O criador recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.`,
    ],
    collectionName,
    attributes: [...attrs, ...(d?.rare || i % 11 === 5 ? ['Raro'] : ['Comum'])],
    editions,
    rating: 4 + Math.round(r() * 10) / 10,
    reviewsCount: 3 + Math.floor(r() * 40),
    contract: `0x${(0x7a42 + i).toString(16).toUpperCase()}...${(0x19e8 + i * 3).toString(16).toUpperCase()}`,
    royaltiesPercent: 5,
    gallery: [art, art, art, art],
    trending: d?.trending ?? r() > 0.72,
  }
}

export function labelNetwork(n: Network) {
  return NETWORKS.find((x) => x.id === n)!.label
}

export function buildNfts(): DbNft[] {
  const r = seeded(20260729)
  const out: DbNft[] = []
  DESIGNED.forEach((d, i) => out.push(buildNft(i, d, r)))
  for (let i = DESIGNED.length; i < 48; i++) out.push(buildNft(i, null, r))
  // Ajustes do layout: a Emerald Ape 1/1 está disponível; Neon Vessel 1/1 esgotada.
  out[0].editions[0].available = 1
  out[2].editions[0].available = 0
  out.forEach((n) => (n.available = n.editions.reduce((s, e) => s + e.available, 0)))
  return out
}

export const SEED_USERS = [
  {
    id: 'u_ana',
    email: 'ana@kurio.dev',
    username: 'ana.souza',
    displayName: 'Ana Souza',
    ensName: 'ana',
    walletNickname: 'Principal',
    password: 'Kurio@123',
  },
  {
    id: 'u_bruno',
    email: 'bruno@kurio.dev',
    username: 'bruno.lima',
    displayName: 'Bruno Lima',
    ensName: 'bruno',
    walletNickname: 'Cofre',
    password: 'Kurio@123',
  },
] as const

export const SEED_WALLETS: Record<string, { primary: WalletInput | null; secondary: WalletInput | null }> = {
  u_ana: {
    primary: {
      displayName: 'Ana Souza',
      nickname: 'Principal',
      network: 'ethereum',
      profileName: 'ana.souza',
      address: '0xA91F3b6E2d1c4F0a8B7e9C5d3A2b1F0e4D6cE82C',
      ensOrSecondary: '',
      provider: 'metamask',
      referralCode: 'KURIO-ANA',
      email: 'ana@kurio.dev',
      ensName: 'ana',
    },
    secondary: {
      displayName: 'Ana Souza',
      nickname: 'Reserva',
      network: 'polygon',
      profileName: 'ana.souza',
      address: '0x5C2e8B1d7A4f9E3c6B0a2D8f1E7c4B9a3D6f0E1A',
      ensOrSecondary: 'nova.kurio.eth',
      provider: 'coinbase',
      referralCode: 'KURIO-ANA',
      email: 'ana@kurio.dev',
      ensName: 'nova.kurio',
    },
  },
  u_bruno: { primary: null, secondary: null },
}

export const COUPONS: Record<string, { percent: number; expiresAt: string; minSubtotal?: string }> = {
  KURIO10: { percent: 10, expiresAt: '2099-12-31T23:59:59.000Z' },
  GENESIS25: { percent: 25, expiresAt: '2099-12-31T23:59:59.000Z', minSubtotal: '2' },
  VERAO2025: { percent: 15, expiresAt: '2025-03-01T00:00:00.000Z' },
}

export const NETWORK_FEES: Record<Network, string> = {
  ethereum: '0.016',
  polygon: '0.002',
  solana: '0.001',
}

export const JOURNAL = [
  { id: 'j1', date: '12 de setembro', readTime: 'Leitura de 6 min', title: 'Como funciona a propriedade de NFTs', excerpt: 'Aprenda a colecionar, negociar e verificar ativos digitais.', image: 'ape-c' },
  { id: 'j2', date: '13 de setembro', readTime: 'Leitura de 2 min', title: '10 artistas digitais para acompanhar', excerpt: 'Conheça criadores que moldam a cultura digital.', image: 'ape-a' },
  { id: 'j3', date: '15 de setembro', readTime: 'Leitura de 3 min', title: 'Raridade, atributos e procedência', excerpt: 'Entenda raridade, procedência, direitos autorais e utilidade.', image: 'ape-b' },
  { id: 'j4', date: '15 de setembro', readTime: 'Leitura de 2 min', title: 'Como proteger sua carteira', excerpt: 'Proteja sua carteira, seus ativos e sua identidade.', image: 'ape-d' },
]
