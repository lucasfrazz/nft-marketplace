import { http, HttpResponse } from 'msw'
import type { AvatarUpdateRequest, FavoritesResponse, Network, PasswordChangeRequest, ProfileUpdateRequest, Wallet, WalletConnectRequest, WalletInput, WalletProvider, WalletSlot, WalletsResponse } from '@/api/contracts'
import { consumeScenario, hasScenario } from '../config'
import { db, hashPassword, newSalt, publicUser, save, verifyPassword } from '../db'
import { API, assertMaxLengths, HttpError, MAX_LEN, readJson, requireUser, route } from '../http'
import { toSummary } from './catalog'
import { validatePassword } from './auth'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const USERNAME_RE = /^[a-z0-9._]{3,20}$/
const ENS_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const NETWORKS: Network[] = ['ethereum', 'polygon', 'solana']
const PROVIDERS: WalletProvider[] = ['metamask', 'walletconnect', 'coinbase']

function favoritesOf(userId: string): FavoritesResponse {
  const ids = db.favorites[userId] ?? []
  return { ids, items: ids.map((id) => db.nfts.find((n) => n.id === id)).filter((n) => !!n).map(toSummary) }
}

function walletsOf(userId: string): WalletsResponse {
  const w = (db.wallets[userId] ??= { primary: null, secondary: null, secondarySameAsPrimary: false })
  return { primary: w.primary, secondary: w.secondarySameAsPrimary && w.primary ? { ...w.primary, slot: 'secondary' } : w.secondary, secondarySameAsPrimary: w.secondarySameAsPrimary }
}

function validateWallet(input: Partial<WalletInput>): Record<string, string> {
  assertMaxLengths(input, { displayName: MAX_LEN.name, nickname: MAX_LEN.name, profileName: MAX_LEN.name, address: MAX_LEN.address, ensOrSecondary: MAX_LEN.address, referralCode: MAX_LEN.code, email: MAX_LEN.email, ensName: MAX_LEN.ens })
  const f: Record<string, string> = {}
  const req = (k: keyof WalletInput, label = 'Campo obrigatório.') => {
    if (!String(input[k] ?? '').trim()) f[k] = label
  }
  req('displayName')
  req('nickname')
  req('profileName')
  req('referralCode')
  if (!NETWORKS.includes(input.network as Network)) f.network = 'Selecione uma rede.'
  if (!PROVIDERS.includes(input.provider as WalletProvider)) f.provider = 'Selecione uma carteira.'
  if (!ADDRESS_RE.test(String(input.address ?? ''))) f.address = 'Endereço deve começar com 0x e ter 40 caracteres hexadecimais.'
  const sec = String(input.ensOrSecondary ?? '').trim()
  if (sec && !ADDRESS_RE.test(sec) && !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/.test(sec)) f.ensOrSecondary = 'Informe um nome ENS (ex.: nome.eth) ou endereço 0x.'
  if (!EMAIL_RE.test(String(input.email ?? ''))) f.email = 'Informe um e-mail válido.'
  if (!ENS_RE.test(String(input.ensName ?? ''))) f.ensName = 'Use letras minúsculas, números e hífen.'
  if (input.referralCode && !/^[A-Za-z0-9-]{4,20}$/.test(input.referralCode)) f.referralCode = 'Código deve ter de 4 a 20 letras, números ou hífen.'
  return f
}

