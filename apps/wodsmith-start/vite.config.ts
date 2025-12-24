import {defineConfig} from 'vite'
import {devtools} from '@tanstack/devtools-vite'
import {tanstackStart} from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import {cloudflare} from '@cloudflare/vite-plugin'

const config = defineConfig({
  plugins: [
    devtools(),
    cloudflare({viteEnvironment: {name: 'ssr'}}),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  // Resolve server-only as empty module (Next.js specific, not needed in TanStack Start)
  resolve: {
    alias: {
      'server-only': new URL('./src/lib/server-only-stub.ts', import.meta.url)
        .pathname,
    },
  },
})

export default config
