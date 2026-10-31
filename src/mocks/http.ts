import { HttpResponse, type DefaultBodyType, type HttpResponseResolver, type PathParams } from 'msw'
import type { ApiErrorBody, ApiErrorCode, Cart } from '@/api/contracts'
import { consumeScenario, hasScenario, latencyMs, sleep } from './config'
import { db, save, type DbUser } from './db'

export const API = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'
export const SESSION_TTL_MS = 30 * 60 * 1000

export class HttpError extends Error {
  readonly response: Response
  constructor(status: number, code: ApiErrorCode, message: string, fields?: Record<string, string>, details?: unknown) {
    super(message)
    this.response = apiError(status, code, message, fields, details)
  }
}

export function apiError(status: number, code: ApiErrorCode, message: string, fields?: Record<string, string>, details?: unknown) {
  return HttpResponse.json<ApiErrorBody>({ error: { code, message, fields, details } }, { status })
}

type Resolver<P extends PathParams> = HttpResponseResolver<P, DefaultBodyType, DefaultBodyType>

/**
 * Envolve um handler aplicando as condições de rede configuradas:
 * indisponibilidade, latência (determinística por seed) e tradução de
 * `HttpError` para respostas de erro padronizadas.
 */
export function route<P extends PathParams = PathParams>(fn: Resolver<P>, opts: { latency?: () => number } = {}): Resolver<P> {
  return async (info) => {
    if (hasScenario('offline')) return HttpResponse.error()
    const ms = opts.latency ? opts.latency() : latencyMs()
    if (ms > 0) await sleep(ms)
    try {
      return await fn(info)
    } catch (e) {
      if (e instanceof HttpError) return e.response
      console.error('[mock] erro inesperado', e)
      return apiError(500, 'INTERNAL', 'Erro interno no servidor simulado.')
    }
  }
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Corpo da requisição inválido.')
  }
}

function bearer(request: Request): string | null {
  const h = request.headers.get('authorization')
  return h?.startsWith('Bearer ') ? h.slice(7) : null
}

/** Usuário da sessão, se houver (rotas públicas com personalização). */
export function optionalUser(request: Request): DbUser | null {
  const token = bearer(request)
  if (!token) return null
  const s = db.sessions[token]
  if (!s || s.expiresAt < Date.now()) return null
  return db.users.find((u) => u.id === s.userId) ?? null
}

/** Exige sessão válida. Traduz expiração e o cenário `session-expired`. */
export function requireUser(request: Request): { user: DbUser; token: string } {
  const token = bearer(request)
  if (!token) throw new HttpError(401, 'UNAUTHENTICATED', 'Faça login para continuar.')
  const s = db.sessions[token]
  if (!s) throw new HttpError(401, 'UNAUTHENTICATED', 'Sessão inválida. Faça login novamente.')
  if (s.expiresAt < Date.now() || consumeScenario('session-expired')) {
    delete db.sessions[token]
    save()
    throw new HttpError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
  }
  const user = db.users.find((u) => u.id === s.userId)
  if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Sessão inválida.')
  // Sessão deslizante.
  s.expiresAt = Date.now() + SESSION_TTL_MS
  return { user, token }
}

export function userCartId(userId: string) {
  return `user:${userId}`
}

export function emptyCart(id: string, owner: Cart['owner']): Cart {
  return { id, owner, items: [], couponCode: null, version: 1, updatedAt: new Date().toISOString() }
}

/** Resolve o carrinho da requisição: do usuário autenticado ou do visitante (X-Cart-Id). */
export function resolveCart(request: Request): { cart: Cart; user: DbUser | null } {
  const token = bearer(request)
  if (token) {
    const { user } = requireUser(request)
    const id = userCartId(user.id)
    db.carts[id] ??= emptyCart(id, 'user')
    return { cart: db.carts[id], user }
  }
  const guestId = request.headers.get('x-cart-id')
  if (!guestId || !/^[a-z0-9_-]{8,64}$/i.test(guestId)) throw new HttpError(400, 'VALIDATION_ERROR', 'Identificador de carrinho ausente.')
  const id = `guest:${guestId}`
  db.carts[id] ??= emptyCart(id, 'guest')
  return { cart: db.carts[id], user: null }
}
