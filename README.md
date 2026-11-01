# Kurio — Marketplace de NFTs

Implementação do desafio frontend **NFT Marketplace** (layout Figma "Frontend Challenge"): descoberta, compra e conta do colecionador, em desktop e mobile, com API REST e tempo real **simulados** (MSW + Socket.IO).

- **Aplicação publicada:** https://kurio-nft-marketplace-gamma.vercel.app
- **Arquitetura, contratos e decisões:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Auditoria Lighthouse:** [lighthouse/SUMMARY.md](lighthouse/SUMMARY.md)
- **Segurança:** [ARCHITECTURE.md › Segurança](ARCHITECTURE.md#14-segurança)

| Stack | |
| --- | --- |
| Interface / linguagem | React 19 + TypeScript 7 (Vite 8) |
| Roteamento | TanStack Router (rotas por código, search params tipados, guardas de autenticação) |
| Estado remoto | TanStack Query 5 |
| HTTP | Axios (cliente único com interceptors) |
| Tempo real | `socket.io-client` 4 |
| Estilo / componentes | Tailwind CSS 4 + shadcn/ui (Radix) adaptado à identidade Kurio |
| Mocks | MSW 2 (REST + WebSocket) + `@mswjs/socket.io-binding` |
| Formulários | react-hook-form + zod |
| Testes | Playwright (E2E + regressão visual) |
| Auditoria | Lighthouse 13 |

---

## Setup

Pré-requisitos: **Node.js 20+** (testado com 22.23) e npm 10+.

```bash
npm install
npx playwright install chromium   # apenas para os testes E2E
npm run dev                       # http://localhost:5173
```

Não há backend: a API e o servidor Socket.IO rodam **dentro do navegador** via MSW. A entrega roda a partir de um checkout limpo, sem serviços externos.

### Variáveis de ambiente

Definidas em `.env` (versionado, sem segredos; `.env.example` é idêntico):

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Ativa a camada MSW (REST + Socket.IO). Também ativa no build de demonstração. |
| `VITE_API_URL` | `/api` | Base da API REST (interceptada pelo MSW). |
| `VITE_SOCKET_URL` | `wss://realtime.kurio.mock` | Endereço do servidor Socket.IO (interceptado pelo MSW). |

### Credenciais fictícias

| Usuário | E-mail | Senha | Observação |
| --- | --- | --- | --- |
| Ana Souza | `ana@kurio.dev` | `Kurio@123` | Com carteiras principal (MetaMask/Ethereum) e secundária (Coinbase/Polygon) |
| Bruno Lima | `bruno@kurio.dev` | `Kurio@123` | Sem carteiras (para testar o cadastro) |

Senhas são armazenadas no banco simulado apenas como **hash PBKDF2-SHA256 (210.000 iterações) com salt aleatório** (nunca em claro). Após 5 tentativas erradas, o login daquele e-mail fica bloqueado por 10 minutos.

**Cupons:** `KURIO10` (10%), `GENESIS25` (25%, mínimo 2 ETH), `VERAO2025` (expirado). Qualquer outro código é inválido.

---

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Desenvolvimento com mocks (porta 5173) |
| `npm run build` | Verificação de tipos + build otimizado (mocks inclusos) |
| `npm run preview` | Serve o build (porta 4173) |
| `npm run typecheck` | `tsc -b` (app + testes) |
| `npm run lint` | oxlint em `src` e `e2e` |
| `npm run test:e2e` | Playwright: faz o build, sobe o preview e roda tudo (desktop + mobile) |
| `npm run test:e2e:update` | Regera as baselines de regressão visual |
| `npm run test:e2e:report` | Abre o relatório HTML (traces das falhas inclusos) |
| `npm run lighthouse` | Auditoria (requer `npm run build` antes) — 3 execuções por página/perfil |
| `npm run images` | Regera as variantes WebP das artes a partir de `design/source` |

---

## Cenários simulados (seleção e reset)

Os cenários são **determinísticos** (RNG com seed) e podem ser escolhidos de três formas:

1. **Painel “Mock Lab”** — botão flutuante no canto inferior esquerdo: liga/desliga cenários, muda latência e tempo de liquidação, emite eventos e **reseta os dados**.
2. **URL** (lida no boot e removida da barra):
   `/?mock=payment-declined,wallet-reject&mock-latency=slow&mock-seed=7&mock-settle=4000&mock-reset=1`
3. **Console / testes:** `window.__kurioMock` (ver `src/mocks/browser.ts`).

A configuração e o banco simulado persistem em `localStorage` (sobrevivem ao refresh). **Reset** (`mock-reset=1` ou botão “Resetar dados e sessão”) restaura integralmente as fixtures.

| Cenário | Efeito |
| --- | --- |
| `empty-catalog` | Catálogo retorna vazio |
| `catalog-error` | Catálogo/detalhe respondem HTTP 500 |
| `flaky-catalog` | As 3 primeiras consultas à listagem falham com 503 (1ª + 2 retries) |
| `out-of-order` | Consultas da listagem alternam lenta (1,8 s) / rápida → respostas fora de ordem |
| `offline` | REST falha com erro de rede e o Socket.IO recusa conexões |
| `session-expired` | A próxima requisição autenticada retorna `SESSION_EXPIRED` |
| `signup-conflict` | Cadastro sempre retorna e-mail em uso |
| `favorite-fail` | Mutations de favoritos falham com 500 (rollback otimista) |
| `wallet-reject` | Próxima conexão de carteira é recusada |
| `price-change-at-checkout` | Ao enviar o pedido, o preço muda (evento + `QUOTE_STALE`) |
| `sold-out-at-checkout` | Ao enviar o pedido, a edição esgota (evento + `QUOTE_STALE`) |
| `order-timeout` | O pedido é criado, mas a resposta excede o timeout do cliente |
| `payment-declined` | Liquidação recusa o pagamento |
| `manual-settlement` | Pedido fica pendente até `settleOrder` manual |

Latência: `none`, `realistic` (padrão, 120–350 ms), `slow` (2,5 s), `variable` (100–1800 ms).

### Como reproduzir os fluxos de falha

| Fluxo | Passos |
| --- | --- |
| Rede lenta + skeletons | `/?mock-latency=slow` |
| Falha e nova tentativa | `/?mock=flaky-catalog` → aparece o erro → **Tentar novamente** |
| Respostas fora de ordem | `/?mock=out-of-order` → digite rápido na busca: o resultado final é sempre o da última busca |
| Sessão expirada | Logado, Mock Lab → **Expirar sessão no servidor** → navegue para `/conta/perfil` ou `/pagamento` → login → retoma o destino (rascunho do checkout preservado) |
| Preço muda no checkout | Logado com item no carrinho, abra `/pagamento` → Mock Lab → **Alterar preço do 1º item do carrinho** → aviso + confirmação bloqueada até aceitar |
| Timeout com idempotência | `/?mock=order-timeout` → compre → após ~6 s o cliente reenvia com a mesma chave e recupera **o mesmo pedido** |
| Pagamento recusado | `/?mock=payment-declined` → compre → tela de recusa, itens preservados no carrinho |
| Desconexão com pedido pendente | `/?mock=manual-settlement` → compre → recarregue / **Derrubar conexão** → no console: `__kurioMock.settleOrder('<id>', 'confirmed')` |
| Eventos duplicados | Mock Lab → **Reenviar último nft.updated** (ignorado pelo cliente) |

---

## Testes E2E (Playwright)

```bash
npm run test:e2e            # 72 testes: desktop (1440×900) + mobile (390×844, fluxos @main e @visual)
npm run test:e2e:report     # relatório HTML; traces são mantidos nas falhas
```

| Arquivo | Cobertura |
| --- | --- |
| `01-catalog` | Busca, filtros combinados, ordenação, paginação, histórico/refresh, vazio, fora de ordem |
| `02-detail` | Acesso direto, NFT e rota inexistentes, edição esgotada, limite de quantidade |
| `03-auth` | Cadastro (validação, conflito), login, expiração de sessão, logout e troca de usuário |
| `04-favorites` | Persistência, visitante, falha de mutation com rollback e recuperação |
| `05-cart` | Quantidades, limite, remoção, cupom inválido/expirado/válido, refresh e merge no login |
| `06-purchase` | Compra completa catálogo → recibo; recibo preserva snapshot |
| `07-payment-failures` | Recusa, cliques repetidos, timeout + idempotência, recusa/desconexão de carteira |
| `08-account` | Perfil, avatar, senha e carteiras com erros de validação e da API |
| `09-realtime-checkout` | Preço/disponibilidade via Socket.IO durante checkout e carrinho |
| `10-realtime-events` | Duplicatas, eventos antigos, reconexão + reconciliação, pedido pendente retomado, isolamento por usuário |
| `11-a11y` | Teclado, foco em diálogos/drawers, erros associados, overflow em 390/768/1440 |
| `12-loading` | Skeletons com relógio controlado, falhas 5xx/rede e recuperação |
| `13-visual` | Regressão visual de início, detalhe, carrinho e pagamento (desktop e mobile) |
| `14-security` | Redirect seguro, bloqueio de tentativas, hash de senhas, XSS, validação no servidor, 403 entre usuários, cabeçalhos |

Cada teste parte de estado isolado (contexto novo + `mock-reset`). Eventos de tempo real são disparados pelo servidor simulado e **passam pelo `socket.io-client`**; REST passa pelos handlers MSW. **Regressão visual entre sistemas operacionais:** a renderização de fontes difere entre Windows, Linux e macOS. Por isso as baselines ficam separadas por sistema em `e2e/__screenshots__/<so>/`, e as versionadas são as de `win32/`. Em Linux ou macOS, a **primeira execução** de `npm run test:e2e` cria automaticamente as baselines daquele sistema e os testes passam (`updateSnapshots: 'missing'`, verificado com Playwright 1.64: 1ª execução sem baselines → 8/8 aprovados, código de saída 0). As execuções seguintes comparam com elas. No CI (`CI=true`), baseline ausente é tratada como falha.

---

## Lighthouse

`npm run build && npm run lighthouse` — mediana de 3 execuções (relatórios HTML/JSON em `lighthouse/reports/`).

| Página / perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início — mobile | 85 | 100 | 100 | 100 | 3.10 s | 0.000 | 352 ms |
| Início — desktop | 99 | 100 | 100 | 100 | 0.99 s | 0.019 | 0 ms |
| Detalhe — mobile | 85 | 100 | 100 | 100 | 3.33 s | 0.000 | 331 ms |
| Detalhe — desktop | 99 | 100 | 100 | 100 | 0.97 s | 0.005 | 2 ms |

A performance mobile fica abaixo da meta (90) por causa do custo estrutural de rodar a API simulada no navegador — análise completa em [ARCHITECTURE.md › Performance](ARCHITECTURE.md#10-performance-e-lighthouse).

---

## Deploy

Vercel (`vercel.json`: build Vite, fallback SPA para acesso direto/refresh de qualquer rota, cache imutável de assets). O build publicado inclui os mocks e o tempo real.

```bash
npx vercel@latest deploy --prod
```

## Estrutura

```
src/
  api/          contratos tipados (contracts.ts), cliente Axios, endpoints
  app/          router, query client/chaves, bootstrap, limpeza de sessão
  features/     hooks por domínio (catalog, cart, orders, account, favorites, session, realtime)
  components/   layout, componentes de UI (shadcn em components/ui), formulários
  pages/        telas (rotas)
  mocks/        MSW: config de cenários, fixtures, banco simulado, handlers REST, servidor Socket.IO
  lib/          aritmética ETH (BigInt), rótulos, utilitários
e2e/            testes Playwright + baselines visuais
lighthouse/     script e relatórios da auditoria
design/         frames exportados do Figma e artes originais
```
