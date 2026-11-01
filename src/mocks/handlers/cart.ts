import { http, HttpResponse } from 'msw'
import type { Cart, CartItemInput, Network, Quote, QuoteLine, QuoteRequest } from '@/api/contracts'
import { add, compare, fromWei, isZero, mulInt, percentOf, sub, toWei } from '@/lib/eth'
import { db, randomId, save } from '../db'
import { COUPONS, NETWORK_FEES, NETWORKS } from '../fixtures'
import { API, assertMaxLengths, HttpError, MAX_LEN, readJson, resolveCart, route } from '../http'

export function findEdition(nftId: string, editionId: string) {
  const nft = db.nfts.find((n) => n.id === nftId)
  const edition = nft?.editions.find((e) => e.id === editionId)
  return { nft, edition }
}

export function clampQuantity(nftId: string, editionId: string, desired: number) {
  const { edition } = findEdition(nftId, editionId)
  if (!edition) return 0
  return Math.max(0, Math.min(desired, edition.available, edition.maxPerOrder))
}

function limitFor(nftId: string, editionId: string) {
  const { nft, edition } = findEdition(nftId, editionId)
  if (!nft || !edition) throw new HttpError(404, 'NOT_FOUND', 'NFT ou edição não encontrada.')
  return { nft, edition, limit: Math.min(edition.available, edition.maxPerOrder) }
}

/** Atualiza disponibilidade/limites nos itens (preço permanece como snapshot). */
export function hydrateCart(cart: Cart): Cart {
  for (const item of cart.items) {
    const { edition } = findEdition(item.nftId, item.editionId)
    item.available = edition?.available ?? 0
    item.maxPerOrder = edition?.maxPerOrder ?? 0
  }
  return cart
}

function touch(cart: Cart) {
  cart.version++
  cart.updatedAt = new Date().toISOString()
  save()
  return HttpResponse.json(hydrateCart(cart))
}

function validateQty(q: unknown): number {
  if (typeof q !== 'number' || !Number.isInteger(q) || q < 0) throw new HttpError(422, 'VALIDATION_ERROR', 'Quantidade deve ser um inteiro positivo.', { quantity: 'Quantidade inválida.' })
  return q
}

export type CouponCheck = { ok: true; code: string; percent: number } | { ok: false; code: 'COUPON_INVALID' | 'COUPON_EXPIRED'; message: string }

export function checkCoupon(raw: string, subtotal: string): CouponCheck {
  const code = raw.trim().toUpperCase()
  const c = COUPONS[code]
  if (!c) return { ok: false, code: 'COUPON_INVALID', message: 'Cupom inválido.' }
  if (Date.parse(c.expiresAt) < Date.now()) return { ok: false, code: 'COUPON_EXPIRED', message: 'Este cupom expirou.' }
  if (c.minSubtotal && compare(subtotal, c.minSubtotal) < 0) return { ok: false, code: 'COUPON_INVALID', message: `Cupom válido para compras a partir de ${c.minSubtotal} ETH.` }
  return { ok: true, code, percent: c.percent }
}

function hash(text: string) {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
  return h.toString(36)
}

export function computeQuote(cart: Cart, network: Network): Quote {
  const lines: QuoteLine[] = cart.items.map((item) => {
    const { nft, edition } = findEdition(item.nftId, item.editionId)
    const unitPrice = edition?.price ?? item.unitPrice
    const available = edition?.available ?? 0
    let issue: QuoteLine['issue'] = null
    if (!nft || !edition || available === 0) issue = 'SOLD_OUT'
    else if (item.quantity > available) issue = 'INSUFFICIENT_AVAILABILITY'
    else if (compare(unitPrice, item.unitPrice) !== 0) issue = 'PRICE_CHANGED'
    return {
      nftId: item.nftId,
      editionId: item.editionId,
      name: item.name,
      tokenId: item.tokenId,
      image: item.image,
      editionLabel: item.editionLabel,
      quantity: item.quantity,
      unitPrice,
      lineTotal: mulInt(unitPrice, item.quantity),
      available,
      issue,
      ...(issue === 'PRICE_CHANGED' ? { previousUnitPrice: item.unitPrice } : {}),
    }
  })
  const subtotal = add('0', ...lines.map((l) => l.lineTotal))
  let coupon: Quote['coupon'] = null
  if (cart.couponCode) {
    const check = checkCoupon(cart.couponCode, subtotal)
    if (check.ok) coupon = { code: check.code, percent: check.percent }
  }
  const discount = coupon ? percentOf(subtotal, coupon.percent) : '0'
  const networkFee = lines.length ? NETWORK_FEES[network] : '0'
  const totalWei = toWei(subtotal) - toWei(discount) + toWei(networkFee)
  const total = fromWei(totalWei < 0n ? 0n : totalWei)
  const fingerprint = hash(JSON.stringify([lines.map((l) => [l.nftId, l.editionId, l.quantity, l.unitPrice]), coupon?.code, discount, networkFee, network]))
  const now = Date.now()
  return {
    id: randomId('q_'),
    cartVersion: cart.version,
    network,
    lines,
    subtotal,
    discount: isZero(discount) ? '0' : discount,
    networkFee,
    total: sub(total, '0'),
    coupon,
    fingerprint,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 5 * 60 * 1000).toISOString(),
    hasIssues: lines.some((l) => l.issue !== null),
  }
}

