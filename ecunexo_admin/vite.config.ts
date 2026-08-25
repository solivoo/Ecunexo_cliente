import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Playwright E2E apunta aquí. strictPort evita caer en otra SPA si 5173 está ocupado.
    port: 5173,
    strictPort: true,
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
