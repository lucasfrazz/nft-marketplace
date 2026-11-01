# Lighthouse — resultados (mediana de 3 execuções)

Gerado em 2026-11-01T17:08:51.313Z · Lighthouse 13.6.0 · Node v22.23.2

Ambiente: Windows_NT 10.0.19045 (x64), Intel(R) Xeon(R) CPU E5-2667 v4 @ 3.20GHz (16 núcleos), 17 GB RAM.

Build de produção (vite build) servido localmente por vite preview; mocks MSW ativos no cenário padrão (latência realista 120–350ms, seed 42); perfil de navegador limpo por execução; throttling padrão do Lighthouse (mobile: 4G lento simulado + CPU 4x; desktop: preset desktop).

| Página / perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| inicio-mobile | 85 | 100 | 100 | 100 | 3.10 s | 0.000 | 352 ms |
| inicio-desktop | 99 | 100 | 100 | 100 | 0.99 s | 0.019 | 0 ms |
| detalhe-mobile | 85 | 100 | 100 | 100 | 3.33 s | 0.000 | 331 ms |
| detalhe-desktop | 99 | 100 | 100 | 100 | 0.97 s | 0.005 | 2 ms |

## Análise: Performance mobile abaixo de 90

A meta de Performance (≥ 90) foi atingida no **desktop (99)**. No **mobile a mediana é 85**, com LCP de cerca de 3,1–3,3 s e TBT de cerca de 330–350 ms no perfil padrão do Lighthouse (4G lento simulado + CPU 4x mais lenta). Accessibility, Best Practices e SEO estão em 100 nos quatro cenários.

### Causas identificadas

1. **A API simulada roda no navegador, antes da aplicação.** O MSW e o banco simulado precisam baixar, executar e registrar o service worker antes do primeiro render. Com a CPU 4x mais lenta, isso custa cerca de 650 ms de execução de script, o maior item do TBT. Com um backend real, esse custo não existiria.
2. **O LCP depende de dados.** O elemento LCP no mobile é a imagem do 1º card do catálogo, que só aparece depois da resposta de `/api/nfts`. A latência simulada do cenário padrão (120–350 ms) mais a ida e volta pelo service worker formam a maior parte do LCP: o "element render delay" é de cerca de 0,9 s. A imagem em si já chega pré-carregada.
3. **JavaScript de framework.** React DOM, TanStack Router/Query, Radix e socket.io-client somam cerca de 120 KB gzip no carregamento inicial.

### Otimizações já aplicadas

- Imagens WebP responsivas (160–960 px) e preload da imagem LCP.
- Preload das fontes (auto-hospedadas) e CSS embutido no HTML.
- Code splitting por rota, com menu do usuário, Mock Lab e formulários carregados sob demanda.
- Stub do `tough-cookie` do MSW, que reduziu o chunk dos mocks de 175 KB para 53 KB gzip.
- `min-height` no conteúdo principal, que zerou o CLS do detalhe (era 0,176).

Evolução da Performance mobile: **77 → 85** (início) e **81 → 85** (detalhe).

A auditoria carrega as mesmas imagens, fontes, mocks e tempo real da entrega, sem simplificações feitas só para melhorar a pontuação.
