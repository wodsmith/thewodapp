# Complete alchemy.run.ts Example

Full infrastructure definition for TanStack Start + PlanetScale/Hyperdrive + KV + custom domains.

## Production-Ready Example

```typescript
import alchemy from "alchemy"
import {
  Hyperdrive,
  KVNamespace,
  R2Bucket,
  TanStackStart,
} from "alchemy/cloudflare"
import {
  Branch as PlanetScaleBranch,
  Password as PlanetScalePassword,
} from "alchemy/planetscale"

// Initialize Alchemy app
const stage = process.env.STAGE ?? "dev"

const app = await alchemy("wodsmith", {
  stage,
  phase: process.argv.includes("--destroy") ? "destroy" : "up",
})

// PlanetScale branch (dev branches off main)
const psBranch = await PlanetScaleBranch("ps-branch", {
  organization: "wodsmith",
  database: "wodsmith-db",
  name: "dev",
  parentBranch: "main",
  adopt: true,
})

// PlanetScale password for the branch
const psPassword = await PlanetScalePassword("ps-password", {
  organization: "wodsmith",
  database: "wodsmith-db",
  branch: psBranch,
  role: "admin",
})

// Hyperdrive for connection pooling
const hyperdrive = await Hyperdrive("hyperdrive", {
  origin: {
    host: psPassword.host,
    database: "wodsmith-db",
    user: psPassword.username,
    password: psPassword.password.unencrypted,
    port: 3306,
    scheme: "mysql",
  },
  caching: { disabled: true },
  adopt: true,
  dev: {
    origin: `mysql://${psPassword.username}:${psPassword.password.unencrypted}@${psPassword.host}:3306/wodsmith-db?sslaccept=strict`,
  },
})

// KV for session storage
const sessions = await KVNamespace("wodsmith-sessions", { adopt: true })

// R2 for file uploads
const r2Bucket = await R2Bucket("wodsmith-uploads", { adopt: true })

// Main TanStack Start worker
const worker = await TanStackStart("app", {
  bindings: {
    HYPERDRIVE: hyperdrive,
    KV_SESSION: sessions,
    R2_BUCKET: r2Bucket,
    APP_URL: process.env.APP_URL!,
    RESEND_API_KEY: alchemy.secret(process.env.RESEND_API_KEY!),
    STRIPE_SECRET_KEY: alchemy.secret(process.env.STRIPE_SECRET_KEY!),
  },
  domains: stage === "prod" ? ["wodsmith.com"] : undefined,
  adopt: true,
})

export type Env = typeof worker.Env

await app.finalize()
```

## Stage-Based Configuration

```typescript
const stage = process.env.STAGE ?? "dev"

// Branch hierarchy:
// prod  → "main" (production branch)
// dev   → branches off main
// demo  → branches off main
// pr-N  → uses "dev" branch directly

const psBranchName = stage === "prod" ? "main" : "dev"
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
npx alchemy deploy

# Deploy to production
STAGE=prod npx alchemy deploy

# Deploy to demo
STAGE=demo npx alchemy deploy

# Destroy resources
npx alchemy deploy --destroy
```

## State Management

Alchemy stores state in `.alchemy/`:
- Encrypted state files per stage
- CI uses `CloudflareStateStore` for persistent, shared state

**Important**: Add to `.gitignore`:
```
.alchemy/
```
