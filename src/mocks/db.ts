/**
 * Estado do backend simulado. Uma única fonte de verdade consistente entre
 * catálogo, favoritos, carrinho, perfil, carteiras e pedidos — usada tanto
 * pelos handlers REST quanto pelos eventos Socket.IO.
 *
 * Persistência: localStorage (`kurio.mock.db.v1`) para sustentar refresh.
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
  schema: 1
  nfts: DbNft[]
  users: DbUser[]
  sessions: Record<string, { userId: string; expiresAt: number }>
  favorites: Record<string, string[]>
  carts: Record<string, Cart>
  wallets: Record<string, DbWallets>
  quotes: Record<string, Quote & { cartId: string }>
  orders: Record<string, DbOrder>
  idempotency: Record<string, { orderId: string; requestHash: string }>
  seq: number
}

const KEY = 'kurio.mock.db.v1'
export let db: DbState

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(password: string, salt: string) {
  return sha256(`${salt}:${password}`)
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
    const salt = `salt-${u.id}`
    users.push({
      id: u.id,
      email: u.email,
      username: u.username,
      displayName: u.displayName,
      ensName: u.ensName,
      walletNickname: u.walletNickname,
      avatar: null,
      version: 1,
      salt,
      passwordHash: await hashPassword(u.password, salt),
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
    schema: 1,
    nfts: buildNfts(),
    users,
    sessions: {},
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
        if (parsed.schema === 1) {
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
