---
name: alchemy-cloudflare
description: Alchemy IaC patterns for deploying TanStack Start apps to Cloudflare Workers with PlanetScale databases via Hyperdrive. Use when setting up new TanStack Start projects, configuring Alchemy deployments, working with PlanetScale/Drizzle migrations, local development with Cloudflare bindings, or deploying to custom domains.
---

# Alchemy Cloudflare IaC

TypeScript-first Infrastructure as Code for deploying TanStack Start applications to Cloudflare Workers.

## Core Concepts

- **alchemy.run.ts**: Infrastructure definition file (TypeScript, not YAML)
- **TanStackStart resource**: Wraps Worker config specifically for TanStack builds
- **Hyperdrive resource**: Provides pooled PlanetScale connections
- **Type inference**: `typeof worker.Env` provides types without codegen
- **Secrets**: `alchemy.secret()` encrypts values with `ALCHEMY_PASSWORD`

## Quick Start

### 1. Install Dependencies

```bash
pnpm add alchemy @cloudflare/workers-types
```

### 2. Create alchemy.run.ts

```typescript
import alchemy from "alchemy"
import { Hyperdrive, TanStackStart } from "alchemy/cloudflare"
import { Branch as PlanetScaleBranch, Password as PlanetScalePassword } from "alchemy/planetscale"

const app = await alchemy("my-app", {
  stage: process.env.STAGE ?? "dev",
  phase: process.argv.includes("--destroy") ? "destroy" : "up",
})

// PlanetScale branch + password + Hyperdrive connection pooling
const psBranch = await PlanetScaleBranch("ps-branch", {
  organization: "my-org",
  database: "my-db",
  name: "dev",
  parentBranch: "main",
})

const psPassword = await PlanetScalePassword("ps-password", {
  organization: "my-org",
  database: "my-db",
  branch: psBranch,
  role: "admin",
})

const hyperdrive = await Hyperdrive("hyperdrive", {
  origin: {
    host: psPassword.host,
    database: "my-db",
    user: psPassword.username,
    password: psPassword.password.unencrypted,
    port: 3306,
    scheme: "mysql",
  },
})

const worker = await TanStackStart("my-worker", {
  bindings: { HYPERDRIVE: hyperdrive },
  domains: ["my-app.com"],  // Custom domain
})

export type Env = typeof worker.Env

await app.finalize()
```

### 3. Configure Vite

**CRITICAL**: Alchemy plugin must be FIRST in plugins array.

```typescript
// app.config.ts
import { defineConfig } from "@tanstack/react-start/config"
import viteTsConfigPaths from "vite-tsconfig-paths"
import { alchemy } from "alchemy/cloudflare/tanstack-start"

export default defineConfig({
  vite: {
    plugins: [
      alchemy(),  // MUST be first
      viteTsConfigPaths({ root: "./" }),
    ],
    build: {
      target: "esnext",
      rollupOptions: {
        external: ["node:async_hooks", "cloudflare:workers"],
      },
    },
  },
})
```

### 4. Deploy

```bash
# Set encryption password (once)
export ALCHEMY_PASSWORD="your-secure-password"

# Deploy
bun alchemy.run.ts

# Deploy to specific stage
STAGE=prod bun alchemy.run.ts

# Destroy resources
bun alchemy.run.ts --destroy
```

## Local Development

```bash
# Run dev server with Cloudflare emulation
pnpm alchemy dev
```

**What this provides:**
- Direct PlanetScale connections via Hyperdrive dev mode
- KV, R2, Durable Objects bindings
- Same `Env` types as production

**Only required env var:**
```bash
ALCHEMY_PASSWORD=your-password
```

## PlanetScale + Drizzle Integration

### Migration Workflow

1. Modify schema in `src/db/schema.ts`
2. During development: `pnpm db:push` (pushes to PlanetScale dev branch)
3. Before merging: `pnpm db:generate --name=feature-name`
4. Deploy: Migrations are applied via `drizzle-kit push` in CI

### Accessing PlanetScale via Hyperdrive

```typescript
// In server functions or loaders
import { env } from 'cloudflare:workers'

const db = drizzle(env.HYPERDRIVE)
// Use db...
```

## Common Patterns

### Multiple Environments

```typescript
const stage = process.env.STAGE ?? "dev"

const app = await alchemy("my-app", { stage })

// Conditional resources
const domains = stage === "prod" 
  ? ["app.com", "www.app.com"]
  : [`${stage}.app.com`]

await TanStackStart("worker", { domains })
```

### Secrets Management

```typescript
// In alchemy.run.ts
const worker = await TanStackStart("worker", {
  vars: {
    PUBLIC_API_URL: "https://api.example.com",
  },
  secretTextBindings: {
    AUTH_SECRET: alchemy.secret(process.env.AUTH_SECRET!),
    STRIPE_KEY: alchemy.secret(process.env.STRIPE_KEY!),
  },
})
```

### KV Namespace

```typescript
import { KVNamespace, TanStackStart } from "alchemy/cloudflare"

const sessions = await KVNamespace("sessions")

await TanStackStart("worker", {
  kvNamespaces: { SESSIONS: sessions },
})
```

## Troubleshooting

### "cloudflare:workers" resolve error
Add to vite config:
```typescript
rollupOptions: {
  external: ["node:async_hooks", "cloudflare:workers"],
}
```

### "Route files should not import @/db"
Server functions must be in `src/server-fns/` files, not inline in route files. Routes can only import and call server functions.

### PlanetScale connection issues
Check that `PLANETSCALE_SERVICE_TOKEN_ID` and `PLANETSCALE_SERVICE_TOKEN` are set. Verify the branch exists in PlanetScale dashboard.

### Migration not applying
Use `pnpm db:push` for dev. For production, migrations are applied via `drizzle-kit push` in CI.

## References

- [references/vite-config.md](references/vite-config.md) - Complete Vite configuration example
- [references/alchemy-run.md](references/alchemy-run.md) - Full alchemy.run.ts example with all resources
