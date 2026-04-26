import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@groowooth/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url))
    }
  },
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist'
  }
})
