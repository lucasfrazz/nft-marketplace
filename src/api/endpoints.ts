/** Funções de acesso aos recursos REST — todas passam pelo cliente Axios. */
import { request } from './http'
import type {
  AvatarUpdateRequest,
  Cart,
  CartItemInput,
  CreateOrderRequest,
  FavoritesResponse,
  HighlightsResponse,
  LoginRequest,
  NftDetail,
  NftListQuery,
  NftListResponse,
  NftSummary,
  Order,
  PasswordChangeRequest,
  ProfileUpdateRequest,
  Quote,
  QuoteRequest,
  Session,
  SignupRequest,
  User,
  WalletConnectRequest,
  WalletInput,
  WalletSlot,
  WalletsResponse,
} from './contracts'

type Opts = { signal?: AbortSignal }

export const authApi = {
  signup: (body: SignupRequest) => request<Session>({ method: 'POST', url: '/auth/signup', data: body }),
  login: (body: LoginRequest) => request<Session>({ method: 'POST', url: '/auth/login', data: body }),
  session: (o?: Opts) => request<Session>({ method: 'GET', url: '/auth/session', signal: o?.signal }),
  logout: () => request<void>({ method: 'POST', url: '/auth/logout' }),
}

export function toListParams(q: NftListQuery) {
  return {
    q: q.q || undefined,
    collections: q.collections?.length ? q.collections.join(',') : undefined,
    networks: q.networks?.length ? q.networks.join(',') : undefined,
    minPrice: q.minPrice || undefined,
    maxPrice: q.maxPrice || undefined,
    tab: q.tab && q.tab !== 'all' ? q.tab : undefined,
    sort: q.sort && q.sort !== 'recent' ? q.sort : undefined,
    page: q.page && q.page > 1 ? q.page : undefined,
    pageSize: q.pageSize,
  }
}

export const catalogApi = {
  list: (q: NftListQuery, o?: Opts) => request<NftListResponse>({ method: 'GET', url: '/nfts', params: toListParams(q), signal: o?.signal }),
  detail: (id: string, o?: Opts) => request<NftDetail>({ method: 'GET', url: `/nfts/${encodeURIComponent(id)}`, signal: o?.signal }),
  related: (id: string, o?: Opts) => request<{ items: NftSummary[] }>({ method: 'GET', url: `/nfts/${encodeURIComponent(id)}/related`, signal: o?.signal }),
  highlights: (o?: Opts) => request<HighlightsResponse>({ method: 'GET', url: '/highlights', signal: o?.signal }),
}

export const favoritesApi = {
  list: (o?: Opts) => request<FavoritesResponse>({ method: 'GET', url: '/favorites', signal: o?.signal }),
  add: (nftId: string) => request<FavoritesResponse>({ method: 'PUT', url: `/favorites/${encodeURIComponent(nftId)}` }),
  remove: (nftId: string) => request<FavoritesResponse>({ method: 'DELETE', url: `/favorites/${encodeURIComponent(nftId)}` }),
}

const itemUrl = (nftId: string, editionId: string) => `/cart/items/${encodeURIComponent(nftId)}/${encodeURIComponent(editionId)}`

export const cartApi = {
  get: (o?: Opts) => request<Cart>({ method: 'GET', url: '/cart', signal: o?.signal }),
  add: (body: CartItemInput) => request<Cart>({ method: 'POST', url: '/cart/items', data: body }),
  setQuantity: (nftId: string, editionId: string, quantity: number) => request<Cart>({ method: 'PATCH', url: itemUrl(nftId, editionId), data: { quantity } }),
  remove: (nftId: string, editionId: string) => request<Cart>({ method: 'DELETE', url: itemUrl(nftId, editionId) }),
  applyCoupon: (code: string) => request<Cart>({ method: 'PUT', url: '/cart/coupon', data: { code } }),
  removeCoupon: () => request<Cart>({ method: 'DELETE', url: '/cart/coupon' }),
  acknowledge: () => request<Cart>({ method: 'POST', url: '/cart/acknowledge' }),
  quote: (body: QuoteRequest, o?: Opts) => request<Quote>({ method: 'POST', url: '/quotes', data: body, signal: o?.signal }),
}

export const ordersApi = {
  create: (body: CreateOrderRequest, idempotencyKey: string) =>
    request<Order>({ method: 'POST', url: '/orders', data: body, headers: { 'Idempotency-Key': idempotencyKey }, timeout: 6_000 }),
  get: (id: string, o?: Opts) => request<Order>({ method: 'GET', url: `/orders/${encodeURIComponent(id)}`, signal: o?.signal }),
  list: (status?: Order['status'], o?: Opts) => request<{ items: Order[] }>({ method: 'GET', url: '/orders', params: { status }, signal: o?.signal }),
}

export const profileApi = {
  get: (o?: Opts) => request<User>({ method: 'GET', url: '/profile', signal: o?.signal }),
  update: (body: ProfileUpdateRequest) => request<User>({ method: 'PATCH', url: '/profile', data: body }),
  setAvatar: (body: AvatarUpdateRequest) => request<User>({ method: 'PUT', url: '/profile/avatar', data: body }),
  removeAvatar: () => request<User>({ method: 'DELETE', url: '/profile/avatar' }),
  changePassword: (body: PasswordChangeRequest) => request<void>({ method: 'POST', url: '/profile/password', data: body }),
}

export const walletsApi = {
  get: (o?: Opts) => request<WalletsResponse>({ method: 'GET', url: '/wallets', signal: o?.signal }),
  save: (slot: WalletSlot, body: WalletInput | { sameAsPrimary: true }) => request<WalletsResponse>({ method: 'PUT', url: `/wallets/${slot}`, data: body }),
  connect: (slot: WalletSlot, body: WalletConnectRequest) => request<WalletsResponse>({ method: 'POST', url: `/wallets/${slot}/connect`, data: body }),
  disconnect: (slot: WalletSlot) => request<WalletsResponse>({ method: 'POST', url: `/wallets/${slot}/disconnect` }),
}
