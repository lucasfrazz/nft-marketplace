import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, ChevronLeft, Loader2, PlugZap, Unplug } from 'lucide-react'
import { toast } from 'sonner'
import type { Network, Quote, Wallet, WalletProvider, WalletSlot } from '@/api/contracts'
import { isApiError } from '@/api/http'
import { queryClient, qk } from '@/app/query-client'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Breadcrumb, EmptyState, ErrorState, Skeleton } from '@/components/common'
import { EnsInput, Field, SelectField, TextInput, fieldClass } from '@/components/form'
import { NftImage } from '@/components/nft-image'
import { WalletBadges } from '@/components/layout/site-footer'
import { announce } from '@/components/live-region'
import { checkoutSchema, type CheckoutForm } from '@/features/account/schemas'
import { useConnectWallet, useDisconnectWallet, useProfile, useWallets } from '@/features/account/hooks'
import { CouponForm, QuoteIssues, QuoteSummary } from '@/features/cart/components'
import { useCart, useQuote } from '@/features/cart/hooks'
import { clearAttempt, getAttemptKey, useCreateOrder, usePendingOrders } from '@/features/orders/hooks'
import { useAuthUser, useCartOwner } from '@/features/session/hooks'
import { formatEth } from '@/lib/eth'
import { NETWORK_LABEL, PROVIDER_LABEL, shortAddress } from '@/lib/labels'
import { cn } from '@/lib/utils'

const NETWORK_OPTIONS = (Object.keys(NETWORK_LABEL) as Network[]).map((value) => ({ value, label: NETWORK_LABEL[value] }))
const PROVIDER_OPTIONS = (Object.keys(PROVIDER_LABEL) as WalletProvider[]).map((value) => ({ value, label: PROVIDER_LABEL[value] }))

const draftKey = (uid: string) => `kurio.checkout.draft.${uid}`

export function CheckoutPage() {
  const user = useAuthUser()!
  const cart = useCart()
  const wallets = useWallets()
  const profile = useProfile()

  if (cart.isPending || wallets.isPending || profile.isPending) return <CheckoutSkeleton />
  if (cart.isError || wallets.isError || profile.isError)
    return (
      <div className="py-16">
        <ErrorState
          message={(cart.error ?? wallets.error ?? profile.error)?.message}
          onRetry={() => {
            void cart.refetch()
            void wallets.refetch()
            void profile.refetch()
          }}
        />
      </div>
    )
  if (!cart.data.items.length)
    return (
      <div className="py-16">
        <EmptyState title="Seu carrinho está vazio">
          <Link to="/" className="rounded-[3px] bg-copper px-5 py-2 font-bold text-ink">
            Explorar NFTs
          </Link>
        </EmptyState>
      </div>
    )
  return <CheckoutView key={user.id} />
}

