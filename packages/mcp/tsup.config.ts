import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node18',
  splitting: false,
  noExternal: ['@groowooth/core']
})
