import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

/**
 * E2E contra o build de demonstração (mocks MSW ativos).
 * - Cada teste roda em um contexto novo (localStorage vazio → banco simulado
 *   reiniciado a partir das fixtures).
 * - Fluxos principais (@main) rodam em desktop e mobile.
 * - Regressão visual (@visual) com baselines versionadas em e2e/__screenshots__/<so>/.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled', caret: 'hide', scale: 'css' },
  },
  // Baselines visuais por sistema operacional: a renderização de fontes difere entre
  // Windows, Linux e macOS. Fora do CI, a 1ª execução num SO novo cria as baselines dele.
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{projectName}/{testFilePath}/{arg}{ext}',
  updateSnapshots: process.env.CI ? 'none' : 'missing',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      grep: /@main|@visual/,
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
})
