import { Link, useParams } from '@tanstack/react-router'

/** Explorador de blocos SIMULADO — a referência de transação não existe em rede real. */
export function ExplorerPage() {
  const { hash } = useParams({ from: '/explorer/tx/$hash' })
  return (
    <section className="mx-auto max-w-2xl py-16">
      <p className="text-xs font-bold tracking-[0.1em] text-copper">EXPLORADOR SIMULADO</p>
      <h1 className="mt-2 text-xl font-bold text-cream">Detalhes da transação</h1>
      <p className="mt-3 text-sm text-sand">Esta é uma referência gerada pela simulação da demonstração. Nenhuma transação foi registrada em uma blockchain real.</p>
      <dl className="mt-6 space-y-2 rounded-[6px] bg-surface p-5 text-sm">
        <dt className="text-sand-2">Hash</dt>
        <dd className="font-mono break-all text-cream">{hash}</dd>
        <dt className="text-sand-2">Status</dt>
        <dd className="text-cream">Sucesso (simulado)</dd>
      </dl>
      <Link to="/" className="mt-6 inline-block text-copper underline">
        Voltar ao início
      </Link>
    </section>
  )
}
