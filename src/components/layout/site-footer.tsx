import { Link } from '@tanstack/react-router'
import type { FormEvent } from 'react'
import { FacebookIcon, InstagramIcon, LinkedinIcon, TwitterIcon, YoutubeIcon } from '@/components/brand-icons'
import { notAvailable } from '@/lib/out-of-scope'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', body: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', body: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', body: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const SOCIAL = [
  { label: 'Facebook', href: 'https://www.facebook.com', Icon: FacebookIcon },
  { label: 'Instagram', href: 'https://www.instagram.com', Icon: InstagramIcon },
  { label: 'Twitter', href: 'https://twitter.com', Icon: TwitterIcon },
  { label: 'LinkedIn', href: 'https://www.linkedin.com', Icon: LinkedinIcon },
  { label: 'YouTube', href: 'https://www.youtube.com', Icon: YoutubeIcon },
]

export function WalletBadges({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex flex-wrap items-center gap-2 rounded-[3px] border border-line-strong bg-band px-2.5 py-1 text-[9px] font-bold tracking-[0.01em] text-copper-bright ${className}`}>
      METAMASK <span aria-hidden>·</span> WALLETCONNECT <span aria-hidden>·</span> COINBASE
    </span>
  )
}

const footLink = 'text-sm text-cream hover:text-copper-bright'

export function SiteFooter() {
  const onNewsletter = (e: FormEvent) => {
    e.preventDefault()
    notAvailable('A inscrição na newsletter')
  }
  return (
    <footer className="mx-auto mt-20 w-full max-w-[1200px] pb-28 md:mt-28 md:pb-6">
      <div className="grid gap-8 bg-surface px-6 py-8 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.35fr] lg:gap-0 lg:px-12">
        {FEATURES.map((f) => (
          <div key={f.letter} className="lg:border-r lg:border-copper/70 lg:px-6 lg:first:pl-0">
            <span aria-hidden className="grid size-[74px] place-items-center rounded-full bg-copper text-2xl font-bold text-ink">
              {f.letter}
            </span>
            <h2 className="mt-3 text-lg font-bold text-cream">{f.title}</h2>
            <p className="mt-2 text-[15px] leading-[22px] text-sand-2">{f.body}</p>
          </div>
        ))}
        <form onSubmit={onNewsletter} className="lg:pl-4" aria-labelledby="newsletter-title">
          <h2 id="newsletter-title" className="text-lg leading-4 font-bold text-cream">
            Antecipe-se ao próximo lançamento
          </h2>
          <div className="mt-6 flex">
            <label htmlFor="newsletter-email" className="sr-only">
              E-mail para novidades
            </label>
            <input id="newsletter-email" type="email" placeholder="digite seu e-mail..." className="h-10 min-w-0 flex-1 bg-surface-2 px-3 text-sm text-cream placeholder:text-sand-2" />
            <button type="submit" className="h-10 bg-copper px-4 text-lg font-medium text-ink hover:bg-copper-bright">
              Enviar
            </button>
          </div>
          <p className="mt-4 text-[13px] leading-[22px] text-sand-2">Receba lançamentos selecionados, histórias de criadores e novidades do mercado.</p>
        </form>
      </div>

      <div className="grid gap-3 bg-band px-6 py-6 text-sm text-cream sm:grid-cols-4 sm:items-center md:px-8">
        <span className="font-bold tracking-[0.1em]">KURIO</span>
        <span>Feito para colecionadores, criadores e cultura</span>
        <span>contato@email.com</span>
        <span>+55 11 4002 8922</span>
      </div>

      <div className="grid grid-cols-2 gap-8 bg-surface px-6 py-8 md:grid-cols-4 md:px-8">
        <nav aria-labelledby="f-profile">
          <h2 id="f-profile" className="mb-2 text-lg font-bold text-cream">Meu perfil</h2>
          <ul className="space-y-1.5">
            <li><Link to="/conta/perfil" className={footLink}>Meu perfil</Link></li>
            <li><Link to="/conta/colecao" className={footLink}>Minha coleção</Link></li>
            <li><button type="button" className={footLink} onClick={() => notAvailable('Atividade')}>Atividade</button></li>
            <li><button type="button" className={footLink} onClick={() => notAvailable('Estúdio do criador')}>Estúdio do criador</button></li>
            <li><Link to="/conta/favoritos" className={footLink}>Lista de interesse</Link></li>
          </ul>
        </nav>
        <nav aria-labelledby="f-help">
          <h2 id="f-help" className="mb-2 text-lg font-bold text-cream">Central de ajuda</h2>
          <ul className="space-y-1.5">
            {['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'].map((l) => (
              <li key={l}><button type="button" className={footLink} onClick={() => notAvailable(l)}>{l}</button></li>
            ))}
          </ul>
        </nav>
        <nav aria-labelledby="f-col">
          <h2 id="f-col" className="mb-2 text-lg font-bold text-cream">Coleções</h2>
          <ul className="space-y-1.5">
            {([['arte-digital', 'Arte digital'], ['fotografia', 'Fotografia'], ['musica', 'Música'], ['arte-3d', 'Arte 3D'], ['utilidade', 'Utilidade']] as const).map(([id, l]) => (
              <li key={id}><Link to="/" search={{ col: id }} hash="catalogo" className={footLink}>{l}</Link></li>
            ))}
          </ul>
        </nav>
        <div className="col-span-2 md:col-span-1">
          <h2 className="mb-2 text-lg font-bold text-cream">Redes sociais</h2>
          <ul className="flex flex-wrap gap-2">
            {SOCIAL.map(({ label, href, Icon }) => (
              <li key={label}>
                <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} (abre em nova aba)`} className="grid size-[30px] place-items-center rounded-[3px] border border-copper text-copper hover:bg-copper/15">
                  <Icon className="size-4" />
                </a>
              </li>
            ))}
          </ul>
          <h2 className="mt-6 mb-2 text-lg font-bold text-cream">Carteiras compatíveis</h2>
          <WalletBadges />
        </div>
      </div>
      <p className="py-3 text-center text-sm text-cream">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