export const accountHandlers = [
  /* ----------------------------- Favoritos ----------------------------- */
  http.get(
    `${API}/favorites`,
    route(({ request }) => {
      const { user } = requireUser(request)
      return HttpResponse.json(favoritesOf(user.id))
    }),
  ),
  http.put(
    `${API}/favorites/:nftId`,
    route(({ request, params }) => {
      const { user } = requireUser(request)
      if (hasScenario('favorite-fail')) throw new HttpError(500, 'INTERNAL', 'Não foi possível salvar o favorito.')
      if (!db.nfts.some((n) => n.id === params.nftId)) throw new HttpError(404, 'NOT_FOUND', 'NFT não encontrado.')
      const list = (db.favorites[user.id] ??= [])
      if (!list.includes(params.nftId as string)) list.unshift(params.nftId as string)
      save()
      return HttpResponse.json(favoritesOf(user.id))
    }),
  ),
  http.delete(
    `${API}/favorites/:nftId`,
    route(({ request, params }) => {
      const { user } = requireUser(request)
      if (hasScenario('favorite-fail')) throw new HttpError(500, 'INTERNAL', 'Não foi possível remover o favorito.')
      db.favorites[user.id] = (db.favorites[user.id] ?? []).filter((id) => id !== params.nftId)
      save()
      return HttpResponse.json(favoritesOf(user.id))
    }),
  ),

  /* ------------------------------- Perfil ------------------------------ */
  http.get(
    `${API}/profile`,
    route(({ request }) => HttpResponse.json(publicUser(requireUser(request).user))),
  ),
  http.patch(
    `${API}/profile`,
    route(async ({ request }) => {
      const { user } = requireUser(request)
      const body = await readJson<ProfileUpdateRequest>(request)
      assertMaxLengths(body, { displayName: MAX_LEN.name, username: MAX_LEN.username, email: MAX_LEN.email, ensName: MAX_LEN.ens, walletNickname: MAX_LEN.name })
      const f: Record<string, string> = {}
      const email = String(body.email ?? '').trim().toLowerCase()
      const username = String(body.username ?? '').trim().toLowerCase()
      if (!String(body.displayName ?? '').trim()) f.displayName = 'Informe o nome de exibição.'
      else if (body.displayName.length > 40) f.displayName = 'Máximo de 40 caracteres.'
      if (!USERNAME_RE.test(username)) f.username = 'Use de 3 a 20 caracteres: letras minúsculas, números, "." ou "_".'
      if (!EMAIL_RE.test(email)) f.email = 'Informe um e-mail válido.'
      if (!ENS_RE.test(String(body.ensName ?? ''))) f.ensName = 'Use letras minúsculas, números e hífen.'
      if (!String(body.walletNickname ?? '').trim()) f.walletNickname = 'Informe o apelido da carteira.'
      if (Object.keys(f).length) throw new HttpError(422, 'VALIDATION_ERROR', 'Verifique os campos destacados.', f)
      if (db.users.some((u) => u.id !== user.id && u.email === email)) throw new HttpError(409, 'EMAIL_TAKEN', 'E-mail em uso.', { email: 'Este e-mail já pertence a outra conta.' })
      if (db.users.some((u) => u.id !== user.id && u.username === username)) throw new HttpError(409, 'USERNAME_TAKEN', 'Usuário em uso.', { username: 'Este nome de usuário já está em uso.' })
      Object.assign(user, { displayName: body.displayName.trim(), username, email, ensName: body.ensName, walletNickname: body.walletNickname.trim() })
      user.version++
      save()
      return HttpResponse.json(publicUser(user))
    }),
  ),
  http.put(
    `${API}/profile/avatar`,
    route(async ({ request }) => {
      const { user } = requireUser(request)
      const { dataUrl } = await readJson<AvatarUpdateRequest>(request)
      if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl ?? ''))
        throw new HttpError(422, 'VALIDATION_ERROR', 'Formato de imagem inválido.', { avatar: 'Envie uma imagem PNG, JPEG ou WebP.' })
      if (dataUrl.length > 1_400_000) throw new HttpError(422, 'VALIDATION_ERROR', 'Imagem muito grande.', { avatar: 'A imagem deve ter no máximo 1 MB.' })
      user.avatar = dataUrl
      user.version++
      save()
      return HttpResponse.json(publicUser(user))
    }),
  ),
  http.delete(
    `${API}/profile/avatar`,
    route(({ request }) => {
      const { user } = requireUser(request)
      user.avatar = null
      user.version++
      save()
      return HttpResponse.json(publicUser(user))
    }),
  ),
  http.post(
    `${API}/profile/password`,
    route(async ({ request }) => {
      const { user, token } = requireUser(request)
      const body = await readJson<PasswordChangeRequest>(request)
      assertMaxLengths(body, { currentPassword: MAX_LEN.password, newPassword: MAX_LEN.password })
      if (!(await verifyPassword(user, String(body.currentPassword ?? ''))))
        throw new HttpError(422, 'VALIDATION_ERROR', 'Senha atual incorreta.', { currentPassword: 'Senha atual incorreta.' })
      const err = validatePassword(body.newPassword)
      if (err) throw new HttpError(422, 'VALIDATION_ERROR', err, { newPassword: err })
      if (body.newPassword === body.currentPassword) throw new HttpError(422, 'VALIDATION_ERROR', 'A nova senha deve ser diferente da atual.', { newPassword: 'A nova senha deve ser diferente da atual.' })
      user.salt = newSalt()
      user.passwordHash = await hashPassword(body.newPassword, user.salt)
      // Encerra as outras sessões do usuário.
      for (const [t, s] of Object.entries(db.sessions)) if (s.userId === user.id && t !== token) delete db.sessions[t]
      save()
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  /* ------------------------------ Carteiras ---------------------------- */
  http.get(
    `${API}/wallets`,
    route(({ request }) => HttpResponse.json(walletsOf(requireUser(request).user.id))),
  ),
  http.put(
    `${API}/wallets/:slot`,
    route(async ({ request, params }) => {
      const { user } = requireUser(request)
      const slot = params.slot as WalletSlot
      if (slot !== 'primary' && slot !== 'secondary') throw new HttpError(404, 'NOT_FOUND', 'Carteira inexistente.')
      const body = await readJson<Partial<WalletInput> & { sameAsPrimary?: boolean }>(request)
      const store = (db.wallets[user.id] ??= { primary: null, secondary: null, secondarySameAsPrimary: false })
      if (slot === 'secondary' && body.sameAsPrimary) {
        if (!store.primary) throw new HttpError(422, 'VALIDATION_ERROR', 'Cadastre a carteira principal primeiro.')
        store.secondarySameAsPrimary = true
        save()
        return HttpResponse.json(walletsOf(user.id))
      }
      const f = validateWallet(body)
      if (Object.keys(f).length) throw new HttpError(422, 'VALIDATION_ERROR', 'Verifique os campos da carteira.', f)
      const other = slot === 'primary' ? store.secondary : store.primary
      if (other && !store.secondarySameAsPrimary && other.address.toLowerCase() === String(body.address).toLowerCase())
        throw new HttpError(409, 'VALIDATION_ERROR', 'Endereço já cadastrado na outra carteira.', { address: 'Este endereço já está cadastrado na outra carteira.' })
      const prev = store[slot]
      const wallet: Wallet = {
        slot,
        displayName: String(body.displayName).trim(),
        nickname: String(body.nickname).trim(),
        network: body.network as Network,
        profileName: String(body.profileName).trim(),
        address: String(body.address),
        ensOrSecondary: String(body.ensOrSecondary ?? '').trim(),
        provider: body.provider as WalletProvider,
        referralCode: String(body.referralCode).toUpperCase(),
        email: String(body.email).trim().toLowerCase(),
        ensName: String(body.ensName),
        version: (prev?.version ?? 0) + 1,
        // Alterar endereço/rede desconecta a sessão de carteira.
        connection: prev && prev.address === body.address && prev.network === body.network ? prev.connection : { status: 'disconnected', network: null, connectedAt: null },
      }
      store[slot] = wallet
      if (slot === 'secondary') store.secondarySameAsPrimary = false
      save()
      return HttpResponse.json(walletsOf(user.id))
    }),
  ),
  http.post(
    `${API}/wallets/:slot/connect`,
    route(async ({ request, params }) => {
      const { user } = requireUser(request)
      const body = await readJson<WalletConnectRequest>(request)
      const store = db.wallets[user.id]
      const slot = params.slot as WalletSlot
      const wallet = slot === 'secondary' && store?.secondarySameAsPrimary ? store.primary : store?.[slot]
      if (!wallet) throw new HttpError(404, 'NOT_FOUND', 'Carteira não cadastrada.')
      if (!NETWORKS.includes(body.network)) throw new HttpError(422, 'VALIDATION_ERROR', 'Rede inválida.', { network: 'Selecione uma rede.' })
      if (consumeScenario('wallet-reject')) throw new HttpError(403, 'WALLET_REJECTED', 'A conexão foi recusada na carteira.')
      wallet.connection = { status: 'connected', network: body.network, connectedAt: new Date().toISOString() }
      save()
      return HttpResponse.json(walletsOf(user.id))
    }),
  ),
  http.post(
    `${API}/wallets/:slot/disconnect`,
    route(({ request, params }) => {
      const { user } = requireUser(request)
      const store = db.wallets[user.id]
      const slot = params.slot as WalletSlot
      const wallet = slot === 'secondary' && store?.secondarySameAsPrimary ? store.primary : store?.[slot]
      if (!wallet) throw new HttpError(404, 'NOT_FOUND', 'Carteira não cadastrada.')
      wallet.connection = { status: 'disconnected', network: null, connectedAt: null }
      save()
      return HttpResponse.json(walletsOf(user.id))
    }),
  ),
]
