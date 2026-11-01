/**
 * Estado do backend simulado. Uma única fonte de verdade consistente entre
 * catálogo, favoritos, carrinho, perfil, carteiras e pedidos — usada tanto
 * pelos handlers REST quanto pelos eventos Socket.IO.
 *
 * Persistência: localStorage (`kurio.mock.db.v2`) para sustentar refresh.
 * `resetDb()` restaura integralmente o cenário conhecido das fixtures.
 */
import type { Cart, Order, Quote, User, Wallet, WalletSlot } from '@/api/contracts'
import { buildNfts, SEED_USERS, SEED_WALLETS, type DbNft } from './fixtures'

export interface DbUser extends User {
  passwordHash: string
  salt: string
}

export interface DbOrder extends Order {
  settleAt: number
  idempotencyKey: string
  requestHash: string
  /** Reserva de disponibilidade feita na criação. */
  reserved: boolean
}

export interface DbWallets {
  primary: Wallet | null
  secondary: Wallet | null
  secondarySameAsPrimary: boolean
}

export interface DbState {
  schema: 2
  nfts: DbNft[]
  users: DbUser[]
  /** expiresAt: expiração deslizante; createdAt: base da duração máxima absoluta. */
  sessions: Record<string, { userId: string; expiresAt: number; createdAt: number }>
  /** Falhas de login por e-mail (timestamps) — limitação de tentativas. */
  loginFailures: Record<string, number[]>
  favorites: Record<string, string[]>
  carts: Record<string, Cart>
  wallets: Record<string, DbWallets>
  quotes: Record<string, Quote & { cartId: string }>
  orders: Record<string, DbOrder>
  idempotency: Record<string, { orderId: string; requestHash: string }>
  seq: number
}

const KEY = 'kurio.mock.db.v2'
export let db: DbState

const toHex = (buf: ArrayBuffer | Uint8Array) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/**
 * Hash de senha com PBKDF2-SHA256 (210.000 iterações, recomendação OWASP),
 * salt aleatório de 16 bytes por usuário. Senhas nunca são armazenadas em claro.
 */
export async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 210_000 }, key, 256)
  return toHex(bits)
}

export function newSalt() {
  return toHex(crypto.getRandomValues(new Uint8Array(16)))
}

/** Comparação em tempo constante (evita vazar informação pelo tempo de resposta). */
export function safeEqual(a: string, b: string) {
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}

export async function verifyPassword(user: { salt: string; passwordHash: string } | undefined, password: string) {
  // Sem usuário, calcula um hash mesmo assim: o tempo de resposta não revela se o e-mail existe.
  const hash = await hashPassword(password, user?.salt ?? 'no-such-user-salt')
  return !!user && safeEqual(hash, user.passwordHash)
}

export function randomId(prefix = '') {
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return prefix + [...bytes].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16)
}

function emptyWallet(slot: WalletSlot, input: NonNullable<(typeof SEED_WALLETS)[string]['primary']>): Wallet {
  return { ...input, slot, version: 1, connection: { status: 'disconnected', network: null, connectedAt: null } }
}

async function seed(): Promise<DbState> {
  const users: DbUser[] = []
  for (const u of SEED_USERS) {
    users.push({
      id: u.id,
      email: u.email,
      username: u.username,
      displayName: u.displayName,
      ensName: u.ensName,
      walletNickname: u.walletNickname,
      avatar: null,
      version: 1,
      salt: u.salt,
      passwordHash: u.passwordHash,
    })
  }
  const wallets: Record<string, DbWallets> = {}
  for (const [uid, w] of Object.entries(SEED_WALLETS)) {
    wallets[uid] = {
      primary: w.primary ? emptyWallet('primary', w.primary) : null,
      secondary: w.secondary ? emptyWallet('secondary', w.secondary) : null,
      secondarySameAsPrimary: false,
    }
  }
  return {
    schema: 2,
    nfts: buildNfts(),
    users,
    sessions: {},
    loginFailures: {},
    favorites: {},
    carts: {},
    wallets,
    quotes: {},
    orders: {},
    idempotency: {},
    seq: 0,
  }
}

export async function initDb(forceReset = false) {
  if (!forceReset) {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as DbState
        if (parsed.schema === 2) {
          db = parsed
          return
        }
      }
    } catch {
      /* corrompido: reseta */
    }
  }
  db = await seed()
  save()
}

export async function resetDb() {
  db = await seed()
  save()
}

export function save() {
  // Mantém apenas as 50 cotações mais recentes.
  const quoteIds = Object.keys(db.quotes)
  if (quoteIds.length > 50) {
    quoteIds
      .sort((a, b) => Date.parse(db.quotes[a].createdAt) - Date.parse(db.quotes[b].createdAt))
      .slice(0, quoteIds.length - 50)
      .forEach((id) => delete db.quotes[id])
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* quota: segue em memória */
  }
}

export const nextSeq = () => ++db.seq

export function publicUser(u: DbUser): User {
  const { passwordHash: _h, salt: _s, ...rest } = u
  return rest
}
