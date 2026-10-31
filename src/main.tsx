import './index.css'

/**
 * Os mocks (MSW REST + Socket.IO) são ativados por configuração
 * (`VITE_ENABLE_MOCKS=true`) e carregados sob demanda.
 *
 * IMPORTANTE: a aplicação é importada SOMENTE depois de o MSW iniciar.
 * O `engine.io-client` captura a referência de `globalThis.WebSocket` ao
 * carregar o módulo; se ele for avaliado antes do interceptador de WebSocket
 * do MSW, as conexões Socket.IO escapariam do mock.
 */
async function enableMocks() {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'true') return
  const { startMocks } = await import('./mocks/browser')
  await startMocks()
}

enableMocks()
  .then(() => import('./app/bootstrap'))
  .then(({ mount }) => mount(document.getElementById('root')!))
