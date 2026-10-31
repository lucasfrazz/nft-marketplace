import type { Network, OrderStatus, WalletProvider } from '@/api/contracts'

export const NETWORK_LABEL: Record<Network, string> = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }
export const PROVIDER_LABEL: Record<WalletProvider, string> = { metamask: 'MetaMask', walletconnect: 'WalletConnect', coinbase: 'Coinbase Wallet' }
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = { pending: 'Pendente', confirmed: 'Confirmado', declined: 'Recusado' }

export const labelNetwork = (n: Network) => NETWORK_LABEL[n]

export function shortAddress(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
}
