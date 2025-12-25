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
  // Pre-bundle SSR dependencies to avoid mid-session optimization errors
  ssr: {
    optimizeDeps: {
      include: [
        // Utility libraries
        'clsx',
        'tailwind-merge',
        'class-variance-authority',
        // Radix UI components (all installed packages)
        '@radix-ui/react-avatar',
        '@radix-ui/react-checkbox',
        '@radix-ui/react-collapsible',
        '@radix-ui/react-dialog',
        '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-label',
        '@radix-ui/react-popover',
        '@radix-ui/react-scroll-area',
        '@radix-ui/react-select',
        '@radix-ui/react-separator',
        '@radix-ui/react-slot',
        '@radix-ui/react-tabs',
        '@radix-ui/react-tooltip',
      ],
    },
  },
})

export default config
