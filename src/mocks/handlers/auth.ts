import { http, HttpResponse } from 'msw'
import type { LoginRequest, Session, SignupRequest } from '@/api/contracts'
import { hasScenario } from '../config'
import { db, hashPassword, publicUser, randomId, save, type DbUser } from '../db'
import { API, emptyCart, HttpError, readJson, requireUser, route, SESSION_TTL_MS, userCartId } from '../http'
import { dropUserConnections } from '../realtime'
import { clampQuantity } from './cart'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const USERNAME_RE = /^[a-z0-9._]{3,20}$/

export function validatePassword(pw: string): string | null {
  if (typeof pw !== 'string' || pw.length < 8) return 'A senha deve ter pelo menos 8 caracteres.'
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'A senha deve conter letras e números.'
  return null
}

function createSession(user: DbUser): Session {
  const token = randomId('tok_') + randomId()
  const expiresAt = Date.now() + SESSION_TTL_MS
  db.sessions[token] = { userId: user.id, expiresAt }
  return { token, user: publicUser(user), expiresAt: new Date(expiresAt).toISOString() }
}

/** Mescla o carrinho do visitante no carrinho do usuário (somando quantidades). */
function mergeGuestCart(userId: string, guestCartId?: string) {
  if (!guestCartId) return
  const guest = db.carts[`guest:${guestCartId}`]
  if (!guest) return
  const id = userCartId(userId)
  const target = (db.carts[id] ??= emptyCart(id, 'user'))
  for (const item of guest.items) {
    const existing = target.items.find((i) => i.nftId === item.nftId && i.editionId === item.editionId)
    const desired = (existing?.quantity ?? 0) + item.quantity
    const qty = clampQuantity(item.nftId, item.editionId, desired)
    if (qty <= 0) continue
    if (existing) existing.quantity = qty
    else target.items.push({ ...item, quantity: qty })
  }
  target.couponCode ??= guest.couponCode
  target.version++
  target.updatedAt = new Date().toISOString()
  delete db.carts[`guest:${guestCartId}`]
}

export const authHandlers = [
  http.post(
    `${API}/auth/signup`,
    route(async ({ request }) => {
      const body = await readJson<SignupRequest>(request)
      const fields: Record<string, string> = {}
      const email = String(body.email ?? '').trim().toLowerCase()
      const username = String(body.username ?? '').trim().toLowerCase()
      if (!USERNAME_RE.test(username)) fields.username = 'Use de 3 a 20 caracteres: letras minúsculas, números, "." ou "_".'
      if (!EMAIL_RE.test(email)) fields.email = 'Informe um e-mail válido.'
      const pwErr = validatePassword(body.password)
      if (pwErr) fields.password = pwErr
      if (Object.keys(fields).length) throw new HttpError(422, 'VALIDATION_ERROR', 'Verifique os campos destacados.', fields)
      if (hasScenario('signup-conflict') || db.users.some((u) => u.email === email))
        throw new HttpError(409, 'EMAIL_TAKEN', 'Este e-mail já está cadastrado.', { email: 'Este e-mail já está cadastrado. Faça login ou use outro e-mail.' })
      if (db.users.some((u) => u.username === username))
        throw new HttpError(409, 'USERNAME_TAKEN', 'Nome de usuário indisponível.', { username: 'Este nome de usuário já está em uso.' })

      const salt = randomId('s_')
      const user: DbUser = {
        id: randomId('u_'),
        email,
        username,
        displayName: username,
        ensName: '',
        walletNickname: '',
        avatar: null,
        version: 1,
        salt,
        passwordHash: await hashPassword(body.password, salt),
      }
      db.users.push(user)
      db.wallets[user.id] = { primary: null, secondary: null, secondarySameAsPrimary: false }
      mergeGuestCart(user.id, body.guestCartId)
      const session = createSession(user)
      save()
      return HttpResponse.json(session, { status: 201 })
    }),
  ),

  http.post(
    `${API}/auth/login`,
    route(async ({ request }) => {
      const body = await readJson<LoginRequest>(request)
      const email = String(body.email ?? '').trim().toLowerCase()
      const fields: Record<string, string> = {}
      if (!EMAIL_RE.test(email)) fields.email = 'Informe um e-mail válido.'
      if (!body.password) fields.password = 'Informe sua senha.'
      if (Object.keys(fields).length) throw new HttpError(422, 'VALIDATION_ERROR', 'Verifique os campos destacados.', fields)
      const user = db.users.find((u) => u.email === email)
      if (!user || (await hashPassword(body.password, user.salt)) !== user.passwordHash)
        throw new HttpError(401, 'UNAUTHENTICATED', 'E-mail ou senha incorretos.')
      mergeGuestCart(user.id, body.guestCartId)
      const session = createSession(user)
      save()
      return HttpResponse.json(session)
    }),
  ),

  http.get(
    `${API}/auth/session`,
    route(({ request }) => {
      const { user, token } = requireUser(request)
      save()
      const s = db.sessions[token]
      return HttpResponse.json<Session>({ token, user: publicUser(user), expiresAt: new Date(s.expiresAt).toISOString() })
    }),
  ),

  http.post(
    `${API}/auth/logout`,
    route(({ request }) => {
      const token = request.headers.get('authorization')?.slice(7)
      if (token && db.sessions[token]) {
        const uid = db.sessions[token].userId
        delete db.sessions[token]
        save()
        // Subscriptions da sessão anterior são encerradas no servidor também.
        if (!Object.values(db.sessions).some((s) => s.userId === uid)) dropUserConnections(uid)
      }
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
