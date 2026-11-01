import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Network, Wallet, WalletProvider, WalletSlot } from '@/api/contracts'
import { isApiError } from '@/api/http'
import { ErrorState, Skeleton } from '@/components/common'
import { EnsInput, Field, SelectField, TextInput } from '@/components/form'
import { announce } from '@/components/live-region'
import { useProfile, useSaveWallet, useWallets } from '@/features/account/hooks'
import { walletSchema, type WalletForm } from '@/features/account/schemas'
import { NETWORK_LABEL, PROVIDER_LABEL, shortAddress } from '@/lib/labels'

const NETWORK_OPTIONS = (Object.keys(NETWORK_LABEL) as Network[]).map((value) => ({ value, label: NETWORK_LABEL[value] }))
const PROVIDER_OPTIONS = (Object.keys(PROVIDER_LABEL) as WalletProvider[]).map((value) => ({ value, label: PROVIDER_LABEL[value] }))

export function WalletsPage() {
  const wallets = useWallets()
  const profile = useProfile()
  const save = useSaveWallet()
  const [showSecondary, setShowSecondary] = useState(false)

  if (wallets.isPending || profile.isPending)
    return (
      <div className="grid gap-6 sm:grid-cols-2" aria-busy="true" aria-label="Carregando carteiras">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-[66px]" />
        ))}
      </div>
    )
  if (wallets.isError) return <ErrorState message={wallets.error.message} onRetry={() => void wallets.refetch()} />
  const { primary, secondary, secondarySameAsPrimary } = wallets.data

  return (
    <div className="space-y-12">
      <section aria-labelledby="primary-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="primary-title" className="text-lg font-bold text-cream">
              Carteira principal
            </h2>
            <p className="text-[13px] text-sand">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
          </div>
        </div>
        <WalletFormView slot="primary" wallet={primary} key="primary" />
      </section>

      <section aria-labelledby="secondary-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="secondary-title" className="text-lg font-bold text-cream">
            Carteira secundária
          </h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-[15px] text-cream">
              <input
                type="checkbox"
                className="size-4 accent-copper"
                checked={secondarySameAsPrimary}
                disabled={!primary || save.isPending}
                onChange={(ev) => {
                  if (ev.target.checked)
                    save.mutate(
                      { slot: 'secondary', body: { sameAsPrimary: true } },
                      { onSuccess: () => announce('Carteira secundária igual à principal.'), onError: (e) => toast.error(isApiError(e) ? e.message : 'Falha ao salvar.') },
                    )
                  else setShowSecondary(true)
                }}
                data-testid="same-as-primary"
              />
              Igual à carteira principal
            </label>
            {!secondary && !showSecondary && (
              <button type="button" onClick={() => setShowSecondary(true)} disabled={!primary} className="text-[17px] font-bold text-copper hover:underline disabled:opacity-50" data-testid="add-secondary">
                Adicionar
              </button>
            )}
          </div>
        </div>
        {secondarySameAsPrimary && primary ? (
          <p className="mt-2 text-[15px] text-sand">Usando a carteira principal ({shortAddress(primary.address)}).</p>
        ) : secondary || showSecondary ? (
          <WalletFormView slot="secondary" wallet={secondarySameAsPrimary ? null : secondary} key="secondary" />
        ) : (
          <p className="mt-2 text-[15px] text-sand">{primary ? 'Você ainda não adicionou uma carteira secundária.' : 'Cadastre a carteira principal primeiro.'}</p>
        )}
      </section>
    </div>
  )
}

