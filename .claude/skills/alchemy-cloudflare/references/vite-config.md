# Vite Configuration for Alchemy + TanStack Start

Complete example of `app.config.ts` for TanStack Start with Alchemy Cloudflare.

## Full Configuration

```typescript
import { defineConfig } from "@tanstack/react-start/config"
import viteTsConfigPaths from "vite-tsconfig-paths"
import { alchemy } from "alchemy/cloudflare/tanstack-start"

export default defineConfig({
  // TanStack Start options
  server: {
    preset: "cloudflare-module",
  },
  
  vite: {
    plugins: [
      // CRITICAL: Alchemy MUST be first plugin
      alchemy(),
      viteTsConfigPaths({ root: "./" }),
      // Other plugins after...
    ],
    
    build: {
      // Required for Cloudflare Workers
      target: "esnext",
      
      rollupOptions: {
        // CRITICAL: Must externalize these
        external: [
          "node:async_hooks",
          "cloudflare:workers",
        ],
      },
    },
    
    // Optional: silence warnings
    optimizeDeps: {
      exclude: ["cloudflare:workers"],
    },
  },
})
```

## Plugin Order Matters

The Alchemy plugin intercepts the build to:
1. Inject Cloudflare environment types
2. Configure Workers-compatible output
3. Handle binding emulation in dev

If not first, other plugins may interfere with these transformations.

## Common Additional Plugins

```typescript
import tailwindcss from "@tailwindcss/vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"

plugins: [
  alchemy(),                    // 1. Always first
  viteTsConfigPaths({ root: "./" }),  // 2. Path resolution
  TanStackRouterVite(),         // 3. Route generation
  tailwindcss(),                // 4. CSS processing
]
```

## Environment Variables in Vite

For client-side env vars, use standard Vite patterns:

```typescript
define: {
  "import.meta.env.PUBLIC_APP_URL": JSON.stringify(process.env.PUBLIC_APP_URL),
}
```

Server-side vars go through Alchemy's `vars` and `secretTextBindings`.
