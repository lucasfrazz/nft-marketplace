/**
 * Aritmética decimal exata para valores em ETH.
 * Valores trafegam como strings decimais e são convertidos para wei (BigInt,
 * 18 casas) apenas para cálculo — nunca para `number`.
 */
import type { EthString } from '@/api/contracts'

const DECIMALS = 18n
const SCALE = 10n ** DECIMALS
const DECIMAL_RE = /^-?\d+(\.\d+)?$/

export function isEthString(value: string): boolean {
  return DECIMAL_RE.test(value.trim())
}

export function toWei(value: EthString): bigint {
  const v = value.trim()
  if (!isEthString(v)) throw new Error(`Valor ETH inválido: "${value}"`)
  const negative = v.startsWith('-')
  const [int, frac = ''] = (negative ? v.slice(1) : v).split('.')
  if (frac.length > Number(DECIMALS)) throw new Error(`Precisão acima de 18 casas: "${value}"`)
  const wei = BigInt(int) * SCALE + BigInt(frac.padEnd(Number(DECIMALS), '0') || '0')
  return negative ? -wei : wei
}

export function fromWei(wei: bigint): EthString {
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const int = abs / SCALE
  const frac = (abs % SCALE).toString().padStart(Number(DECIMALS), '0').replace(/0+$/, '')
  return `${negative ? '-' : ''}${int}${frac ? `.${frac}` : ''}`
}

export const add = (...values: EthString[]): EthString => fromWei(values.reduce((acc, v) => acc + toWei(v), 0n))
export const sub = (a: EthString, b: EthString): EthString => fromWei(toWei(a) - toWei(b))
export const mulInt = (a: EthString, n: number): EthString => {
  if (!Number.isInteger(n)) throw new Error('Quantidade deve ser inteira')
  return fromWei(toWei(a) * BigInt(n))
}
/** Percentual inteiro (ex.: 10 = 10%), arredondado para baixo no wei. */
export const percentOf = (a: EthString, percent: number): EthString => fromWei((toWei(a) * BigInt(Math.round(percent * 100))) / 10000n)
export const compare = (a: EthString, b: EthString): -1 | 0 | 1 => {
  const d = toWei(a) - toWei(b)
  return d === 0n ? 0 : d < 0n ? -1 : 1
}
export const isZero = (a: EthString) => toWei(a) === 0n
export const max = (a: EthString, b: EthString) => (compare(a, b) >= 0 ? a : b)

/**
 * Formata para exibição preservando a precisão: mínimo de 2 casas decimais,
 * sem zeros à direita além disso (ex.: "26.846", "1.19", "0.016").
 */
export function formatEth(value: EthString, opts: { unit?: boolean; minDecimals?: number } = {}): string {
  const { unit = true, minDecimals = 2 } = opts
  const normalized = fromWei(toWei(value))
  const [int, frac = ''] = normalized.replace('-', '').split('.')
  const padded = frac.length < minDecimals ? frac.padEnd(minDecimals, '0') : frac
  const sign = normalized.startsWith('-') ? '-' : ''
  return `${sign}${int}.${padded}${unit ? ' ETH' : ''}`
}
