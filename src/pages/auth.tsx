import { useEffect, type ReactNode } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useForm, type FieldValues, type Path, type UseFormSetError } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { isApiError } from '@/api/http'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { FacebookIcon, GoogleIcon } from '@/components/brand-icons'
import { Field, PasswordInput, TextInput } from '@/components/form'
import { announce } from '@/components/live-region'
import { loginSchema, signupSchema } from '@/features/account/schemas'
import { useLogin, useSignup } from '@/features/session/hooks'
import { sessionStore } from '@/features/session/session-store'
import { safeRedirect } from '@/app/router'
import { notAvailable } from '@/lib/out-of-scope'
import { cn } from '@/lib/utils'
import { HomeView } from './home'

type Mode = 'login' | 'signup'

/** Aplica erros por campo retornados pela API (422/409) ao formulário. */
function applyApiErrors<T extends FieldValues>(e: unknown, setError: UseFormSetError<T>, fallbackField: Path<T>) {
  if (!isApiError(e)) return 'Não foi possível concluir. Tente novamente.'
  const entries = Object.entries(e.fields)
  if (entries.length) entries.forEach(([k, v], i) => setError(k as Path<T>, { message: v }, { shouldFocus: i === 0 }))
  else setError(fallbackField, { message: e.message }, { shouldFocus: true })
  return e.message
}

function AuthShell({ mode, children }: { mode: Mode; children: ReactNode }) {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { redirect?: string; reason?: 'expired' }
  const close = () => void navigate({ to: safeRedirect(search.redirect).split('?')[0] === '/pagamento' ? '/carrinho' : '/' })
  const title = mode === 'login' ? 'Entrar' : 'Criar conta'
  const subtitle = mode === 'login' ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.' : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'

  return (
    <>
      <div className="hidden md:block">
        <HomeView search={{}} onChange={() => undefined} inert />
      </div>
      <Dialog open onOpenChange={(o) => !o && close()}>
        <DialogContent
          className="top-0 left-0 h-dvh max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-none bg-ink p-0 ring-0 sm:max-w-none md:top-[160px] md:left-1/2 md:h-auto md:max-w-[500px] md:-translate-x-1/2 md:rounded-none md:bg-surface md:sm:max-w-[500px]"
          showCloseButton
          data-testid="auth-dialog"
        >
          <div className="flex h-full flex-col overflow-y-auto px-7 pt-16 pb-8 md:px-20 md:pt-12 md:pb-14">
            <p className="text-center text-3xl font-bold tracking-[0.1em] text-cream md:hidden" aria-hidden>
              KURIO
            </p>
            <DialogTitle className="mt-14 text-center text-xl font-bold text-cream md:mt-0">
              <span className="md:hidden">{mode === 'signup' ? 'Criar perfil de colecionador' : title}</span>
              <span className="hidden md:inline">
                <Link to="/entrar" search={search} className={cn(mode === 'login' ? 'text-copper' : 'text-cream hover:text-copper')} aria-current={mode === 'login' ? 'page' : undefined}>
                  Entrar
                </Link>
                <span className="mx-1.5 text-copper" aria-hidden>
                  |
                </span>
                <Link to="/cadastro" search={search} className={cn(mode === 'signup' ? 'text-copper' : 'text-cream hover:text-copper')} aria-current={mode === 'signup' ? 'page' : undefined}>
                  Criar conta
                </Link>
              </span>
            </DialogTitle>
            <DialogDescription className="mt-6 hidden text-center text-[13px] text-cream md:block">{subtitle}</DialogDescription>
            {search.reason === 'expired' && (
              <p role="alert" className="mt-4 rounded-[3px] border border-copper/60 bg-band p-3 text-center text-sm text-cream" data-testid="session-expired-msg">
                Sua sessão expirou. Entre novamente para continuar de onde parou.
              </p>
            )}
            {children}
            <div className="mt-6 flex items-center gap-3 text-[13px] text-cream">
              <span className="h-px flex-1 bg-line" aria-hidden />
              Ou continue com
              <span className="h-px flex-1 bg-line" aria-hidden />
            </div>
            <div className="mt-3 space-y-3">
              <button type="button" onClick={() => notAvailable('O login com Google')} className="flex h-10 w-full items-center justify-center gap-2 rounded-[3px] border border-line text-[13px] text-sand hover:border-copper">
                <GoogleIcon className="size-5" /> Continuar com Google
              </button>
              <button type="button" onClick={() => notAvailable('O login com Facebook')} className="flex h-10 w-full items-center justify-center gap-2 rounded-[3px] border border-line text-[13px] text-sand hover:border-copper">
                <FacebookIcon className="size-5 text-[#3b5999]" /> Continuar com Facebook
              </button>
            </div>
            <p className="mt-10 text-center text-[15px] text-sand md:hidden">
              {mode === 'login' ? (
                <Link to="/cadastro" search={search}>
                  Novo na Kurio? <span className="text-copper">Crie uma conta</span>
                </Link>
              ) : (
                <Link to="/entrar" search={search}>
                  Já tem uma conta? <span className="text-copper">Entre</span>
                </Link>
              )}
            </p>
          </div>
          <div className="hidden h-2.5 bg-copper md:block" aria-hidden />
        </DialogContent>
      </Dialog>
    </>
  )
}

