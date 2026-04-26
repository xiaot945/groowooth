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
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          const norm = id.replace(/\\/g, '/')

          if (norm.includes('/packages/core/src/standards/who-2006')) {
            return 'who-2006'
          }

          if (norm.includes('/packages/core/src/standards/who-2007')) {
            return 'who-2007'
          }

          if (norm.includes('/packages/core/src/standards/nhc-2022')) {
            return 'nhc-2022'
          }

          if (
            norm.includes('/node_modules/react/') ||
            norm.includes('/node_modules/react-dom/') ||
            norm.includes('/node_modules/scheduler/')
          ) {
            return 'react-vendor'
          }
        }
      }
    }
  }
})
