# Arquitetura — Kurio

Este documento registra contratos, políticas de estado e sessão, reconciliação em tempo real, limitações, decisões de UX e desvios do Figma.

## 1. Visão geral

```
UI (pages/components)
   │  hooks de domínio (features/*)  ──  TanStack Query (cache, mutations, retries)
   │                                     ▲             ▲
   │                         Axios (api/http.ts)   socket.io-client (features/realtime)
   ▼                                     │             │
TanStack Router (rotas, search params, guardas)     WebSocket
                                         │             │
                     ┌───────────────────┴─────────────┴──────────────┐
                     │ MSW (camada de rede, só quando VITE_ENABLE_MOCKS) │
                     │  handlers REST ── banco simulado (db.ts) ── servidor Socket.IO │
                     └──────────────────────────────────────────────────┘
```

- **Contratos tipados únicos** em `src/api/contracts.ts`, usados por Axios, hooks, UI e mocks.
- **Nenhum componente, hook ou cliente contém respostas fictícias.** Todo dado vem de requisições REST ou de eventos Socket.IO interceptados pelo MSW.
- O MSW inicia **antes** de a aplicação ser importada (`src/main.tsx`). O `engine.io-client` captura `globalThis.WebSocket` ao carregar o módulo; se carregasse antes, o socket escaparia do mock.

## 2. Contratos REST

Base: `VITE_API_URL` (padrão `/api`). JSON. Valores em ETH sempre como **string decimal**; quantidades inteiras. Autenticação: `Authorization: Bearer <token>`. O visitante envia `X-Cart-Id`.

### Erros

