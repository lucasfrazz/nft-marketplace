import { http, HttpResponse } from 'msw'
import type { CreateOrderRequest, Order, OrderStatus } from '@/api/contracts'
import { add } from '@/lib/eth'
import { consumeScenario, getConfig, hasScenario, sleep } from '../config'
import { db, randomId, save, type DbOrder } from '../db'
import { API, HttpError, readJson, requireUser, route, userCartId } from '../http'
import { emitNftUpdated, emitOrderUpdated } from '../realtime'
import { computeQuote, findEdition, hydrateCart } from './cart'

const timers = new Map<string, ReturnType<typeof setTimeout>>()

function publicOrder(o: DbOrder): Order {
  const { settleAt: _a, idempotencyKey: _b, requestHash: _c, reserved: _d, ...rest } = o
  return rest
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(',')}}`
  return JSON.stringify(value) ?? 'null'
}

function canonicalHash(value: unknown) {
  const text = stableStringify(value)
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
  return `${h.toString(36)}:${text.length}`
}

function adjustAvailability(order: DbOrder, sign: 1 | -1) {
  const touched = new Set<string>()
  for (const line of order.lines) {
    const { nft, edition } = findEdition(line.nftId, line.editionId)
    if (!nft || !edition) continue
    edition.available = Math.max(0, edition.available + sign * line.quantity)
    nft.available = nft.editions.reduce((s, e) => s + e.available, 0)
    touched.add(nft.id)
  }
  for (const id of touched) {
    const nft = db.nfts.find((n) => n.id === id)!
    nft.version++
    emitNftUpdated(nft)
  }
}

/** Liquida o pedido (simulação da confirmação on-chain). Estados terminais não mudam. */
export function settleOrder(orderId: string, forced?: Exclude<OrderStatus, 'pending'>) {
  timers.delete(orderId)
  const order = db.orders[orderId]
  if (!order || order.status !== 'pending') return null
  const status: OrderStatus = forced ?? (hasScenario('payment-declined') ? 'declined' : 'confirmed')
  order.status = status
  order.version++
  order.updatedAt = new Date().toISOString()
  if (status === 'confirmed') {
    const hash = `0x${randomId()}${randomId()}${randomId()}`.slice(0, 66).padEnd(66, 'a')
    order.transaction = { hash, explorerUrl: `/explorer/tx/${hash}` }
    // Remove do carrinho apenas os itens/quantidades comprados.
    const cart = db.carts[userCartId(order.userId)]
    if (cart) {
      for (const line of order.lines) {
        const item = cart.items.find((i) => i.nftId === line.nftId && i.editionId === line.editionId)
        if (item) item.quantity -= line.quantity
      }
      cart.items = cart.items.filter((i) => i.quantity > 0)
      cart.version++
      cart.updatedAt = order.updatedAt
    }
  } else {
    order.failureReason = 'Pagamento recusado pela carteira. Nenhum valor foi debitado.'
    if (order.reserved) {
      adjustAvailability(order, 1)
      order.reserved = false
    }
  }
  save()
  emitOrderUpdated(publicOrder(order))
  return publicOrder(order)
}

function schedule(order: DbOrder) {
  if (order.status !== 'pending' || !Number.isFinite(order.settleAt)) return
  clearTimeout(timers.get(order.id))
  timers.set(
    order.id,
    setTimeout(() => settleOrder(order.id), Math.max(0, order.settleAt - Date.now())),
  )
}

/** Retoma liquidações pendentes após refresh (timers não sobrevivem ao reload). */
export function resumeSettlements() {
  for (const o of Object.values(db.orders)) if (o.status === 'pending') schedule(o)
}

const REQUIRED_BUYER: (keyof CreateOrderRequest['buyer'])[] = ['displayName', 'username', 'profileName', 'email', 'referralCode', 'ensName']

export const orderHandlers = [
  http.post(
    `${API}/orders`,
    route(async ({ request }) => {
      const { user } = requireUser(request)
      const key = request.headers.get('idempotency-key')
      if (!key || !/^[A-Za-z0-9_-]{8,80}$/.test(key)) throw new HttpError(422, 'VALIDATION_ERROR', 'Cabeçalho Idempotency-Key ausente ou inválido.')
      const body = await readJson<CreateOrderRequest>(request)
      const requestHash = canonicalHash(body)
      const idemKey = `${user.id}:${key}`

      const previous = db.idempotency[idemKey]
      if (previous) {
        if (previous.requestHash !== requestHash)
          throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
        return HttpResponse.json(publicOrder(db.orders[previous.orderId]), { status: 200 })
      }

      const fields: Record<string, string> = {}
      for (const f of REQUIRED_BUYER) if (!String(body.buyer?.[f] ?? '').trim()) fields[f] = 'Campo obrigatório.'
      if (body.buyer?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.buyer.email)) fields.email = 'Informe um e-mail válido.'
      if (Object.keys(fields).length) throw new HttpError(422, 'VALIDATION_ERROR', 'Verifique os dados do colecionador.', fields)

      const wallet = db.wallets[user.id]?.[body.walletSlot]
      if (!wallet) throw new HttpError(422, 'VALIDATION_ERROR', 'Cadastre uma carteira antes de pagar.', { walletSlot: 'Carteira não cadastrada.' })
      if (wallet.connection.status !== 'connected' || wallet.connection.network !== body.network)
        throw new HttpError(409, 'WALLET_NOT_CONNECTED', 'Conecte a carteira na rede selecionada antes de confirmar.')

      const cart = hydrateCart(db.carts[userCartId(user.id)] ?? { id: '', owner: 'user', items: [], couponCode: null, version: 0, updatedAt: '' })
      if (!cart.items.length) throw new HttpError(422, 'VALIDATION_ERROR', 'Seu carrinho está vazio.')

      // Cenários: mudança de preço / esgotamento durante a compra.
      const first = cart.items[0]
      const firstRef = first ? findEdition(first.nftId, first.editionId) : null
      if (firstRef?.nft && firstRef.edition && consumeScenario('price-change-at-checkout')) {
        firstRef.edition.price = add(firstRef.edition.price, '0.05')
        if (firstRef.edition.id === '1-50') firstRef.nft.price = firstRef.edition.price
        firstRef.nft.version++
        emitNftUpdated(firstRef.nft)
      } else if (firstRef?.nft && firstRef.edition && consumeScenario('sold-out-at-checkout')) {
        firstRef.edition.available = 0
        firstRef.nft.available = firstRef.nft.editions.reduce((s, e) => s + e.available, 0)
        firstRef.nft.version++
        emitNftUpdated(firstRef.nft)
      }

      const stored = db.quotes[body.quoteId]
      const fresh = computeQuote(cart, body.network)
      const stale =
        !stored ||
        stored.cartId !== cart.id ||
        Date.parse(stored.expiresAt) < Date.now() ||
        stored.fingerprint !== body.quoteFingerprint ||
        fresh.fingerprint !== stored.fingerprint ||
        fresh.hasIssues
      if (stale) {
        db.quotes[fresh.id] = { ...fresh, cartId: cart.id }
        save()
        throw new HttpError(409, 'QUOTE_STALE', 'Preço, disponibilidade ou taxas mudaram. Revise a nova cotação e confirme novamente.', undefined, { quote: fresh })
      }

      const now = new Date().toISOString()
      const timeout = consumeScenario('order-timeout')
      const order: DbOrder = {
        id: randomId('ord_'),
        userId: user.id,
        status: 'pending',
        version: 1,
        createdAt: now,
        updatedAt: now,
        network: body.network,
        walletSlot: body.walletSlot,
        walletAddress: wallet.address,
        provider: body.provider,
        lines: fresh.lines.map((l) => ({
          nftId: l.nftId,
          editionId: l.editionId,
          name: l.name,
          tokenId: l.tokenId,
          image: l.image,
          editionLabel: l.editionLabel,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
        })),
        subtotal: fresh.subtotal,
        discount: fresh.discount,
        networkFee: fresh.networkFee,
        total: fresh.total,
        couponCode: fresh.coupon?.code ?? null,
        transaction: null,
        failureReason: null,
        settleAt: hasScenario('manual-settlement') ? Number.POSITIVE_INFINITY : Date.now() + getConfig().settleDelayMs + (timeout ? 15_000 : 0),
        idempotencyKey: key,
        requestHash,
        reserved: true,
      }
      db.orders[order.id] = order
      db.idempotency[idemKey] = { orderId: order.id, requestHash }
      adjustAvailability(order, -1)
      save()
      schedule(order)

      // Cenário: o pedido é criado, mas a resposta excede o timeout do cliente.
      if (timeout) await sleep(15_000)
      return HttpResponse.json(publicOrder(order), { status: 201 })
    }),
  ),

  http.get(
    `${API}/orders`,
    route(({ request }) => {
      const { user } = requireUser(request)
      const status = new URL(request.url).searchParams.get('status')
      const items = Object.values(db.orders)
        .filter((o) => o.userId === user.id && (!status || o.status === status))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .map(publicOrder)
      return HttpResponse.json({ items })
    }),
  ),

  http.get(
    `${API}/orders/:id`,
    route(({ request, params }) => {
      const { user } = requireUser(request)
      const order = db.orders[params.id as string]
      if (!order) throw new HttpError(404, 'NOT_FOUND', 'Pedido não encontrado.')
      if (order.userId !== user.id) throw new HttpError(403, 'FORBIDDEN', 'Você não tem permissão para ver este pedido.')
      return HttpResponse.json(publicOrder(order))
    }),
  ),
]