function useAfterAuth() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { redirect?: string }
  return () => {
    const to = safeRedirect(search.redirect)
    void navigate({ to: to as '/', replace: true })
  }
}

export function LoginPage() {
  const login = useLogin()
  const done = useAfterAuth()
  useEffect(() => sessionStore.clearReason(), [])
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' }, mode: 'onTouched' })
  const { register, handleSubmit, formState, setError } = form

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: (s) => {
        announce(`Bem-vindo de volta, ${s.user.displayName}.`)
        toast.success(`Bem-vindo de volta, ${s.user.displayName}!`)
        done()
      },
      onError: (e) => announce(applyApiErrors(e, setError, 'password')),
    }),
  )

  return (
    <AuthShell mode="login">
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-3 md:mt-6" aria-label="Entrar">
        <Field label="E-mail" hideLabel required error={formState.errors.email?.message}>
          {(a) => <TextInput {...a} type="email" autoComplete="email" placeholder="contato@email.com" className="h-[50px] rounded-[10px] md:h-10 md:rounded-[3px]" {...register('email')} data-testid="login-email" />}
        </Field>
        <Field label="Senha" hideLabel required error={formState.errors.password?.message}>
          {(a) => <PasswordInput {...a} autoComplete="current-password" placeholder="Senha" className="h-[50px] rounded-[10px] md:h-10 md:rounded-[3px]" {...register('password')} data-testid="login-password" />}
        </Field>
        <div className="text-right">
          <button type="button" onClick={() => notAvailable('A recuperação de senha')} className="text-sm text-copper hover:underline">
            Esqueceu a senha?
          </button>
        </div>
        <button type="submit" disabled={login.isPending} className="mt-4 flex h-[60px] w-full items-center justify-center gap-2 rounded-[10px] bg-copper text-base font-bold text-ink hover:bg-copper-bright disabled:opacity-60 md:h-[45px] md:rounded-[3px]" data-testid="login-submit">
          {login.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />} Entrar
        </button>
      </form>
    </AuthShell>
  )
}

export function SignupPage() {
  const signup = useSignup()
  const done = useAfterAuth()
  const form = useForm<z.infer<typeof signupSchema>>({ resolver: zodResolver(signupSchema), defaultValues: { username: '', email: '', password: '', confirmPassword: '' }, mode: 'onTouched' })
  const { register, handleSubmit, formState, setError } = form
  const cls = 'h-[50px] rounded-[10px] md:h-10 md:rounded-[3px]'

  const onSubmit = handleSubmit(({ username, email, password }) =>
    signup.mutate(
      { username, email, password },
      {
        onSuccess: (s) => {
          announce(`Conta criada. Bem-vindo, ${s.user.username}.`)
          toast.success('Conta criada com sucesso!')
          done()
        },
        onError: (e) => announce(applyApiErrors(e, setError, 'email')),
      },
    ),
  )

  return (
    <AuthShell mode="signup">
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-3" aria-label="Criar conta">
        <Field label="Nome de usuário" hideLabel required error={formState.errors.username?.message}>
          {(a) => <TextInput {...a} autoComplete="username" placeholder="Nome de usuário" className={cls} {...register('username')} data-testid="signup-username" />}
        </Field>
        <Field label="E-mail" hideLabel required error={formState.errors.email?.message}>
          {(a) => <TextInput {...a} type="email" autoComplete="email" placeholder="Digite seu e-mail" className={cls} {...register('email')} data-testid="signup-email" />}
        </Field>
        <Field label="Senha" hideLabel required error={formState.errors.password?.message} hint="Mínimo de 8 caracteres, com letras e números.">
          {(a) => <PasswordInput {...a} autoComplete="new-password" placeholder="Senha" className={cls} {...register('password')} data-testid="signup-password" />}
        </Field>
        <Field label="Confirmar senha" hideLabel required error={formState.errors.confirmPassword?.message}>
          {(a) => <PasswordInput {...a} autoComplete="new-password" placeholder="Confirmar senha" className={cls} {...register('confirmPassword')} data-testid="signup-confirm" />}
        </Field>
        <button type="submit" disabled={signup.isPending} className="mt-4 flex h-[60px] w-full items-center justify-center gap-2 rounded-[10px] bg-copper text-base font-bold text-ink hover:bg-copper-bright disabled:opacity-60 md:h-[45px] md:rounded-[3px]" data-testid="signup-submit">
          {signup.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />} <span className="md:hidden">Criar perfil</span><span className="hidden md:inline">Criar conta</span>
        </button>
      </form>
    </AuthShell>
  )
}
