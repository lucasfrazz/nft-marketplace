/**
 * Cliente HTTP único (Axios). Responsável por:
 *  - anexar o token de sessão ou o identificador do carrinho de visitante;
 *  - normalizar erros em `ApiError` (tipado pelo contrato);
 *  - sinalizar expiração de sessão para o restante da aplicação.
 */
import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import type { ApiErrorBody, ApiErrorCode } from './contracts'
import { getGuestCartId, sessionStore } from '@/features/session/session-store'

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

export const http = axios.create({
  baseURL: API_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode | 'NETWORK' | 'TIMEOUT' | 'CANCELED'
  readonly fields: Record<string, string>
  readonly details: unknown

  constructor(args: { status: number; code: ApiError['code']; message: string; fields?: Record<string, string>; details?: unknown }) {
    super(args.message)
    this.name = 'ApiError'
    this.status = args.status
    this.code = args.code
    this.fields = args.fields ?? {}
    this.details = args.details
  }

  /** Falhas que podem ser repetidas com segurança (rede, timeout, 5xx). */
  get isTransient() {
    return this.code === 'NETWORK' || this.code === 'TIMEOUT' || this.status >= 500
  }
}

http.interceptors.request.use((config) => {
  const { token } = sessionStore.get()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  else config.headers.set('X-Cart-Id', getGuestCartId())
  return config
})

http.interceptors.response.use(
  (r) => r,
  (error: AxiosError<ApiErrorBody>) => {
    if (axios.isCancel(error)) return Promise.reject(new ApiError({ status: 0, code: 'CANCELED', message: 'Requisição cancelada.' }))
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')
      return Promise.reject(new ApiError({ status: 0, code: 'TIMEOUT', message: 'O servidor demorou para responder.' }))
    if (!error.response) return Promise.reject(new ApiError({ status: 0, code: 'NETWORK', message: 'Sem conexão com o servidor. Verifique sua rede.' }))

    const { status, data } = error.response
    const body = data?.error
    const apiError = new ApiError({
      status,
      code: body?.code ?? (status >= 500 ? 'INTERNAL' : 'VALIDATION_ERROR'),
      message: body?.message ?? 'Algo deu errado. Tente novamente.',
      fields: body?.fields,
      details: body?.details,
    })

    // Sessão inválida/expirada em requisição autenticada: encerra a sessão local.
    const sentToken = (error.config?.headers?.Authorization as string | undefined)?.slice(7)
    if (status === 401 && sentToken && sentToken === sessionStore.get().token) {
      sessionStore.end('expired')
    }
    return Promise.reject(apiError)
  },
)

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const res = await http.request<T>(config)
  return res.data
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}