export const cartHandlers = [
  http.get(
    `${API}/cart`,
    route(({ request }) => {
      const { cart } = resolveCart(request)
      save()
      return HttpResponse.json(hydrateCart(cart))
    }),
  ),

  http.post(
    `${API}/cart/items`,
    route(async ({ request }) => {
      const { cart } = resolveCart(request)
      const body = await readJson<CartItemInput>(request)
      const qty = validateQty(body.quantity)
      if (qty < 1) throw new HttpError(422, 'VALIDATION_ERROR', 'Quantidade mínima é 1.', { quantity: 'Quantidade mínima é 1.' })
      const { nft, edition, limit } = limitFor(body.nftId, body.editionId)
      const existing = cart.items.find((i) => i.nftId === body.nftId && i.editionId === body.editionId)
      const desired = (existing?.quantity ?? 0) + qty
      if (edition.available === 0) throw new HttpError(409, 'AVAILABILITY_CONFLICT', 'Esta edição está esgotada.', undefined, { available: 0 })
      if (desired > limit)
        throw new HttpError(409, 'AVAILABILITY_CONFLICT', `Limite de ${limit} unidade(s) para esta edição${existing ? ` (você já tem ${existing.quantity} no carrinho)` : ''}.`, undefined, { available: edition.available, limit })
      if (existing) existing.quantity = desired
      else
        cart.items.push({
          nftId: nft.id,
          editionId: edition.id,
          quantity: qty,
          name: nft.name,
          image: nft.image,
          tokenId: nft.tokenId,
          editionLabel: edition.label,
          unitPrice: edition.price,
          available: edition.available,
          maxPerOrder: edition.maxPerOrder,
        })
      return touch(cart)
    }),
  ),

  http.patch(
    `${API}/cart/items/:nftId/:editionId`,
    route(async ({ request, params }) => {
      const { cart } = resolveCart(request)
      const body = await readJson<{ quantity: number }>(request)
      const qty = validateQty(body.quantity)
      const item = cart.items.find((i) => i.nftId === params.nftId && i.editionId === params.editionId)
      if (!item) throw new HttpError(404, 'NOT_FOUND', 'Item não está no carrinho.')
      if (qty === 0) {
        cart.items = cart.items.filter((i) => i !== item)
        return touch(cart)
      }
      const { edition, limit } = limitFor(item.nftId, item.editionId)
      if (qty > limit) throw new HttpError(409, 'AVAILABILITY_CONFLICT', `Apenas ${limit} unidade(s) disponível(is) para esta edição.`, undefined, { available: edition.available, limit })
      item.quantity = qty
      return touch(cart)
    }),
  ),

  http.delete(
    `${API}/cart/items/:nftId/:editionId`,
    route(({ request, params }) => {
      const { cart } = resolveCart(request)
      const before = cart.items.length
      cart.items = cart.items.filter((i) => !(i.nftId === params.nftId && i.editionId === params.editionId))
      if (cart.items.length === before) throw new HttpError(404, 'NOT_FOUND', 'Item não está no carrinho.')
      return touch(cart)
    }),
  ),

  http.put(
    `${API}/cart/coupon`,
    route(async ({ request }) => {
      const { cart } = resolveCart(request)
      const body = await readJson<{ code: string }>(request)
      assertMaxLengths(body, { code: MAX_LEN.code })
      const { code } = body
      if (!code?.trim()) throw new HttpError(422, 'VALIDATION_ERROR', 'Informe um código.', { code: 'Informe um código promocional.' })
      const subtotal = add('0', ...cart.items.map((i) => mulInt(findEdition(i.nftId, i.editionId).edition?.price ?? i.unitPrice, i.quantity)))
      const check = checkCoupon(code, subtotal)
      if (!check.ok) throw new HttpError(422, check.code, check.message, { code: check.message })
      cart.couponCode = check.code
      return touch(cart)
    }),
  ),

  http.delete(
    `${API}/cart/coupon`,
    route(({ request }) => {
      const { cart } = resolveCart(request)
      cart.couponCode = null
      return touch(cart)
    }),
  ),

  /** Aceita os valores atuais: atualiza snapshots de preço e ajusta quantidades. */
  http.post(
    `${API}/cart/acknowledge`,
    route(({ request }) => {
      const { cart } = resolveCart(request)
      cart.items = cart.items
        .map((item) => {
          const { edition } = findEdition(item.nftId, item.editionId)
          if (!edition) return { ...item, quantity: 0 }
          return { ...item, unitPrice: edition.price, quantity: Math.min(item.quantity, edition.available, edition.maxPerOrder) }
        })
        .filter((i) => i.quantity > 0)
      return touch(cart)
    }),
  ),

  http.post(
    `${API}/quotes`,
    route(async ({ request }) => {
      const { cart } = resolveCart(request)
      const body = await readJson<QuoteRequest>(request)
      const network = body.network ?? 'ethereum'
      if (!NETWORKS.some((n) => n.id === network)) throw new HttpError(422, 'VALIDATION_ERROR', 'Rede inválida.', { network: 'Rede inválida.' })
      const quote = computeQuote(hydrateCart(cart), network)
      db.quotes[quote.id] = { ...quote, cartId: cart.id }
      save()
      return HttpResponse.json(quote)
    }),
  ),
]