Formato único:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": { "email": "…" }, "details": {} } }
```

| HTTP | `code` | Uso |
| --- | --- | --- |
| 422 | `VALIDATION_ERROR`, `COUPON_INVALID`, `COUPON_EXPIRED` | validação (com `fields` por campo) |
| 401 | `UNAUTHENTICATED`, `SESSION_EXPIRED` | sessão ausente, inválida ou expirada |
| 403 | `FORBIDDEN`, `WALLET_REJECTED` | sem permissão (pedido de outro usuário) / carteira recusou |
| 404 | `NOT_FOUND` | recurso inexistente |
| 409 | `EMAIL_TAKEN`, `USERNAME_TAKEN`, `AVAILABILITY_CONFLICT`, `QUOTE_STALE`, `IDEMPOTENCY_CONFLICT`, `WALLET_NOT_CONNECTED` | conflitos |
| 500 / 503 | `INTERNAL` / `TRANSIENT` | falha do servidor / falha transitória |
| — | `NETWORK`, `TIMEOUT` (no cliente) | sem resposta / tempo esgotado |

### Recursos

| Recurso | Método e rota | Corpo / parâmetros | Resposta |
| --- | --- | --- | --- |
| **Sessão** | `POST /auth/signup` | `SignupRequest` (`username, email, password, guestCartId?`) | `201 Session` |
| | `POST /auth/login` | `LoginRequest` (`email, password, guestCartId?`) | `Session` |
| | `GET /auth/session` | — | `Session` (renovação deslizante de 30 min) |
| | `POST /auth/logout` | — | `204` |
| **NFTs** | `GET /nfts` | `q, collections, networks, minPrice, maxPrice, tab, sort, page, pageSize` | `NftListResponse` (itens, paginação, facetas, `applied`) |
| | `GET /nfts/:id` | — | `NftDetail` (edições com preço, disponibilidade e limite por pedido) |
| | `GET /nfts/:id/related` | — | `{ items: NftSummary[] }` |
| | `GET /highlights` | — | `HighlightsResponse` (hero, destaque, lançamentos, diário) |
| **Favoritos** | `GET /favorites` · `PUT /favorites/:nftId` · `DELETE /favorites/:nftId` | — | `FavoritesResponse` |
| **Carrinho** | `GET /cart` | — | `Cart` |
| | `POST /cart/items` | `{ nftId, editionId, quantity }` (soma) | `Cart` / `409 AVAILABILITY_CONFLICT` |
| | `PATCH /cart/items/:nftId/:editionId` | `{ quantity }` (0 remove) | `Cart` |
| | `DELETE /cart/items/:nftId/:editionId` | — | `Cart` |
| | `PUT /cart/coupon` · `DELETE /cart/coupon` | `{ code }` | `Cart` / `422 COUPON_*` |
| | `POST /cart/acknowledge` | — (aceita os preços atuais e ajusta as quantidades) | `Cart` |
| **Cotação** | `POST /quotes` | `{ network }` | `Quote` (linhas com `issue`, subtotal, desconto, taxa, total, `fingerprint`, validade de 5 min) |
| **Pedidos** | `POST /orders` | header `Idempotency-Key`; `CreateOrderRequest` (`quoteId, quoteFingerprint, walletSlot, provider, network, buyer`) | `201 Order` (pendente) · `200` mesmo pedido · `409 QUOTE_STALE` (com nova `Quote` em `details`) · `409 IDEMPOTENCY_CONFLICT` |
| | `GET /orders?status=pending` · `GET /orders/:id` | — | `{ items: Order[] }` · `Order` (`403` se for de outro usuário) |
| **Perfil** | `GET /profile` · `PATCH /profile` | `ProfileUpdateRequest` | `User` |
| | `PUT /profile/avatar` · `DELETE /profile/avatar` | `{ dataUrl }` (PNG/JPEG/WebP ≤ 1 MB) | `User` |
| | `POST /profile/password` | `{ currentPassword, newPassword }` | `204` (encerra as outras sessões) |
| **Carteiras** | `GET /wallets` | — | `WalletsResponse` (`primary`, `secondary`, `secondarySameAsPrimary`) |
| | `PUT /wallets/:slot` | `WalletInput` ou `{ sameAsPrimary: true }` | `WalletsResponse` |
| | `POST /wallets/:slot/connect` · `/disconnect` | `{ provider, network }` | `WalletsResponse` / `403 WALLET_REJECTED` |

**Idempotência de pedidos.** A chave pertence ao par (usuário, chave). Se a mesma chave chegar com o mesmo conteúdo (hash canônico do corpo), a API devolve o **mesmo pedido**. Se chegar com conteúdo diferente, devolve `409 IDEMPOTENCY_CONFLICT`. Pedidos `confirmed` e `declined` são **terminais**.

## 3. Eventos em tempo real (Socket.IO)

Envelope comum (`RealtimeEnvelope`):

```ts
{ id: string, type, resource: { type: 'nft' | 'order', id }, version: number, occurredAt, userId: string | null, data }
```

| Evento | Público | `data` | Efeito no cliente |
| --- | --- | --- | --- |
| `nft.updated` | todos | `price`, `previousPrice`, `available`, `editions[]` | atualiza catálogo, detalhe, relacionados e favoritos no cache. Se o NFT está no carrinho: aviso (toast + aria-live) e revalidação de carrinho e cotação |
| `order.updated` | só o dono | `status`, `order` (snapshot) | atualiza o pedido; quando confirmado, revalida o carrinho |

Regras aplicadas pelo cliente (`features/realtime/use-realtime.ts`):

- **Duplicatas:** os eventos são deduplicados por `id` (janela de 500).
- **Eventos antigos:** só se aplica `version` maior que a versão conhecida (cache ou registro local). Nada regride.
- **Estados terminais:** um pedido `confirmed` ou `declined` não volta a `pending`.
- **Isolamento:** um `order.updated` com `userId` diferente do usuário atual é descartado. O servidor também só envia para conexões autenticadas como o dono.
- **Ciclo de vida:** uma conexão por sessão. O token vai em `auth` no handshake. Ao trocar de usuário ou fazer logout, os listeners são removidos e o socket é encerrado.

**Transporte e limitações (ambiente de mocks).** O servidor é `ws.link()` do MSW + `@mswjs/socket.io-binding`. O cliente usa só `transports: ['websocket']`, porque long-polling não é simulado. O binding faz o handshake Engine.IO automaticamente, então o `auth` do CONNECT é lido do frame bruto `40{…}`. O binding também não tem rooms nem namespaces (o roteamento por usuário é feito no mock) e não envia PING, por isso o mock envia o heartbeat `2` a cada 20 s. Como tudo roda na aba, cada aba tem o seu próprio "servidor": não há broadcast entre abas.

## 4. Política de sessão

- Token opaco com expiração **deslizante de 30 min**, renovada a cada requisição autenticada. A sessão fica em `localStorage` (`kurio.session.v1`) e é revalidada no boot por `GET /auth/session`.
- **Expiração:** qualquer `401` numa requisição que levou o token atual encerra a sessão local (`sessionStore.end('expired')`). Em rota privada, o usuário vai para `/entrar?redirect=<rota>&reason=expired`. Depois do login, volta ao destino.
- **Contexto preservado no checkout:** o rascunho do formulário fica em `sessionStorage` por usuário, e a chave de idempotência da tentativa também é mantida.
- **Logout e troca de usuário** (`app/session-sync.ts`): cancelam requisições em andamento e removem do cache `['user', id]`, `['cart', id]`, `['quote', id]`, a sessão e as mutations. Também limpam a tentativa de compra e os avisos de tempo real e recriam o socket. As rotas privadas (`/pagamento`, `/pedidos/*`, `/conta/*`) são protegidas no `beforeLoad` do router.

## 5. Estado do carrinho

- O carrinho é um **recurso do servidor**. O visitante é identificado por `X-Cart-Id` (UUID gerado no cliente, em `localStorage`). O usuário logado usa o carrinho da conta.
- **Merge no login/cadastro:** o `guestCartId` vai no corpo e o servidor soma as quantidades respeitando disponibilidade e limite por pedido. O cache do visitante é então descartado.
- Cada item guarda o **preço de referência** do momento da inclusão. A **cotação** (`POST /quotes`) compara esse preço com o atual e marca `PRICE_CHANGED`, `INSUFFICIENT_AVAILABILITY` ou `SOLD_OUT`. Enquanto houver pendência, o checkout fica bloqueado até o usuário **aceitar os novos valores** (`/cart/acknowledge`).
- Subtotal, desconto, taxa e total exibidos são **sempre os da cotação da API**. No cliente, a aritmética ETH (exibição e totais por linha) usa BigInt em wei (`lib/eth.ts`), sem `number`.
- Depois da confirmação, o servidor remove **apenas os itens e quantidades comprados**. Uma recusa preserva tudo e libera a reserva de estoque.

## 6. Estratégia de cache (TanStack Query)

| Aspecto | Política |
| --- | --- |
| Chaves | Públicas: `['nfts', 'list', params]`, `['nfts', 'detail', id]`, `['highlights']`. Privadas: sempre sob `['user', userId, …]`. Carrinho: `['cart', owner]`. Cotação: `['quote', owner, network, cartVersion]` |
| `staleTime` | 30 s (padrão); destaques 5 min; carrinho 10 s; cotação 0 |
| Retries | Queries: até 2 retries só para falhas transitórias (rede, timeout, 5xx), com backoff de 400 ms → 1,6 s. 4xx nunca são repetidos. Mutations: **sem retry automático** |
| Respostas obsoletas | Cada consulta usa a própria chave e o `signal` do Query, que o Axios aborta. Uma resposta antiga nunca sobrescreve outra chave (testado com `out-of-order`) |
| Paginação | `placeholderData: keepPreviousData` mantém a página anterior esmaecida durante a troca, sem layout shift |
| Invalidação | Mutations de carrinho gravam a resposta no cache e invalidam a cotação. Um `nft.updated` que afeta o carrinho invalida carrinho e cotação. Um `order.updated` confirmado invalida carrinho, cotação e pedidos |
| Otimismo | Favoritos: atualização otimista com snapshot e **rollback** em falha, mais aviso acessível |
| Pedido | `refetchInterval` de 5 s **apenas** enquanto o pedido está pendente, como rede de segurança caso um evento se perca |

## 7. Reconciliação REST ↔ Socket.IO

1. Eventos aplicam patches no cache respeitando `version`.
2. **Reconexão:** quando o socket reconecta, todas as queries **ativas** são revalidadas via REST (`invalidateQueries({ refetchType: 'active' })`). Assim, mudanças perdidas durante a queda são recuperadas. O teste cobre uma alteração feita sem evento, durante a desconexão.
3. **Pedido pendente:** sobrevive ao refresh e à reconexão. A página do pedido reconsulta a API, o checkout mostra o aviso "pedido em processamento" e bloqueia uma nova compra. A liquidação simulada é retomada no boot (`resumeSettlements`).
4. **Checkout:** antes de abrir a revisão, a cotação é **refeita**. Se o `fingerprint` mudou ou há pendências, o usuário precisa confirmar de novo. No envio, o servidor recalcula e responde `409 QUOTE_STALE` com a nova cotação se algo mudou. Um evento que chega com a revisão aberta também invalida a confirmação.
5. **Timeout no envio:** o cliente reenvia até 3 vezes com a **mesma** `Idempotency-Key` e recupera o mesmo pedido. A chave da tentativa fica em `sessionStorage` e sobrevive ao refresh.

## 8. Mocks (MSW)

- `src/mocks/fixtures.ts`: 48 NFTs determinísticos (os 9 do layout mais 39 gerados por seed), 9 coleções, 3 redes, 4 edições por NFT (a edição 1/1 está esgotada em 1 de cada 3 NFTs), 2 usuários e cupons.
- `src/mocks/db.ts`: estado único e consistente entre catálogo, favoritos, carrinhos, perfil, carteiras, cotações e pedidos, persistido em `localStorage` (`kurio.mock.db.v1`). O reset restaura as fixtures.
- Toda mudança de preço ou estoque (eventos manuais, reserva e liberação de pedidos, cenários) passa por `emitNftUpdated`. Assim, a resposta REST e o evento refletem o mesmo estado.
- `tough-cookie` é substituído por um stub no build (`src/mocks/vendor/tough-cookie-stub.ts`). A API simulada usa token Bearer e não usa cookies, e isso tira cerca de 190 KB de código do bundle dos mocks.

## 9. Acessibilidade

- Link "Pular para o conteúdo". O foco vai para o `<main>` a cada navegação. A região `aria-live` global anuncia mutations e alterações em tempo real.
- Diálogos e drawers (Radix/shadcn) prendem o foco, fecham com Esc e devolvem o foco ao gatilho. O login e o cadastro são diálogos sobre a Home no desktop (como no Figma) e tela cheia no mobile.
- Campos com `<label>`, asterisco de obrigatório (com `aria-required`), `aria-invalid` e erro ligado por `aria-describedby`. Ao falhar a validação, o foco vai para o primeiro campo inválido. Erros da API (422/409) aparecem no campo correspondente.
- Estados não dependem só de cor: edição esgotada aparece riscada e com texto, o pedido tem estados textuais e o status da carteira tem texto.
- Ajustes em relação ao layout: os indicadores dos carrosséis (pontos de 10–12 px no Figma) ganharam **área de toque de 24 px** com o mesmo visual. A ordenação usa `<select>` nativo estilizado. Ações sem rótulo visível (ícones) têm `aria-label`.
- Sem overflow horizontal em 390, 768 e 1440 px (testado). Respeita `prefers-reduced-motion`: o shimmer e as transições são desligados.

## 10. Performance e Lighthouse

Configuração versionada em `lighthouse/run.mjs`: build de produção servido por `vite preview`, cenário padrão dos mocks, 3 execuções por página e perfil com navegador limpo e **mediana**. Resultados em [`lighthouse/SUMMARY.md`](lighthouse/SUMMARY.md) e `lighthouse/summary.json` (versões e ambiente) e relatórios HTML/JSON em `lighthouse/reports/`.

| Página / perfil | Perf. | A11y | BP | SEO | LCP | CLS | TBT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início — mobile | 85 | 100 | 100 | 100 | 3.10 s | 0.000 | 352 ms |
| Início — desktop | 99 | 100 | 100 | 100 | 0.99 s | 0.019 | 0 ms |
| Detalhe — mobile | 85 | 100 | 100 | 100 | 3.33 s | 0.000 | 331 ms |
| Detalhe — desktop | 99 | 100 | 100 | 100 | 0.97 s | 0.005 | 2 ms |

Lighthouse 13.6.0, Chrome Headless 156, Node 22.23, Windows 10, Xeon E5-2667 v4 (16 núcleos), 17 GB.

**Otimizações aplicadas:**
- artes em WebP com `srcset`/`sizes` (160–960 px);
- preload da imagem LCP e das 3 fontes (Roboto Mono auto-hospedada);
- CSS embutido no HTML;
- rotas com code-splitting;
- menu do usuário, Mock Lab e formulários (zod) carregados sob demanda;
- stub do `tough-cookie`, que reduziu o chunk dos mocks de 175 para 53 KB gzip;
- `min-height` no `<main>`, que zerou o CLS do detalhe (era 0,176).

**Por que o Performance mobile (85) fica abaixo de 90:**

1. **API simulada no caminho crítico.** Antes do primeiro render, o navegador baixa e avalia o MSW, registra e ativa o service worker e semeia o banco. Isso só existe porque o backend roda dentro do navegador. Com CPU 4x mais lenta, esse trecho custa cerca de 650 ms de scripting (o maior item do TBT).
2. **LCP depende de dados.** A imagem LCP no mobile é o primeiro card do catálogo, que só renderiza depois da resposta de `/api/nfts`, com a latência realista de 120–350 ms do cenário padrão mais a ida e volta pelo service worker. O "element render delay" é cerca de 0,9 s do LCP.
3. **JS de framework.** React DOM, TanStack Router/Query, Radix (diálogos e drawer de filtros) e `socket.io-client` somam cerca de 120 KB gzip no chunk inicial.

Com um backend real, o item 1 desaparece e o 2 cai para a latência da rede. Não foram feitas simplificações exclusivas para a auditoria: ela carrega as mesmas imagens, fontes, mocks e tempo real da entrega.

## 11. Fidelidade ao Figma, assets e desvios

- **Assets:** as 4 artes e o ícone "Thank you" foram exportados do arquivo Figma pela API (originais em `design/source`, variantes WebP geradas por `npm run images`). Os frames de referência estão em `design/figma-frames`. A fonte Roboto Mono vem de `@fontsource` (local, sem CDN).
- **Substituições:** os ícones de interface usam `lucide-react`. Os ícones de redes sociais, Google e Facebook são SVGs simplificados próprios, porque o lucide não inclui marcas. O favicon é próprio.
- **Desvios intencionais:**
  - O formulário de pagamento do desktop tem campos duplicados com a seleção de carteira ("Tipo de carteira" e a lista de carteiras). Os dois ficam sincronizados no mesmo estado.
  - O "Endereço da carteira" é somente leitura e vem da carteira selecionada, para evitar pagar com um endereço não cadastrado.
  - No **Pagamento mobile**, o formulário do colecionador aparece antes da escolha de carteira. O frame mobile não mostra os campos, mas eles são obrigatórios para validar o pedido.
  - Nos grids de 768 px (tablet), não desenhados, detalhe, carrinho e pagamento passam a ter uma coluna até 1024 px, para não haver overflow.
  - A confirmação do pedido é uma página (`/pedidos/:id`) com o visual do modal do Figma. Assim ela tem URL própria e sobrevive ao refresh.
  - O botão "Ver no Etherscan" abre um **explorador simulado** interno (`/explorer/tx/:hash`), porque a transação não existe em rede real.
- **Minha coleção** (`/conta/colecao`): não é exigida pelo enunciado. Foi adicionada no lugar de "Atividade" no menu do perfil e lista os NFTs de pedidos confirmados, montados a partir do snapshot de cada pedido, junto com o histórico de pedidos e o link para cada recibo.
- **Estados não desenhados** (skeletons, erro, vazio, pendente, recusado, avisos de preço, expiração de sessão) seguem a mesma paleta, tipografia e cantos do layout.

## 12. Fora de escopo e limitações

- **Funções fora de escopo** (Criadores, Aprenda, Ofertas, Downloads, Suporte, ajuda, editorial, newsletter, login social, recuperar senha, leitor de QR) informam que não estão disponíveis na demonstração e nunca simulam sucesso. Os links de redes sociais abrem em nova aba.
- **Cada aba tem o próprio servidor simulado.** O estado é compartilhado via `localStorage` só ao recarregar.
- Avaliações individuais de NFTs não são listadas; só a nota média.
- As baselines visuais foram geradas em Windows. Em outro sistema operacional, regere uma vez com `npm run test:e2e:update`.

## 13. Decisões de UX

- Busca com debounce de 400 ms. Cada busca, filtro, ordenação e página gera uma entrada no histórico e sobrevive ao refresh. Parâmetros inválidos na URL voltam ao padrão.
- **COMPRAR** adiciona ao carrinho e vai para ele. O carrinho do card adiciona a edição 1/50 sem sair da página.
- A quantidade máxima no detalhe considera o que já está no carrinho.
- O checkout exige três passos explícitos: **conectar a carteira**, **revisar** e **confirmar e pagar**. Uma mudança de valores em qualquer momento exige nova confirmação.
- A sessão expirada no meio do checkout leva ao login e devolve à mesma tela com o rascunho preenchido.

## 14. Segurança

Coberto pelos testes em `e2e/14-security.spec.ts`.

| Área | Medida |
| --- | --- |
| Senhas | PBKDF2-SHA256 com 210.000 iterações (OWASP) e salt aleatório de 16 bytes por usuário. Comparação em tempo constante. As contas de demonstração ficam nas fixtures **só como hash**, e a senha fictícia aparece apenas no README |
| Login | Mensagem genérica ("e-mail ou senha incorretos"). Um hash é calculado mesmo para e-mail inexistente, para que o tempo de resposta não revele contas. **Bloqueio de 10 min após 5 falhas** por e-mail (`429 RATE_LIMITED`) |
| Sessão | Token aleatório opaco. Expiração deslizante de 30 min e **duração máxima absoluta de 12 h**. O logout invalida o token no servidor e encerra as conexões Socket.IO do usuário. A troca de senha encerra as outras sessões |
| Autorização | Rotas privadas protegidas no router e na API (`401`). Pedido de outro usuário responde `403`. Carrinho e favoritos isolados por usuário no servidor e no cache. Eventos `order.updated` são entregues e aceitos só para o dono |
| Validação | Validação no cliente (zod) **e** no servidor, incluindo limites de tamanho de todos os campos de texto (`assertMaxLengths`), formatos (e-mail, endereço `0x`, ENS, códigos), inteiros positivos e avatar (só PNG/JPEG/WebP, até 1 MB) |
| Integridade da compra | O preço nunca vem do cliente: o pedido referencia a cotação do servidor (`quoteId` + `fingerprint`), que é recalculada no envio. A chave de idempotência evita compra duplicada |
| XSS | O React escapa todo conteúdo. Não há `dangerouslySetInnerHTML`, `eval` nem `innerHTML`. A **CSP** permite scripts só da própria origem |
| Redirecionamento | O `redirect` pós-login aceita apenas caminhos internos. Bloqueia `//host`, `/\host`, URLs absolutas e caracteres de controle |
| Cabeçalhos (Vercel e `vite preview`) | `Content-Security-Policy` (sem scripts inline ou externos, `frame-ancestors 'none'`, `object-src 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` e HSTS (Vercel) |
| Links externos | `target="_blank"` sempre com `rel="noopener noreferrer"` |
| Dependências | `npm audit --omit=dev`: **0 vulnerabilidades** no que vai para o navegador. Os avisos restantes são de ferramentas de desenvolvimento (Lighthouse, CLI do shadcn) que não entram no build |
| Segredos | Nenhum segredo no repositório nem no histórico. O `.env` só tem URLs públicas. Source maps desativados em produção |

**Limites desta demonstração.** Toda a "segurança de servidor" acima é **simulada no navegador** (MSW): demonstra o contrato e o comportamento esperados, mas não protege dados reais. Quem tem acesso ao navegador pode ler o banco simulado em `localStorage` e usar `window.__kurioMock`, que fica ativo só com `VITE_ENABLE_MOCKS=true`. Num backend real:

- o token iria num cookie `HttpOnly` + `Secure` + `SameSite`, com proteção CSRF, em vez de `localStorage`;
- o hash de senha seria Argon2id no servidor;
- a limitação de tentativas seria feita por IP e por conta no servidor;
- a troca de e-mail exigiria confirmação da senha atual.
