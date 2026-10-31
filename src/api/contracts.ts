/**
 * Contratos REST e de eventos compartilhados entre transporte (Axios),
 * estado (TanStack Query), interface e camada de mocks (MSW).
 *
 * Regras:
 * - Valores em ETH trafegam SEMPRE como string decimal (ex.: "1.19").
 * - Quantidades são inteiros.
 * - Recursos mutáveis carregam `version` (inteiro monotônico) para
 *   reconciliação entre REST e Socket.IO.
 */

export type EthString = string
export type ISODate = string

/* ------------------------------------------------------------------ */
/* Erros                                                               */
/* ------------------------------------------------------------------ */

export type ApiErrorCode =
  | 'VALIDATION_ERROR' // 422
  | 'UNAUTHENTICATED' // 401
  | 'SESSION_EXPIRED' // 401
  | 'FORBIDDEN' // 403
  | 'NOT_FOUND' // 404
  | 'EMAIL_TAKEN' // 409
  | 'USERNAME_TAKEN' // 409
  | 'AVAILABILITY_CONFLICT' // 409
  | 'QUOTE_STALE' // 409
  | 'IDEMPOTENCY_CONFLICT' // 409
  | 'COUPON_INVALID' // 422
  | 'COUPON_EXPIRED' // 422
  | 'WALLET_REJECTED' // 403
  | 'WALLET_NOT_CONNECTED' // 409
  | 'TRANSIENT' // 503
  | 'INTERNAL' // 500

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    /** Erros por campo (validação). */
    fields?: Record<string, string>
    /** Dados adicionais (ex.: nova cotação em QUOTE_STALE). */
    details?: unknown
  }
}

/* ------------------------------------------------------------------ */
/* Catálogo                                                            */
/* ------------------------------------------------------------------ */

export type Network = 'ethereum' | 'polygon' | 'solana'
export type CollectionId =
  | 'arte-digital'
  | 'fotografia'
  | 'musica'
  | 'arte-3d'
  | 'colecionaveis'
  | 'generativa'
  | 'jogos'
  | 'assinaturas'
  | 'utilidade'

export type CatalogTab = 'all' | 'new' | 'trending'
export type CatalogSort = 'recent' | 'price-asc' | 'price-desc' | 'name'

export interface Edition {
  id: string // ex.: "1-50"
  label: string // ex.: "1/50"
  price: EthString
  /** Unidades disponíveis para compra. 0 = esgotada. */
  available: number
  /** Limite por pedido (independente da disponibilidade). */
  maxPerOrder: number
}

export interface NftSummary {
  id: string
  name: string
  tokenId: string // "#0042"
  image: string // chave da arte (ex.: "ape-a")
  imageAlt: string
  collection: CollectionId
  network: Network
  /** Menor preço entre as edições disponíveis. */
  price: EthString
  /** Preço anterior (promoção), quando houver. */
  previousPrice: EthString | null
  rare: boolean
  available: number
  createdAt: ISODate
  version: number
}

export interface NftDetail extends NftSummary {
  description: string
  longDescription: string[]
  collectionName: string
  attributes: string[]
  editions: Edition[]
  rating: number
  reviewsCount: number
  contract: string
  royaltiesPercent: number
  gallery: string[]
}

export interface Facet<T extends string = string> {
  id: T
  label: string
  count: number
}

export interface NftListQuery {
  q?: string
  collections?: CollectionId[]
  networks?: Network[]
  minPrice?: string
  maxPrice?: string
  tab?: CatalogTab
  sort?: CatalogSort
  page?: number
  pageSize?: number
}

