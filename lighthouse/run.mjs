/**
 * Auditoria Lighthouse versionada.
 *
 * - Build otimizado (`npm run build`) servido por `vite preview` (porta 4174),
 *   com o cenário PADRÃO dos mocks (MSW ativo, latência realista).
 * - Páginas: início e detalhe do NFT. Perfis: mobile (padrão Lighthouse,
 *   Moto G Power + 4G lento simulado) e desktop (preset desktop).
 * - 3 medições por página/perfil, cada uma com perfil de navegador limpo;
 *   o relatório final usa a MEDIANA de cada categoria e métrica.
 *
 * Uso: npm run build && npm run lighthouse
 * Saída: lighthouse/reports/*.html|json, lighthouse/summary.json, lighthouse/SUMMARY.md
 */
import { spawn } from 'node:child_process'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import * as chromeLauncher from 'chrome-launcher'

const PORT = 4174
const BASE = `http://localhost:${PORT}`
const RUNS = Number(process.env.LH_RUNS ?? 3)
const OUT = path.resolve('lighthouse/reports')
const PAGES = [
  { id: 'inicio', path: '/' },
  { id: 'detalhe', path: '/nft/emerald-ape-042' },
]
const PROFILES = [
  { id: 'mobile', config: undefined },
  { id: 'desktop', config: desktopConfig },
]
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']
const METRICS = { LCP: 'largest-contentful-paint', CLS: 'cumulative-layout-shift', TBT: 'total-blocking-time', FCP: 'first-contentful-paint', SI: 'speed-index' }

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

async function waitFor(url, ms = 30_000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`Servidor não respondeu em ${url}`)
}

const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32' })
const results = {}
try {
  await waitFor(BASE)
  await mkdir(OUT, { recursive: true })
  for (const page of PAGES) {
    for (const profile of PROFILES) {
      const key = `${page.id}-${profile.id}`
      results[key] = []
      for (let run = 1; run <= RUNS; run++) {
        const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-first-run', '--disable-extensions'] })
        try {
          const r = await lighthouse(`${BASE}${page.path}`, { port: chrome.port, output: ['html', 'json'], logLevel: 'error' }, profile.config)
          const [html, json] = r.report
          await writeFile(path.join(OUT, `${key}-${run}.html`), html)
          await writeFile(path.join(OUT, `${key}-${run}.json`), json)
          const lhr = r.lhr
          const entry = {
            run,
            scores: Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)])),
            metrics: Object.fromEntries(Object.entries(METRICS).map(([k, id]) => [k, lhr.audits[id]?.numericValue ?? null])),
            lighthouseVersion: lhr.lighthouseVersion,
            userAgent: lhr.environment.hostUserAgent,
            benchmarkIndex: lhr.environment.benchmarkIndex,
          }
          results[key].push(entry)
          console.log(key, `#${run}`, JSON.stringify(entry.scores), `LCP=${Math.round(entry.metrics.LCP)}ms CLS=${entry.metrics.CLS?.toFixed(3)} TBT=${Math.round(entry.metrics.TBT)}ms`)
        } finally {
          await chrome.kill()
        }
      }
    }
  }
} finally {
  server.kill()
}

const pkg = JSON.parse(await readFile('package.json', 'utf8'))
const summary = {
  generatedAt: new Date().toISOString(),
  runsPerPageProfile: RUNS,
  tools: {
    lighthouse: Object.values(results)[0]?.[0]?.lighthouseVersion,
    node: process.version,
    chrome: Object.values(results)[0]?.[0]?.userAgent,
    vite: pkg.devDependencies.vite,
  },
  environment: { os: `${os.type()} ${os.release()} (${os.arch()})`, cpus: os.cpus()[0]?.model, cpuCount: os.cpus().length, memoryGb: Math.round(os.totalmem() / 1e9) },
  conditions: 'Build de produção (vite build) servido localmente por vite preview; mocks MSW ativos no cenário padrão (latência realista 120–350ms, seed 42); perfil de navegador limpo por execução; throttling padrão do Lighthouse (mobile: 4G lento simulado + CPU 4x; desktop: preset desktop).',
  medians: Object.fromEntries(
    Object.entries(results).map(([key, runs]) => [
      key,
      {
        scores: Object.fromEntries(CATEGORIES.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
        metrics: Object.fromEntries(Object.keys(METRICS).map((m) => [m, median(runs.map((r) => r.metrics[m]))])),
      },
    ]),
  ),
  runs: results,
}
await writeFile('lighthouse/summary.json', JSON.stringify(summary, null, 2))

const fmt = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(2)} s`)
let md = `# Lighthouse — resultados (mediana de ${RUNS} execuções)\n\nGerado em ${summary.generatedAt} · Lighthouse ${summary.tools.lighthouse} · Node ${summary.tools.node}\n\n`
md += `Ambiente: ${summary.environment.os}, ${summary.environment.cpus} (${summary.environment.cpuCount} núcleos), ${summary.environment.memoryGb} GB RAM.\n\n${summary.conditions}\n\n`
md += '| Página / perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n'
for (const [key, m] of Object.entries(summary.medians)) {
  md += `| ${key} | ${m.scores.performance} | ${m.scores.accessibility} | ${m.scores['best-practices']} | ${m.scores.seo} | ${fmt(m.metrics.LCP)} | ${m.metrics.CLS?.toFixed(3)} | ${Math.round(m.metrics.TBT)} ms |\n`
}
await writeFile('lighthouse/SUMMARY.md', md)
console.log('\n' + md)
