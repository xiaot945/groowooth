import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      devOptions: { enabled: false },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'groowooth — 儿童成长曲线',
        short_name: 'groowooth',
        description: '开源儿童成长曲线工具，支持 WHO + 中国卫健委标准',
        theme_color: '#4D8DB1',
        background_color: '#F3F8F5',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'zh-CN',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,ico,webmanifest}'],
        globIgnores: ['assets/who-2006-*.js', 'assets/who-2007-*.js', 'assets/nhc-2022-*.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/assets/who-2006') ||
              url.pathname.startsWith('/assets/who-2007') ||
              url.pathname.startsWith('/assets/nhc-2022'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'groowooth-standards',
              expiration: { maxEntries: 6, maxAgeSeconds: 60 * 60 * 24 * 180 }
            }
          }
        ]
      }
    })
  ],
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
