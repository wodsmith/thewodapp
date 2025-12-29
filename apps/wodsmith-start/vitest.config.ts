import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import {defineConfig} from 'vitest/config'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    name: 'wodsmith-start',
    environment: 'jsdom',
    globals: true,
    pool: 'vmThreads',
    mockReset: true,
    restoreMocks: true,
    setupFiles: ['./test/setup.ts'],
    include: [
      './test/**/*.test.ts',
      './test/**/*.test.tsx',
      './src/**/*.test.ts',
      './src/**/*.test.tsx',
    ],
    exclude: ['**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      enabled: false,
      exclude: [
        '**/node_modules/**',
        '**/test/**',
        '**/*.{test,spec}.{ts,tsx}',
      ],
    },
  },
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      'server-only': resolve(__dirname, './test/__mocks__/server-only.js'),
      'cloudflare:workers': resolve(
        __dirname,
        './test/__mocks__/cloudflare-workers.js',
      ),
      '@': resolve(__dirname, './src'),
    },
  },
})
