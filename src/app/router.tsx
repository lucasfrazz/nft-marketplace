import { createRootRoute, createRoute, createRouter, lazyRouteComponent, redirect } from '@tanstack/react-router'
import { RootLayout } from '@/components/layout/root-layout'
import { NotFoundPage } from '@/pages/not-found'
import { HomePage } from '@/pages/home'
import { validateCatalogSearch } from '@/features/catalog/search'
import { sessionStore } from '@/features/session/session-store'

/** Protege rotas privadas, preservando o destino para retomada após login. */
function requireAuth({ location }: { location: { href: string } }) {
  if (!sessionStore.get().token) {
    throw redirect({ to: '/entrar', search: { redirect: location.href } })
  }
}

export function safeRedirect(target: unknown): string {
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') ? target : '/'
}

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: () => <NotFoundPage />,
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: validateCatalogSearch,
  component: HomePage,
})

const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/$nftId',
  validateSearch: (s: Record<string, unknown>): { edition?: string } => ({ edition: typeof s.edition === 'string' ? s.edition : undefined }),
  component: lazyRouteComponent(() => import('@/pages/nft-detail'), 'NftDetailPage'),
})

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/carrinho',
  component: lazyRouteComponent(() => import('@/pages/cart'), 'CartPage'),
})

const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pagamento',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/pages/checkout'), 'CheckoutPage'),
})

const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pedidos/$orderId',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/pages/order'), 'OrderPage'),
})

const explorerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/explorer/tx/$hash',
  component: lazyRouteComponent(() => import('@/pages/explorer'), 'ExplorerPage'),
})

type AuthSearch = { redirect?: string; reason?: 'expired' }
const authSearch = (s: Record<string, unknown>): AuthSearch => ({
  redirect: typeof s.redirect === 'string' ? s.redirect : undefined,
  reason: s.reason === 'expired' ? 'expired' : undefined,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/entrar',
  validateSearch: authSearch,
  component: lazyRouteComponent(() => import('@/pages/auth'), 'LoginPage'),
})

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cadastro',
  validateSearch: authSearch,
  component: lazyRouteComponent(() => import('@/pages/auth'), 'SignupPage'),
})

const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/conta',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/pages/account/layout'), 'AccountLayout'),
})

const accountIndexRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/conta/perfil' })
  },
})

const profileRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: '/perfil',
  component: lazyRouteComponent(() => import('@/pages/account/profile'), 'ProfilePage'),
})

const walletsRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: '/carteiras',
  component: lazyRouteComponent(() => import('@/pages/account/wallets'), 'WalletsPage'),
})

const favoritesRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: '/favoritos',
  component: lazyRouteComponent(() => import('@/pages/account/favorites'), 'FavoritesPage'),
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  nftRoute,
  cartRoute,
  checkoutRoute,
  orderRoute,
  explorerRoute,
  loginRoute,
  signupRoute,
  accountRoute.addChildren([accountIndexRoute, profileRoute, walletsRoute, favoritesRoute]),
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultNotFoundComponent: () => <NotFoundPage />,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export { homeRoute, nftRoute, loginRoute, signupRoute, orderRoute, explorerRoute }
