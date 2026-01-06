---
name: tanstack-start-server-only
description: |
  TanStack Start server-only patterns using createServerOnlyFn and cloudflare:workers env access.
  Use when: accessing Cloudflare environment variables (APP_URL, STRIPE_SECRET_KEY, etc.),
  creating server-only utility functions, working with Stripe or other server-only APIs,
  or when you need to ensure code only runs on the server and throws if called from client.
  Covers createServerOnlyFn vs createServerFn differences, env access patterns, and centralized
  server-only utilities.
---

# TanStack Start Server-Only Patterns

## Core Concepts

### createServerOnlyFn vs createServerFn

- **`createServerFn`**: Creates RPC functions callable from client, executes on server
- **`createServerOnlyFn`**: Creates functions that ONLY run on server, throws if called from client

Use `createServerOnlyFn` for:

- Utility functions that access `cloudflare:workers` env
- Functions that should never be exposed to client code
- Shared server-side helpers (database access, external APIs)

### Environment Variable Access

**ALWAYS** use `env` from `cloudflare:workers` for environment variables in wodsmith-start:

```typescript
import {env} from 'cloudflare:workers'

// Access bindings and env vars
env.DB // D1 database
env.KV_SESSION // KV namespace
env.R2_BUCKET // R2 bucket
env.APP_URL // Environment variable
env.STRIPE_SECRET_KEY // Secret
```

**NEVER** use `process.env` - it doesn't work in Cloudflare Workers runtime.

**TypeScript not recognizing env vars?** If you've added new bindings in `alchemy.run.ts` and deployed with `pnpm alchemy:dev`, but TypeScript doesn't see them, run:

```bash
pnpm cf-typegen
```

This regenerates `worker-configuration.d.ts` from `wrangler.jsonc` to update the type definitions.

## Patterns

### Centralized Server-Only Utilities

Create shared utilities in `src/lib/` using `createServerOnlyFn`:

```typescript
// src/lib/env.ts
import {createServerOnlyFn} from '@tanstack/react-start'
import {env} from 'cloudflare:workers'

export const getAppUrl = createServerOnlyFn((): string => {
  return env.APP_URL || 'https://wodsmith.com'
})

export const getStripeClientId = createServerOnlyFn((): string | undefined => {
  return env.STRIPE_CLIENT_ID
})
```

### Using Server-Only Functions

Import and call directly - no dynamic imports needed:

```typescript
// In server-fns, route loaders, or other server code
import {getAppUrl} from '@/lib/env'
import {getStripe} from '@/lib/stripe'

export const myServerFn = createServerFn({method: 'POST'}).handler(async () => {
  const appUrl = getAppUrl() // Safe - throws if called from client
  const stripe = getStripe()
  // ...
})
```

### Server-Only API Clients

Wrap API clients in `createServerOnlyFn`:

```typescript
// src/lib/stripe.ts
import {createServerOnlyFn} from '@tanstack/react-start'
import {env} from 'cloudflare:workers'
import Stripe from 'stripe'

let stripeInstance: Stripe | null = null

export const getStripe = createServerOnlyFn(() => {
  if (stripeInstance) return stripeInstance

  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('Missing STRIPE_SECRET_KEY')
  }

  stripeInstance = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  })

  return stripeInstance
})
```

### Server-Only Business Logic

Group related server-only functions:

```typescript
// src/server/stripe-connect/accounts.ts
import {createServerOnlyFn} from '@tanstack/react-start'
import {getDb} from '@/db'
import {getAppUrl, getStripeClientId} from '@/lib/env'
import {getStripe} from '@/lib/stripe'

export const createExpressAccount = createServerOnlyFn(
  async (teamId: string, email: string, teamName: string) => {
    const db = getDb()
    const stripe = getStripe()
    const appUrl = getAppUrl()
    // ... implementation
  },
)

export const getOAuthAuthorizeUrl = createServerOnlyFn(
  (teamId: string, teamSlug: string, userId: string, csrfToken: string) => {
    const clientId = getStripeClientId()
    const appUrl = getAppUrl()
    // ... implementation
  },
)
```

## Import Rules

### Safe Top-Level Imports

These can be imported at the top of any file:

- `@tanstack/react-start` - Framework utilities including `createServerOnlyFn`
- `@/lib/env` - Server-only env utilities (uses `createServerOnlyFn`)
- `@/lib/stripe` - Server-only Stripe client (uses `createServerOnlyFn`)
- `@/server/*` - Server-only business logic (uses `createServerOnlyFn`)
- `zod` - Validation schemas
- `@/db/schema` - Schema type definitions

### Why This Works

`createServerOnlyFn` is processed by a compiler plugin that:

1. In server context: Returns the actual function
2. In client context: Returns a function that throws an error

This means imports are safe - the function definition exists in both contexts, but execution is blocked on client.

## File Organization

```
src/
├── lib/
│   ├── env.ts          # Centralized env access (getAppUrl, getStripeClientId)
│   └── stripe.ts       # Stripe client (getStripe)
├── server/
│   └── stripe-connect/
│       ├── accounts.ts # Server-only Stripe Connect functions
│       └── index.ts    # Re-exports
└── server-fns/
    └── *.ts            # createServerFn RPCs that use server-only utilities
```

## Common Mistakes

### Wrong: Using process.env

```typescript
// BAD - doesn't work in Cloudflare Workers
const appUrl = process.env.APP_URL
```

### Wrong: Inline env access everywhere

```typescript
// BAD - duplicated, no centralization
import {env} from 'cloudflare:workers'
const appUrl = env.APP_URL || 'https://wodsmith.com'
```

### Right: Centralized server-only utilities

```typescript
// GOOD - centralized, type-safe, server-only enforced
import {getAppUrl} from '@/lib/env'
const appUrl = getAppUrl()
```