function WalletFormView({ slot, wallet }: { slot: WalletSlot; wallet: Wallet | null }) {
  const profile = useProfile()
  const save = useSaveWallet()
  const [status, setStatus] = useState<string | null>(null)
  const form = useForm<WalletForm>({
    resolver: zodResolver(walletSchema),
    defaultValues: wallet
      ? { displayName: wallet.displayName, nickname: wallet.nickname, network: wallet.network, profileName: wallet.profileName, address: wallet.address, ensOrSecondary: wallet.ensOrSecondary, provider: wallet.provider, referralCode: wallet.referralCode, email: wallet.email, ensName: wallet.ensName }
      : { displayName: profile.data?.displayName ?? '', nickname: '', network: undefined as unknown as Network, profileName: profile.data?.username ?? '', address: '', ensOrSecondary: '', provider: undefined as unknown as WalletProvider, referralCode: '', email: profile.data?.email ?? '', ensName: profile.data?.ensName ?? '' },
    mode: 'onTouched',
  })
  const { register, control, handleSubmit, formState, setError } = form
  const e = formState.errors
  const p = slot === 'primary' ? 'w1' : 'w2'

  const onSubmit = handleSubmit((v) => {
    setStatus(null)
    save.mutate(
      { slot, body: v },
      {
        onSuccess: () => {
          const msg = `Carteira ${slot === 'primary' ? 'principal' : 'secundária'} salva.`
          setStatus(msg)
          announce(msg)
          toast.success(msg)
        },
        onError: (err) => {
          if (!isApiError(err)) return
          const entries = Object.entries(err.fields)
          entries.forEach(([k, m], i) => setError(k as keyof WalletForm, { message: m }, { shouldFocus: i === 0 }))
          announce(err.message)
          if (!entries.length) toast.error(err.message)
        },
      },
    )
  })

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6" aria-label={`Carteira ${slot === 'primary' ? 'principal' : 'secundária'}`} data-testid={`wallet-form-${slot}`}>
      <div className="grid gap-x-7 gap-y-6 sm:grid-cols-2">
        <Field label="Nome de exibição" required error={e.displayName?.message}>
          {(a) => <TextInput {...a} {...register('displayName')} />}
        </Field>
        <Field label="Apelido da carteira" required error={e.nickname?.message}>
          {(a) => <TextInput {...a} {...register('nickname')} data-testid={`${p}-nickname`} />}
        </Field>
        <Field label="Rede" required error={e.network?.message}>
          {(a) => <Controller control={control} name="network" render={({ field }) => <SelectField a11y={a} value={field.value} onChange={field.onChange} options={NETWORK_OPTIONS} placeholder="Selecione uma rede" testId={`${p}-network`} />} />}
        </Field>
        <Field label="Nome do perfil" required error={e.profileName?.message}>
          {(a) => <TextInput {...a} {...register('profileName')} />}
        </Field>
        <Field label="Endereço da carteira" required error={e.address?.message}>
          {(a) => <TextInput {...a} placeholder="Endereço 0x da carteira" spellCheck={false} {...register('address')} data-testid={`${p}-address`} />}
        </Field>
        <Field label="ENS ou carteira secundária (opcional)" error={e.ensOrSecondary?.message}>
          {(a) => <TextInput {...a} placeholder="ENS ou carteira secundária (opcional)" {...register('ensOrSecondary')} />}
        </Field>
        <Field label="Tipo de carteira" required error={e.provider?.message}>
          {(a) => <Controller control={control} name="provider" render={({ field }) => <SelectField a11y={a} value={field.value} onChange={field.onChange} options={PROVIDER_OPTIONS} placeholder="Selecione uma carteira" testId={`${p}-provider`} />} />}
        </Field>
        <Field label="Código de indicação" required error={e.referralCode?.message}>
          {(a) => <TextInput {...a} {...register('referralCode')} data-testid={`${p}-referral`} />}
        </Field>
        <Field label="E-mail" required error={e.email?.message}>
          {(a) => <TextInput {...a} type="email" {...register('email')} />}
        </Field>
        <Field label="Nome ENS" required error={e.ensName?.message}>
          {(a) => <EnsInput {...a} {...register('ensName')} />}
        </Field>
      </div>
      <div className="mt-8 flex items-center gap-4">
        <button type="submit" disabled={save.isPending} className="inline-flex h-10 items-center gap-2 rounded-[3px] bg-copper px-3 text-sm font-bold text-ink hover:bg-copper-bright disabled:opacity-60" data-testid={`${p}-save`}>
          {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />} Salvar carteira
        </button>
        {status && (
          <p role="status" className="text-sm text-success">
            {status}
          </p>
        )}
      </div>
    </form>
  )
}
