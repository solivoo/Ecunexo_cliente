import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'child_process'
import pkg from './package.json'

function getGitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

function getGitBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD').toString().trim()
  } catch {
    return 'main'
  }
}

function getBuildTime(): string {
  try {
    return new Date().toISOString()
  } catch {
    return ''
  }
}

const gitCommit = getGitCommit()
const gitBranch = getGitBranch()
const buildTime = getBuildTime()
const appVersion = pkg.version || '0.1.0'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __GIT_COMMIT__: JSON.stringify(gitCommit),
    __GIT_BRANCH__: JSON.stringify(gitBranch),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  server: {
    // Playwright E2E apunta aquí. strictPort evita caer en otra SPA si 5173 está ocupado.
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: process.env.VITE_USE_POLLING === 'true',
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
    },
  },
  resolve: {
    alias: [
      { find: '@layout', replacement: path.resolve(__dirname, './src/layout') },
      { find: '@pages', replacement: path.resolve(__dirname, './src/pages') },
      { find: '@assets', replacement: path.resolve(__dirname, './src/assets') },
      { find: /^@\//, replacement: `${path.resolve(__dirname, './src')}/` },
    ],
  },
})
