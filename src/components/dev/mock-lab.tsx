/**
 * Painel "Mock Lab" — seleção e reset dos cenários simulados (MSW).
 * Disponível apenas quando VITE_ENABLE_MOCKS=true. Opera exclusivamente via
 * `window.__kurioMock` (camada de rede); não altera estado da aplicação.
 */
import { useEffect, useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { LATENCY_MODES, SCENARIOS, type LatencyMode, type MockConfig, type ScenarioId } from '@/mocks/config'
import { queryClient } from '@/app/query-client'
import type { Cart } from '@/api/contracts'
import { add } from '@/lib/eth'

export default function MockLab() {
  const [open, setOpen] = useState(false)
  const [config, setConfig] = useState<MockConfig | null>(null)
  const [log, setLog] = useState('')
  const ctl = window.__kurioMock

  useEffect(() => {
    if (open && ctl) setConfig(ctl.getConfig())
  }, [open, ctl])
  if (!ctl) return null

  const patch = (p: Partial<MockConfig>) => {
    ctl.setConfig(p)
    setConfig(ctl.getConfig())
  }
  const toggle = (id: ScenarioId) => {
    const s = new Set(config?.scenarios)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    patch({ scenarios: [...s] })
  }
  const bumpCartPrice = () => {
    const cart = queryClient.getQueriesData<Cart>({ queryKey: ['cart'] }).map(([, c]) => c).find((c) => c?.items.length)
    const item = cart?.items[0]
    const id = item?.nftId ?? 'emerald-ape-042'
    const edition = item?.editionId ?? '1-50'
    const nft = ctl.snapshot().nfts.find((n) => n.id === id)!
    const current = nft.editions.find((e) => e.id === edition)!.price
    ctl.updateNft(id, { editionId: edition, price: add(current, '0.10') })
    setLog(`nft.updated emitido: ${nft.name} ${edition} → +0.10 ETH`)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 left-3 z-40 flex items-center gap-1.5 rounded-full border border-copper/60 bg-ink/90 px-3 py-2 text-xs font-bold text-copper shadow-lg hover:bg-band md:bottom-4"
        aria-label="Abrir Mock Lab (cenários simulados)"
        data-testid="mock-lab-open"
      >
        <FlaskConical className="size-4" aria-hidden /> Mock Lab
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[340px] overflow-y-auto border-line bg-surface text-cream">
          <SheetHeader>
            <SheetTitle className="text-cream">Mock Lab</SheetTitle>
            <SheetDescription className="text-sand">Cenários determinísticos do MSW (REST + Socket.IO). Persistem após refresh.</SheetDescription>
          </SheetHeader>
          {config && (
            <div className="space-y-6 px-4 pb-8 text-sm">
              <fieldset>
                <legend className="mb-2 font-bold">Cenários</legend>
                <ul className="space-y-1.5">
                  {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => (
                    <li key={id}>
                      <label className="flex items-start gap-2">
                        <input type="checkbox" className="mt-0.5 size-4 accent-copper" checked={config.scenarios.includes(id)} onChange={() => toggle(id)} />
                        <span>
                          <code className="text-copper">{id}</code>
                          <span className="block text-xs text-sand-2">{SCENARIOS[id]}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
              <label className="block">
                <span className="mb-1 block font-bold">Latência</span>
                <select className="h-9 w-full rounded-[3px] border border-line-strong bg-ink px-2" value={config.latency} onChange={(e) => patch({ latency: e.target.value as LatencyMode })}>
                  {(Object.keys(LATENCY_MODES) as LatencyMode[]).map((l) => (
                    <option key={l} value={l}>
                      {LATENCY_MODES[l]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block font-bold">Liquidação do pedido (ms)</span>
                <input type="number" min={0} step={500} className="h-9 w-full rounded-[3px] border border-line-strong bg-ink px-2" value={config.settleDelayMs} onChange={(e) => patch({ settleDelayMs: Math.max(0, Number(e.target.value)) })} />
              </label>
              <div className="space-y-2">
                <p className="font-bold">Eventos e conexão</p>
                <button type="button" className="w-full rounded-[3px] border border-copper px-3 py-2 text-left text-copper" onClick={bumpCartPrice}>
                  Alterar preço do 1º item do carrinho (+0.10)
                </button>
                <button type="button" className="w-full rounded-[3px] border border-copper px-3 py-2 text-left text-copper" onClick={() => (ctl.replayLast('nft.updated'), setLog('Último nft.updated reenviado (duplicata).'))}>
                  Reenviar último nft.updated (duplicata)
                </button>
                <button type="button" className="w-full rounded-[3px] border border-copper px-3 py-2 text-left text-copper" onClick={() => (ctl.dropConnections(), setLog('Conexões Socket.IO derrubadas.'))}>
                  Derrubar conexão Socket.IO
                </button>
                <button type="button" className="w-full rounded-[3px] border border-copper px-3 py-2 text-left text-copper" onClick={() => (ctl.expireSessions(), setLog('Sessões expiradas no servidor.'))}>
                  Expirar sessão no servidor
                </button>
              </div>
              <button
                type="button"
                className="w-full rounded-[3px] bg-copper px-3 py-2 font-bold text-ink"
                onClick={async () => {
                  await ctl.reset()
                  localStorage.removeItem('kurio.session.v1')
                  localStorage.removeItem('kurio.guestCart.v1')
                  sessionStorage.clear()
                  window.location.assign('/')
                }}
              >
                Resetar dados e sessão
              </button>
              {log && (
                <p role="status" className="text-xs text-sand">
                  {log}
                </p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
