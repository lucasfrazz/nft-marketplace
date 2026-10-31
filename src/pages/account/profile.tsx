import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ImageIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { isApiError } from '@/api/http'
import { ErrorState, Skeleton } from '@/components/common'
import { EnsInput, Field, PasswordInput, TextInput } from '@/components/form'
import { announce } from '@/components/live-region'
import { useChangePassword, useProfile, useRemoveAvatar, useSetAvatar, useUpdateProfile } from '@/features/account/hooks'
import { profileSchema, type ProfileForm } from '@/features/account/schemas'

const MAX_AVATAR = 1024 * 1024

export function ProfilePage() {
  const profile = useProfile()
  if (profile.isPending)
    return (
      <div className="grid gap-6 sm:grid-cols-2" aria-busy="true" aria-label="Carregando perfil">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-[66px]" />
        ))}
      </div>
    )
  if (profile.isError) return <ErrorState message={profile.error.message} onRetry={() => void profile.refetch()} />
  return <ProfileFormView key={profile.data.version} />
}

function ProfileFormView() {
  const user = useProfile().data!
  const update = useUpdateProfile()
  const password = useChangePassword()
  const setAvatar = useSetAvatar()
  const removeAvatar = useRemoveAvatar()
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: user.displayName, username: user.username, email: user.email, ensName: user.ensName, walletNickname: user.walletNickname, currentPassword: '', newPassword: '', confirmPassword: '' },
    mode: 'onTouched',
  })
  const { register, handleSubmit, formState, setError, reset } = form
  const e = formState.errors
  useEffect(() => setStatus(null), [formState.isDirty])

  const onSubmit = handleSubmit(async (v) => {
    setStatus(null)
    try {
      await update.mutateAsync({ displayName: v.displayName, username: v.username, email: v.email, ensName: v.ensName, walletNickname: v.walletNickname })
      if (v.newPassword) await password.mutateAsync({ currentPassword: v.currentPassword, newPassword: v.newPassword })
      reset({ ...v, currentPassword: '', newPassword: '', confirmPassword: '' })
      const msg = v.newPassword ? 'Perfil e senha atualizados.' : 'Perfil atualizado.'
      setStatus(msg)
      announce(msg)
      toast.success(msg)
    } catch (err) {
      if (isApiError(err)) {
        const fields = Object.entries(err.fields)
        fields.forEach(([k, m], i) => setError(k as keyof ProfileForm, { message: m }, { shouldFocus: i === 0 }))
        announce(err.message)
        if (!fields.length) toast.error(err.message)
      }
    }
  })

  const onFile = (file?: File) => {
    setAvatarError(null)
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setAvatarError('Envie uma imagem PNG, JPEG ou WebP.')
    if (file.size > MAX_AVATAR) return setAvatarError('A imagem deve ter no máximo 1 MB.')
    const reader = new FileReader()
    reader.onload = () =>
      setAvatar.mutate(String(reader.result), {
        onSuccess: () => {
          announce('Avatar atualizado.')
          toast.success('Avatar atualizado.')
        },
        onError: (err) => setAvatarError(isApiError(err) ? (err.fields.avatar ?? err.message) : 'Falha ao enviar o avatar.'),
      })
    reader.readAsDataURL(file)
  }

  const saving = update.isPending || password.isPending
  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="profile-title">
      <h2 id="profile-title" className="text-lg font-bold text-cream">
        Perfil do colecionador
      </h2>
      <div className="mt-6 grid gap-x-7 gap-y-6 sm:grid-cols-2">
        <Field label="Nome de exibição" required error={e.displayName?.message}>
          {(a) => <TextInput {...a} autoComplete="name" {...register('displayName')} data-testid="profile-displayName" />}
        </Field>
        <Field label="Nome de usuário" required error={e.username?.message}>
          {(a) => <TextInput {...a} autoComplete="username" {...register('username')} data-testid="profile-username" />}
        </Field>
        <Field label="E-mail" required error={e.email?.message}>
          {(a) => <TextInput {...a} type="email" autoComplete="email" {...register('email')} data-testid="profile-email" />}
        </Field>
        <Field label="Nome ENS" required error={e.ensName?.message}>
          {(a) => <EnsInput {...a} {...register('ensName')} data-testid="profile-ens" />}
        </Field>
        <Field label="Apelido da carteira" required error={e.walletNickname?.message}>
          {(a) => <TextInput {...a} {...register('walletNickname')} />}
        </Field>
        <div>
          <p id="avatar-label" className="mb-2 text-[15px] text-cream">
            Avatar
          </p>
          <div className="flex items-center gap-6" role="group" aria-labelledby="avatar-label">
            <span className="grid size-[50px] place-items-center overflow-hidden rounded-full border border-line-strong bg-surface-2 text-copper">
              {user.avatar ? <img src={user.avatar} alt="Seu avatar atual" className="size-full object-cover" data-testid="avatar-img" /> : <ImageIcon className="size-6" aria-label="Sem avatar" />}
            </span>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(ev) => onFile(ev.target.files?.[0])} aria-label="Escolher imagem de avatar" data-testid="avatar-input" tabIndex={-1} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={setAvatar.isPending} className="h-10 rounded-[3px] bg-copper px-6 text-sm font-bold text-ink hover:bg-copper-bright disabled:opacity-60">
              {setAvatar.isPending ? 'Enviando…' : 'Alterar'}
            </button>
            <button type="button" onClick={() => removeAvatar.mutate(undefined, { onSuccess: () => announce('Avatar removido.') })} disabled={!user.avatar || removeAvatar.isPending} className="text-sm text-cream hover:text-copper disabled:opacity-50" data-testid="avatar-remove">
              Remover
            </button>
          </div>
          {avatarError && (
            <p role="alert" className="mt-2 text-xs text-coral" data-testid="avatar-error">
              {avatarError}
            </p>
          )}
        </div>
      </div>

      <fieldset className="mt-10 max-w-[417px] space-y-5">
        <legend className="mb-4 text-[17px] font-bold text-cream">Alterar senha</legend>
        <Field label="Senha atual" error={e.currentPassword?.message}>
          {(a) => <PasswordInput {...a} autoComplete="current-password" {...register('currentPassword')} data-testid="pw-current" />}
        </Field>
        <Field label="Nova senha" error={e.newPassword?.message} hint="Mínimo de 8 caracteres, com letras e números.">
          {(a) => <PasswordInput {...a} autoComplete="new-password" {...register('newPassword')} data-testid="pw-new" />}
        </Field>
        <Field label="Confirmar nova senha" error={e.confirmPassword?.message}>
          {(a) => <PasswordInput {...a} autoComplete="new-password" {...register('confirmPassword')} data-testid="pw-confirm" />}
        </Field>
      </fieldset>

      <div className="mt-8 flex items-center gap-4">
        <button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-[3px] bg-copper px-10 text-sm font-bold text-ink hover:bg-copper-bright disabled:opacity-60" data-testid="profile-save">
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden />} Salvar
        </button>
        {status && (
          <p role="status" className="text-sm text-success" data-testid="profile-status">
            {status}
          </p>
        )}
      </div>
    </form>
  )
}
