import { defineConfig } from 'vitest/config'
import path from 'node:path'

const raiz = import.meta.dirname

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(raiz, './src'),
    },
  },
})
