/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test'
import { loadLocalEnv } from './tests-ui/helpers/loadLocalEnv'

loadLocalEnv()

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'

export default defineConfig({
  testDir: './tests-ui',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: process.env.E2E_OPEN_REPORT === '1' ? 'always' : 'never' }],
  ],
  use: {
    baseURL,
    // El panel --ui pinta el preview con la traza. Sin 'on' queda about:blank.
    trace: process.env.CI ? 'on-first-retry' : 'on',
    screenshot: process.env.CI ? 'only-on-failure' : 'on',
    video: process.env.CI ? 'retain-on-failure' : 'on',
    locale: 'es-EC',
    launchOptions: {
      slowMo: process.env.E2E_SLOW_MO ? Number(process.env.E2E_SLOW_MO) : 0,
    },
  },
  webServer: {
    command: 'pnpm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