export interface NftListResponse {
  items: NftSummary[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  facets: {
    collections: Facet<CollectionId>[]
    networks: Facet<Network>[]
    priceRange: { min: EthString; max: EthString }
  }
  /** Eco dos parâmetros efetivamente aplicados pela API. */
  applied: Required<Pick<NftListQuery, 'tab' | 'sort' | 'page' | 'pageSize'>> & NftListQuery
}

export interface HighlightsResponse {
  hero: NftSummary[]
  featured: NftSummary
  drops: { id: string; title: string; body: string; image: string; nftId: string }[]
  journal: { id: string; date: string; readTime: string; title: string; excerpt: string; image: string }[]
}

/* ------------------------------------------------------------------ */
/* Sessão e conta                                                      */
/* ------------------------------------------------------------------ */

export interface User {
  id: string
  email: string
  username: string
  displayName: string
  ensName: string
  walletNickname: string
  avatar: string | null // data URL
  version: number
}

export interface Session {
  token: string
  user: User
  expiresAt: ISODate
}

export interface LoginRequest {
  email: string
  password: string
  /** Carrinho de visitante a ser mesclado na conta. */
  guestCartId?: string
}

export interface SignupRequest {
  username: string
  email: string
  password: string
  guestCartId?: string
}

export interface ProfileUpdateRequest {
  displayName: string
  username: string
  email: string
  ensName: string
  walletNickname: string
}

export interface PasswordChangeRequest {
  currentPassword: string
  newPassword: string
}

export interface AvatarUpdateRequest {
  /** data URL (image/png|jpeg|webp), até 1 MB. */
  dataUrl: string
}

/* ------------------------------------------------------------------ */
/* Favoritos                                                           */
/* ------------------------------------------------------------------ */

export interface FavoritesResponse {
  ids: string[]
  items: NftSummary[]
}

/* ------------------------------------------------------------------ */
/* Carrinho e cotação                                                  */
/* ------------------------------------------------------------------ */

export interface CartItem {
  nftId: string
  editionId: string
  quantity: number
  /** Snapshot informativo; a cotação é a referência de preço. */
  name: string
  image: string
  tokenId: string
  editionLabel: string
  unitPrice: EthString
  available: number
  maxPerOrder: number
}

export interface Cart {
  id: string
  owner: 'guest' | 'user'
  items: CartItem[]
  couponCode: string | null
  version: number
  updatedAt: ISODate
}

export interface CartItemInput {
  nftId: string
  editionId: string
  quantity: number
}

export interface QuoteLine {
  nftId: string
  editionId: string
  name: string
  tokenId: string
  image: string
  editionLabel: string
  quantity: number
  unitPrice: EthString
  lineTotal: EthString
  available: number
  issue: null | 'PRICE_CHANGED' | 'INSUFFICIENT_AVAILABILITY' | 'SOLD_OUT'
  previousUnitPrice?: EthString
}

export interface Quote {
  id: string
  cartVersion: number
  network: Network
  lines: QuoteLine[]
  subtotal: EthString
  discount: EthString
  networkFee: EthString
  total: EthString
  coupon: { code: string; percent: number } | null
  /** Assinatura do conteúdo (preços, quantidades, cupom, taxa). */
  fingerprint: string
  createdAt: ISODate
  expiresAt: ISODate
  hasIssues: boolean
}

export interface QuoteRequest {
  network: Network
}

/* ------------------------------------------------------------------ */
/* Carteiras                                                           */
/* ------------------------------------------------------------------ */

export type WalletSlot = 'primary' | 'secondary'
export type WalletProvider = 'metamask' | 'walletconnect' | 'coinbase'

export interface Wallet {
  slot: WalletSlot
  displayName: string
  nickname: string
  network: Network
  profileName: string
  address: string
  ensOrSecondary: string
  provider: WalletProvider
  referralCode: string
  email: string
  ensName: string
  version: number
  connection: { status: 'connected' | 'disconnected'; network: Network | null; connectedAt: ISODate | null }
}

export type WalletInput = Omit<Wallet, 'slot' | 'version' | 'connection'>

export interface WalletsResponse {
  primary: Wallet | null
  secondary: Wallet | null
  secondarySameAsPrimary: boolean
}

export interface WalletConnectRequest {
  provider: WalletProvider
  network: Network
}

/* ------------------------------------------------------------------ */
/* Pedidos                                                             */
/* ------------------------------------------------------------------ */

export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export interface BuyerInfo {
  displayName: string
  username: string
  profileName: string
  email: string
  referralCode: string
  ensName: string
  note: string
}

export interface CreateOrderRequest {
  quoteId: string
  quoteFingerprint: string
  walletSlot: WalletSlot
  provider: WalletProvider
  network: Network
  buyer: BuyerInfo
}

export interface OrderLine {
  nftId: string
  editionId: string
  name: string
  tokenId: string
  image: string
  editionLabel: string
  quantity: number
  unitPrice: EthString
  lineTotal: EthString
}

export interface Order {
  id: string
  userId: string
  status: OrderStatus
  version: number
  createdAt: ISODate
  updatedAt: ISODate
  network: Network
  walletSlot: WalletSlot
  walletAddress: string
  provider: WalletProvider
  lines: OrderLine[]
  subtotal: EthString
  discount: EthString
  networkFee: EthString
  total: EthString
  couponCode: string | null
  transaction: { hash: string; explorerUrl: string } | null
  failureReason: string | null
}

/* ------------------------------------------------------------------ */
/* Eventos em tempo real (Socket.IO)                                   */
/* ------------------------------------------------------------------ */

export interface RealtimeEnvelope<TType extends string, TData> {
  /** Identidade estável do evento (dedupe). */
  id: string
  type: TType
  resource: { type: 'nft' | 'order'; id: string }
  /** Versão do recurso APÓS o evento. */
  version: number
  occurredAt: ISODate
  /** Dono do recurso, quando privado. */
  userId: string | null
  data: TData
}

export interface NftUpdatedData {
  price: EthString
  previousPrice: EthString | null
  available: number
  editions: Pick<Edition, 'id' | 'price' | 'available'>[]
}

export type NftUpdatedEvent = RealtimeEnvelope<'nft.updated', NftUpdatedData>
export type OrderUpdatedEvent = RealtimeEnvelope<'order.updated', { status: OrderStatus; order: Order }>

export interface ServerToClientEvents {
  'nft.updated': (event: NftUpdatedEvent) => void
  'order.updated': (event: OrderUpdatedEvent) => void
}
