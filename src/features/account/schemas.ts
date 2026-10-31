import { z } from 'zod'

const required = (label = 'Campo obrigatório.') => z.string().trim().min(1, label)

export const usernameSchema = z
  .string()
  .trim()
  .min(1, 'Informe o nome de usuário.')
  .regex(/^[a-z0-9._]{3,20}$/, 'Use de 3 a 20 caracteres: letras minúsculas, números, "." ou "_".')
export const emailSchema = z.string().trim().min(1, 'Informe o e-mail.').email('Informe um e-mail válido.')
export const ensSchema = z
  .string()
  .trim()
  .min(1, 'Informe o nome ENS.')
  .regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*$/, 'Use letras minúsculas, números e hífen.')
export const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres.')
  .regex(/[A-Za-z]/, 'A senha deve conter letras e números.')
  .regex(/\d/, 'A senha deve conter letras e números.')
export const networkSchema = z.enum(['ethereum', 'polygon', 'solana'], { message: 'Selecione uma rede.' })
export const providerSchema = z.enum(['metamask', 'walletconnect', 'coinbase'], { message: 'Selecione uma carteira.' })

export const walletSchema = z.object({
  displayName: required('Informe o nome de exibição.'),
  nickname: required('Informe o apelido da carteira.'),
  network: networkSchema,
  profileName: required('Informe o nome do perfil.'),
  address: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Endereço deve começar com 0x e ter 40 caracteres hexadecimais.'),
  ensOrSecondary: z
    .string()
    .trim()
    .refine((v) => !v || /^0x[a-fA-F0-9]{40}$/.test(v) || /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/.test(v), 'Informe um nome ENS (ex.: nome.eth) ou endereço 0x.'),
  provider: providerSchema,
  referralCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{4,20}$/, 'Código deve ter de 4 a 20 letras, números ou hífen.'),
  email: emailSchema,
  ensName: ensSchema,
})
export type WalletForm = z.infer<typeof walletSchema>

export const profileSchema = z
  .object({
    displayName: required('Informe o nome de exibição.').max(40, 'Máximo de 40 caracteres.'),
    username: usernameSchema,
    email: emailSchema,
    ensName: ensSchema,
    walletNickname: required('Informe o apelido da carteira.'),
    currentPassword: z.string(),
    newPassword: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((v, ctx) => {
    const changing = v.currentPassword || v.newPassword || v.confirmPassword
    if (!changing) return
    if (!v.currentPassword) ctx.addIssue({ code: 'custom', path: ['currentPassword'], message: 'Informe a senha atual.' })
    const r = passwordSchema.safeParse(v.newPassword)
    if (!r.success) ctx.addIssue({ code: 'custom', path: ['newPassword'], message: r.error.issues[0].message })
    if (v.newPassword !== v.confirmPassword) ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'As senhas não conferem.' })
  })
export type ProfileForm = z.infer<typeof profileSchema>

export const checkoutSchema = z.object({
  displayName: required('Informe o nome de exibição.'),
  username: usernameSchema,
  network: networkSchema,
  profileName: required('Informe o nome do perfil.'),
  ensOrSecondary: z.string().trim(),
  provider: providerSchema,
  referralCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{4,20}$/, 'Código deve ter de 4 a 20 letras, números ou hífen.'),
  email: emailSchema,
  ensName: ensSchema,
  useSecondary: z.boolean(),
  note: z.string().max(280, 'Máximo de 280 caracteres.'),
})
export type CheckoutForm = z.infer<typeof checkoutSchema>

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe sua senha.'),
})

export const signupSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirme a senha.'),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem.' })
