import type { Network, OrderStatus, WalletProvider } from '@/api/contracts'

export const NETWORK_LABEL: Record<Network, string> = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }
export const PROVIDER_LABEL: Record<WalletProvider, string> = { metamask: 'MetaMask', walletconnect: 'WalletConnect', coinbase: 'Coinbase Wallet' }
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = { pending: 'Pendente', confirmed: 'Confirmado', declined: 'Recusado' }

export const labelNetwork = (n: Network) => NETWORK_LABEL[n]

export function shortAddress(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr
}

/** Data no formato do layout: "29 Jul, 2026". */
export function formatShortDate(iso: string) {
  const d = new Date(iso)
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d).replace('.', '')
  return `${String(d.getDate()).padStart(2, '0')} ${month[0].toUpperCase()}${month.slice(1)}, ${d.getFullYear()}`
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
}
