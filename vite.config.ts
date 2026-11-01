import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { readFileSync } from 'node:fs'

// Os mesmos cabeçalhos de segurança do deploy (vercel.json) valem no `vite preview`,
// para que os testes E2E rodem com a CSP de produção.
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] }
const securityHeaders = Object.fromEntries(vercel.headers.find((h) => h.source === '/(.*)')!.headers.map((h) => [h.key, h.value]))

/**
 * Embute o CSS (Tailwind, ~16 KB) no HTML de produção, removendo uma
 * requisição bloqueante de renderização do caminho crítico.
 */
function inlineCss(): Plugin {
  return {
    name: 'kurio:inline-css',
    apply: 'build',
    enforce: 'post',
    generateBundle(_opts, bundle) {
      const html = bundle['index.html']
      if (!html || html.type !== 'asset') return
      let source = String(html.source)
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type !== 'asset' || !name.endsWith('.css')) continue
        const tag = new RegExp(`<link rel="stylesheet"[^>]*href="/${name.replace(/[.]/g, '\.')}"[^>]*>`)
        if (!tag.test(source)) continue
        source = source.replace(tag, () => `<style>${String(file.source)}</style>`)
        delete bundle[name]
      }
      // Preload das fontes (Roboto Mono 400/500/700): ficam prontas antes do 1º render.
      const fonts = Object.keys(bundle).filter((n) => /roboto-mono-latin-(400|500|700)-normal-.*\.woff2$/.test(n))
      const links = fonts.map((n) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="/${n}">`).join('')
      source = source.replace('</title>', `</title>${links}`)
      html.source = source
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), inlineCss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      // A API simulada não usa cookies: stub sem efeito para o cookie store do MSW (ver arquivo).
      'tough-cookie': path.resolve(import.meta.dirname, 'src/mocks/vendor/tough-cookie-stub.ts'),
    },
  },
  server: { port: 5173 },
  preview: { port: 4173, headers: securityHeaders },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
})