function CheckoutView() {
  const user = useAuthUser()!
  const owner = useCartOwner()
  const navigate = useNavigate()
  const profile = useProfile().data!
  const walletsQ = useWallets()
  const wallets = walletsQ.data!
  const pending = usePendingOrders()
  const connect = useConnectWallet()
  const disconnect = useDisconnectWallet()
  const [retryInfo, setRetryInfo] = useState<string | null>(null)
  const createOrder = useCreateOrder((n) => setRetryInfo(`Sem resposta do servidor. Reenviando com a mesma chave (tentativa ${n + 1})…`))
  const [connectError, setConnectError] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [review, setReview] = useState<Quote | null>(null)
  const [showCoupon, setShowCoupon] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const defaults = useMemo<CheckoutForm>(() => {
    const w = wallets.primary
    const base: CheckoutForm = {
      displayName: profile.displayName,
      username: profile.username,
      network: w?.network ?? 'ethereum',
      profileName: w?.profileName ?? profile.username,
      ensOrSecondary: wallets.secondary?.ensOrSecondary || w?.ensOrSecondary || '',
      provider: w?.provider ?? 'metamask',
      referralCode: w?.referralCode ?? '',
      email: profile.email,
      ensName: profile.ensName,
      useSecondary: false,
      note: '',
    }
    try {
      const draft = sessionStorage.getItem(draftKey(user.id))
      if (draft) return { ...base, ...(JSON.parse(draft) as Partial<CheckoutForm>) }
    } catch {
      /* ignore */
    }
    return base
  }, [profile, wallets.primary, wallets.secondary, user.id])

  const form = useForm<CheckoutForm>({ resolver: zodResolver(checkoutSchema), defaultValues: defaults, mode: 'onTouched' })
  const { register, control, handleSubmit, watch, formState, setValue } = form
  const errors = formState.errors

  // Rascunho: preserva o contexto em caso de expiração de sessão/refresh.
  useEffect(() => {
    const sub = watch((v) => {
      try {
        sessionStorage.setItem(draftKey(user.id), JSON.stringify(v))
      } catch {
        /* ignore */
      }
    })
    return () => sub.unsubscribe()
  }, [watch, user.id])

  const network = watch('network')
  const provider = watch('provider')
  const useSecondary = watch('useSecondary')
  const slot: WalletSlot = useSecondary ? 'secondary' : 'primary'
  const wallet: Wallet | null = wallets[slot]
  const connected = wallet?.connection.status === 'connected' && wallet.connection.network === network
  const quote = useQuote(network)
  const q = quote.data
  const pendingOrder = pending.data?.items[0]

  const doConnect = () => {
    if (!wallet) return
    setConnectError(null)
    connect.mutate(
      { slot, provider, network },
      {
        onSuccess: () => announce(`Carteira ${PROVIDER_LABEL[provider]} conectada na rede ${NETWORK_LABEL[network]}.`),
        onError: (e) => {
          const msg = isApiError(e) && e.code === 'WALLET_REJECTED' ? 'A conexão foi recusada na carteira. Aprove a solicitação e tente novamente.' : isApiError(e) ? e.message : 'Falha ao conectar a carteira.'
          setConnectError(msg)
          announce(msg)
        },
      },
    )
  }

  /** 1) valida o formulário  2) revalida a cotação  3) abre a revisão. */
  const onSubmit = handleSubmit(async () => {
    setBanner(null)
    if (!wallet) return setBanner('Cadastre uma carteira para pagar.')
    if (!connected) return setBanner('Conecte sua carteira na rede selecionada antes de confirmar.')
    const seen = q?.fingerprint
    const fresh = await quote.refetch()
    if (!fresh.data) return setBanner('Não foi possível revalidar a cotação. Tente novamente.')
    if (fresh.data.hasIssues) {
      const msg = 'Preço ou disponibilidade mudaram. Revise as alterações antes de continuar.'
      setBanner(msg)
      announce(msg)
      return
    }
    if (seen && seen !== fresh.data.fingerprint) {
      const msg = 'Os valores foram atualizados. Confira o novo resumo e confirme novamente.'
      setBanner(msg)
      announce(msg)
      return
    }
    setRetryInfo(null)
    setReview(fresh.data)
  }, () => {
    announce('Verifique os campos destacados no formulário.')
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  })

  // Uma alteração em tempo real durante a revisão invalida a cotação revisada.
  const reviewStale = !!review && !!q && q.fingerprint !== review.fingerprint

  const confirm = () => {
    if (!review || !wallet) return
    const v = form.getValues()
    const key = getAttemptKey(user.id, review.fingerprint)
    createOrder.mutate(
      {
        key,
        body: {
          quoteId: review.id,
          quoteFingerprint: review.fingerprint,
          walletSlot: slot,
          provider: v.provider,
          network: v.network,
          buyer: { displayName: v.displayName, username: v.username, profileName: v.profileName, email: v.email, referralCode: v.referralCode, ensName: v.ensName, note: v.note },
        },
      },
      {
        onSuccess: (order) => {
          try {
            sessionStorage.removeItem(draftKey(user.id))
          } catch {
            /* ignore */
          }
          setReview(null)
          void navigate({ to: '/pedidos/$orderId', params: { orderId: order.id } })
        },
        onError: (e) => {
          setRetryInfo(null)
          if (isApiError(e) && e.code === 'QUOTE_STALE') {
            const fresh = (e.details as { quote?: Quote })?.quote
            if (fresh) queryClient.setQueryData([...qk.quote(owner, v.network), queryClient.getQueryData<{ version: number }>(qk.cart(owner))?.version ?? 0], fresh)
            void queryClient.invalidateQueries({ queryKey: qk.cart(owner) })
            void queryClient.invalidateQueries({ queryKey: qk.quotes(owner) })
            clearAttempt()
            setReview(null)
            setBanner(e.message)
            announce(e.message)
            return
          }
          if (isApiError(e) && (e.code === 'TIMEOUT' || e.code === 'NETWORK')) {
            // A mesma chave continua salva: um novo clique recupera o mesmo pedido.
            void pending.refetch()
            setBanner('Não recebemos a confirmação do envio. Seu pedido pode ter sido criado — tente novamente: a mesma tentativa será recuperada sem duplicar a compra.')
            return
          }
          if (isApiError(e) && e.code === 'IDEMPOTENCY_CONFLICT') clearAttempt()
          if (isApiError(e) && e.code === 'WALLET_NOT_CONNECTED') void walletsQ.refetch()
          const msg = isApiError(e) ? e.message : 'Não foi possível enviar o pedido.'
          setBanner(msg)
          toast.error(msg)
        },
      },
    )
  }

  return (
    <div className="pt-4 md:pt-10">
      <div className="hidden md:block">
        <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/' }, { label: 'Pagamento' }]} />
      </div>
      <div className="relative flex items-center justify-center md:hidden">
        <Link to="/carrinho" className="absolute left-0 grid size-9 place-items-center rounded-full bg-surface text-sand" aria-label="Voltar ao carrinho">
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="text-xl font-bold text-cream">Pagamento com carteira</h1>
      </div>

      {pendingOrder && (
        <div role="status" className="mt-4 rounded-[6px] border border-copper/60 bg-band p-4 text-sm text-cream" data-testid="pending-order-banner">
          Você tem um pedido em processamento ({formatEth(pendingOrder.total)}).{' '}
          <Link to="/pedidos/$orderId" params={{ orderId: pendingOrder.id }} className="font-bold text-copper underline">
            Acompanhar pedido
          </Link>
        </div>
      )}
      {banner && (
        <div role="alert" className="mt-4 flex gap-2 rounded-[6px] border border-coral/60 bg-coral/10 p-4 text-sm text-cream" data-testid="checkout-banner">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-coral" aria-hidden /> {banner}
        </div>
      )}

      <form ref={formRef} onSubmit={onSubmit} noValidate className="mt-6 grid gap-10 lg:grid-cols-[1fr_405px] lg:gap-[32px]">
        {/* Dados do colecionador */}
        <section aria-labelledby="collector-title">
          <h1 id="collector-title" className="text-lg font-bold text-cream">
            Perfil do colecionador
          </h1>
          <div className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <Field label="Nome de exibição" required error={errors.displayName?.message}>
              {(a) => <TextInput {...a} autoComplete="name" {...register('displayName')} />}
            </Field>
            <Field label="Nome de usuário" required error={errors.username?.message}>
              {(a) => <TextInput {...a} autoComplete="username" {...register('username')} />}
            </Field>
            <Field label="Rede" required error={errors.network?.message}>
              {(a) => <Controller control={control} name="network" render={({ field }) => <SelectField a11y={a} value={field.value} onChange={field.onChange} options={NETWORK_OPTIONS} placeholder="Selecione uma rede" testId="network-select" />} />}
            </Field>
            <Field label="Nome do perfil" required error={errors.profileName?.message}>
              {(a) => <TextInput {...a} {...register('profileName')} />}
            </Field>
            <Field label="Endereço da carteira" required hint={wallet ? `Carteira ${slot === 'primary' ? 'principal' : 'secundária'} (${wallet.nickname})` : undefined}>
              {(a) => <TextInput {...a} readOnly value={wallet?.address ?? ''} placeholder="Endereço 0x da carteira" className="text-sand" />}
            </Field>
            <Field label="ENS ou carteira secundária (opcional)" error={errors.ensOrSecondary?.message} className="sm:pt-0">
              {(a) => <TextInput {...a} placeholder="ENS ou carteira secundária (opcional)" {...register('ensOrSecondary')} />}
            </Field>
            <Field label="Tipo de carteira" required error={errors.provider?.message}>
              {(a) => <Controller control={control} name="provider" render={({ field }) => <SelectField a11y={a} value={field.value} onChange={field.onChange} options={PROVIDER_OPTIONS} placeholder="Selecione uma carteira" />} />}
            </Field>
            <Field label="Código de indicação" required error={errors.referralCode?.message}>
              {(a) => <TextInput {...a} {...register('referralCode')} data-testid="referral" />}
            </Field>
            <Field label="E-mail" required error={errors.email?.message}>
              {(a) => <TextInput {...a} type="email" autoComplete="email" {...register('email')} />}
            </Field>
            <Field label="Nome ENS" required error={errors.ensName?.message}>
              {(a) => <EnsInput {...a} {...register('ensName')} />}
            </Field>
          </div>
          <label className={cn('mt-5 flex w-fit items-center gap-2 text-[15px] text-cream', !wallets.secondary && 'opacity-50')}>
            <input type="checkbox" className="check-round" disabled={!wallets.secondary} {...register('useSecondary')} data-testid="use-secondary" />
            Usar outra carteira?
            {!wallets.secondary && <span className="text-xs text-sand-2">(cadastre uma carteira secundária)</span>}
          </label>
          <Field label="Observação do colecionador (opcional)" error={errors.note?.message} className="mt-5 max-w-[350px]">
            {(a) => <Textarea {...a} rows={5} className={cn(fieldClass, 'h-[150px] resize-none py-2')} {...register('note')} />}
          </Field>
        </section>

        {/* Resumo + carteira */}
        <aside aria-labelledby="your-nfts" className="space-y-4">
          <h2 id="your-nfts" className="text-lg font-bold text-cream">
            Seus NFTs
          </h2>
          <div className="flex justify-between text-[15px] font-bold text-cream">
            <span>NFTs</span>
            <span>Subtotal</span>
          </div>
          {q ? (
            <ul className="space-y-3" data-testid="checkout-lines">
              {q.lines.map((l) => (
                <li key={`${l.nftId}-${l.editionId}`} className="flex items-center gap-2 bg-surface p-1 pr-3">
                  <NftImage art={l.image} alt="" width={160} sizes="65px" className="w-[65px] shrink-0 rounded-[3px]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-cream">{l.name}</p>
                    <p className="text-xs text-sand-2">
                      Edição {l.editionLabel} · {l.tokenId}
                    </p>
                  </div>
                  <span className="text-sm text-sand">(x {l.quantity})</span>
                  <span className={cn('w-24 text-right font-bold text-copper', l.issue && 'text-coral')}>{formatEth(l.lineTotal)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Skeleton className="h-40" />
          )}
          <QuoteIssues quote={q} />
          <div>
            <button type="button" onClick={() => setShowCoupon((s) => !s)} aria-expanded={showCoupon} className="w-full text-center text-[15px] text-cream hover:text-copper">
              Tem um código promocional? <span className="underline">Aplique aqui</span>
            </button>
            {showCoupon && (
              <div className="mt-3">
                <CouponForm />
              </div>
            )}
          </div>
          <QuoteSummary quote={q} loading={quote.isPending} />

          {/* Carteira e rede */}
          <fieldset className="space-y-3">
            <legend className="mb-3 w-full text-center text-[17px] font-bold text-cream">Carteira e rede</legend>
            {!wallets.primary ? (
              <div className="rounded-[3px] border border-line p-4 text-sm text-sand">
                Você ainda não cadastrou uma carteira.{' '}
                <Link to="/conta/carteiras" className="font-bold text-copper underline">
                  Cadastrar carteira
                </Link>
              </div>
            ) : (
              <>
                <WalletCard wallet={wallets.primary} active={slot === 'primary'} onSelect={() => setValue('useSecondary', false)} />
                {wallets.secondary && <WalletCard wallet={wallets.secondary} active={slot === 'secondary'} onSelect={() => setValue('useSecondary', true)} />}
                <div role="radiogroup" aria-label="Provedor da carteira" className="space-y-2">
                  {PROVIDER_OPTIONS.map((p) => (
                    <label key={p.value} className={cn('flex h-[45px] cursor-pointer items-center gap-3 rounded-[3px] border px-3 text-[15px] text-cream', provider === p.value ? 'border-cream' : 'border-line')}>
                      <input type="radio" value={p.value} checked={provider === p.value} onChange={() => setValue('provider', p.value as WalletProvider, { shouldValidate: true })} className="size-4 accent-copper" />
                      {p.label}
                    </label>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 rounded-[3px] border border-line p-3" data-testid="wallet-status">
                  <p className="text-sm text-cream" aria-live="polite">
                    {connected ? (
                      <>
                        <span className="mr-1 inline-block size-2 rounded-full bg-success" aria-hidden />
                        Conectada · {PROVIDER_LABEL[provider]} · {NETWORK_LABEL[network]}
                      </>
                    ) : (
                      <>
                        <span className="mr-1 inline-block size-2 rounded-full bg-sand-2" aria-hidden />
                        Desconectada
                      </>
                    )}
                  </p>
                  {connected ? (
                    <button type="button" onClick={() => disconnect.mutate(slot, { onSuccess: () => announce('Carteira desconectada.') })} disabled={disconnect.isPending} className="inline-flex items-center gap-1 text-sm text-sand hover:text-coral" data-testid="wallet-disconnect">
                      <Unplug className="size-4" aria-hidden /> Desconectar
                    </button>
                  ) : (
                    <button type="button" onClick={doConnect} disabled={connect.isPending} className="inline-flex items-center gap-1 rounded-[3px] bg-copper px-3 py-1.5 text-sm font-bold text-ink disabled:opacity-60" data-testid="wallet-connect">
                      {connect.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PlugZap className="size-4" aria-hidden />} Conectar
                    </button>
                  )}
                </div>
                {connectError && (
                  <p role="alert" className="text-sm text-coral" data-testid="wallet-error">
                    {connectError}
                  </p>
                )}
                <WalletBadges className="w-fit" />
              </>
            )}
          </fieldset>

          <button
            type="submit"
            disabled={!q || q.hasIssues || quote.isFetching || createOrder.isPending || !!pendingOrder}
            className="h-[45px] w-full rounded-[3px] bg-copper text-base font-bold text-ink hover:bg-copper-bright disabled:opacity-50 md:h-[45px]"
            data-testid="confirm-purchase"
          >
            {quote.isFetching ? 'Revalidando valores…' : 'Confirmar compra'}
          </button>
          {pendingOrder && <p className="text-xs text-sand-2">Aguarde a conclusão do pedido em processamento antes de iniciar outro.</p>}
        </aside>
      </form>

      <Dialog open={!!review} onOpenChange={(o) => !createOrder.isPending && !o && setReview(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto border-line bg-surface sm:max-w-[520px]" data-testid="review-dialog">
          <DialogTitle className="text-lg font-bold text-cream">Revisar pedido</DialogTitle>
          <DialogDescription className="text-sand">Confira os itens, a carteira e o total antes de enviar.</DialogDescription>
          {review && (
            <div className="space-y-4 text-sm">
              <ul className="space-y-2">
                {review.lines.map((l) => (
                  <li key={`${l.nftId}-${l.editionId}`} className="flex justify-between gap-2 text-cream">
                    <span>
                      {l.name} <span className="text-sand-2">({l.editionLabel}) x {l.quantity}</span>
                    </span>
                    <span className="font-bold text-copper">{formatEth(l.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <QuoteSummary quote={review} />
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sand">
                <dt>Carteira</dt>
                <dd className="text-cream">
                  {PROVIDER_LABEL[form.getValues('provider')]} · {wallet ? shortAddress(wallet.address) : ''}
                </dd>
                <dt>Rede</dt>
                <dd className="text-cream">{NETWORK_LABEL[form.getValues('network')]}</dd>
                <dt>E-mail</dt>
                <dd className="text-cream">{form.getValues('email')}</dd>
              </dl>
              {reviewStale && (
                <p role="alert" className="rounded-[3px] border border-coral/60 bg-coral/10 p-3 text-cream" data-testid="review-stale">
                  Os valores mudaram enquanto você revisava. Feche e confirme novamente com a nova cotação.
                </p>
              )}
              {retryInfo && createOrder.isPending && (
                <p role="status" className="text-sand">
                  {retryInfo}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setReview(null)} disabled={createOrder.isPending} className="h-10 rounded-[3px] border border-line-strong px-4 text-cream">
                  Voltar
                </button>
                <button type="button" onClick={confirm} disabled={createOrder.isPending || reviewStale} className="inline-flex h-10 items-center justify-center gap-2 rounded-[3px] bg-copper px-5 font-bold text-ink disabled:opacity-60" data-testid="place-order">
                  {createOrder.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  {createOrder.isPending ? 'Enviando pedido…' : `Confirmar e pagar ${formatEth(review.total)}`}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function WalletCard({ wallet, active, onSelect }: { wallet: Wallet; active: boolean; onSelect: () => void }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 rounded-[10px] border bg-surface p-4', active ? 'border-copper' : 'border-line')}>
      <input type="radio" name="wallet-slot" checked={active} onChange={onSelect} className="mt-1 size-4 accent-copper" />
      <span className="min-w-0">
        <span className="block text-[15px] font-bold text-cream">
          {wallet.nickname || (wallet.slot === 'primary' ? 'Principal' : 'Reserva')}
        </span>
        <span className="block truncate text-sm text-sand">{wallet.ensOrSecondary || shortAddress(wallet.address)}</span>
        <span className="block text-sm text-sand-2">Rede {NETWORK_LABEL[wallet.network]}</span>
      </span>
    </label>
  )
}

function CheckoutSkeleton() {
  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_405px]" aria-busy="true" aria-label="Carregando pagamento" data-testid="checkout-skeleton">
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-[66px]" />
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-11" />
      </div>
    </div>
  )
}
