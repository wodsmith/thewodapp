# Complete alchemy.run.ts Example

Full infrastructure definition for TanStack Start + PlanetScale + KV + custom domains.

## Production-Ready Example

```typescript
import alchemy from "alchemy"
import {
  KVNamespace,
  TanStackStart
} from "alchemy/cloudflare"

// Initialize Alchemy app
const app = await alchemy("wodsmith-start", {
  stage: process.env.STAGE ?? "dev",
  phase: process.argv.includes("--destroy") ? "destroy" : "up",
})

// KV for session storage
const sessions = await KVNamespace("sessions")

// Cache KV
const cache = await KVNamespace("cache")

// Main TanStack Start worker
const worker = await TanStackStart("wodsmith-worker", {
  // KV bindings
  kvNamespaces: {
    SESSIONS: sessions,
    CACHE: cache,
  },

  // Public environment variables
  vars: {
    PUBLIC_APP_URL: process.env.PUBLIC_APP_URL ?? "http://localhost:3000",
    PUBLIC_POSTHOG_KEY: process.env.PUBLIC_POSTHOG_KEY ?? "",
    DATABASE_URL: process.env.DATABASE_URL!, // PlanetScale connection
  },

  // Encrypted secrets
  secretTextBindings: {
    AUTH_SECRET: alchemy.secret(process.env.AUTH_SECRET!),
    STRIPE_SECRET_KEY: alchemy.secret(process.env.STRIPE_SECRET_KEY!),
    RESEND_API_KEY: alchemy.secret(process.env.RESEND_API_KEY!),
  },

  // Custom domains (production only)
  domains: process.env.STAGE === "prod"
    ? ["wodsmith.com", "www.wodsmith.com"]
    : undefined,

  // Compatibility flags (if needed)
  compatibilityFlags: ["nodejs_compat"],
})

// Export Env type for use in app
export type Env = typeof worker.Env

// Finalize deployment
await app.finalize()
```

## Stage-Based Configuration

```typescript
const stage = process.env.STAGE ?? "dev"
const isProd = stage === "prod"

// Stage-specific domains
const domains = isProd
  ? ["app.com", "www.app.com"]
  : stage === "staging"
    ? ["staging.app.com"]
    : undefined  // dev uses workers.dev subdomain
```

## Type Exports

The `Env` type export is crucial for type-safe access to bindings:

```typescript
// alchemy.run.ts
export type Env = typeof worker.Env

// app/server/context.ts
import type { Env } from "../../alchemy.run"

declare global {
  interface CloudflareEnv extends Env {}
}
```

## CLI Commands

```bash
# Deploy to dev (default)
bun alchemy.run.ts

# Deploy to production
STAGE=prod bun alchemy.run.ts

# Deploy to staging
STAGE=staging bun alchemy.run.ts

# Destroy resources
bun alchemy.run.ts --destroy

# Destroy specific stage
STAGE=staging bun alchemy.run.ts --destroy
```

## State Management

Alchemy stores state in `.alchemy/{app}/{stage}/`:
- `state.json` - Resource state

**Important**: Add to `.gitignore`:
```
.alchemy/
```

The state is local to your machine. In CI, you'd typically:
1. Use cloud state backend (if available)
2. Or destroy/recreate on each deploy
