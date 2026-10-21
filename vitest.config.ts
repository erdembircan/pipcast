import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  tsconfig: 'tsconfig.json',
  resolve: {
    alias: {
      '@pipcast/contract': fileURLToPath(new URL('./plugin/src/contract/index.ts', import.meta.url)),
      '@pipcast/director': fileURLToPath(new URL('./packages/director/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['test/**/*.test.ts', 'packages/*/test/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
