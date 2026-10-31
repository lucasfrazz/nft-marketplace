import { Link } from '@tanstack/react-router'
import { EmptyState, ErrorState } from '@/components/common'
import { NftCard, NftCardSkeleton } from '@/components/nft-card'
import { useFavorites } from '@/features/favorites/hooks'

export function FavoritesPage() {
  const favorites = useFavorites()
  return (
    <section aria-labelledby="fav-title">
      <h2 id="fav-title" className="text-lg font-bold text-cream">
        Lista de interesse
      </h2>
      <div className="mt-6">
        {favorites.isPending ? (
          <ul className="grid grid-cols-2 gap-6 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <li key={i}>
                <NftCardSkeleton />
              </li>
            ))}
          </ul>
        ) : favorites.isError ? (
          <ErrorState message={favorites.error.message} onRetry={() => void favorites.refetch()} />
        ) : favorites.data.items.length === 0 ? (
          <EmptyState title="Nenhum favorito ainda">
            <Link to="/" className="rounded-[3px] bg-copper px-4 py-2 text-sm font-bold text-ink">
              Explorar NFTs
            </Link>
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-2 gap-6 lg:grid-cols-3" data-testid="favorites-grid">
            {favorites.data.items.map((n) => (
              <li key={n.id}>
                <NftCard nft={n} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
