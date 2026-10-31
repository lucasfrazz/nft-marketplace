import { Link } from '@tanstack/react-router'

export function NotFoundPage({ title = 'Página não encontrada', message = 'O endereço acessado não existe ou foi removido.' }: { title?: string; message?: string }) {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center py-24 text-center" data-testid="not-found">
      <p className="text-6xl font-bold text-copper" aria-hidden>
        404
      </p>
      <h1 className="mt-4 text-2xl font-bold text-cream">{title}</h1>
      <p className="mt-3 text-sand">{message}</p>
      <Link to="/" className="mt-8 rounded-[3px] bg-copper px-6 py-2.5 font-bold text-ink hover:bg-copper-bright">
        Voltar ao início
      </Link>
    </section>
  )
}
