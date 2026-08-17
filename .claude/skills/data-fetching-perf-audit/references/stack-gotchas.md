# Stack gotchas

Codebase-specific traps that silently undo a perf fix or break the build. The
first two are the ones that bite hardest; read them before optimizing.

## Contents

1. [mysql2 single-connection serialization](#1-mysql2-single-connection-serialization)
2. [cloudflare:workers leaking into the client bundle](#2-cloudflareworkers-leaking-into-the-client-bundle)
3. [Push-based DB workflow (indexes)](#3-push-based-db-workflow)
4. [Preserve loader data shapes](#4-preserve-loader-data-shapes)
5. [Server fn = HTTP round trip; in-process composition is free](#5-server-fn--http-round-trip)
6. [Security holes surface during the audit](#6-security-holes-surface-during-the-audit)
7. [Caching is deferred, not free](#7-caching-is-deferred-not-free)

---

## 1. mysql2 single-connection serialization

`getDb()` returns a Drizzle instance wrapping a **single mysql2 connection**, and
mysql2 serializes commands per connection. Consequences:

- `Promise.all([db.q1(), db.q2()])` on **one** `db` is **fake parallelism** — the
  queries run back-to-back on the wire. The `Promise.all` makes it *look*
  concurrent; it isn't.
- Real concurrency requires **one `getDb()` per parallel branch**. In-process
  server-fn composition gets this automatically (each fn opens its own
  connection). Hand-written parallel raw queries must each call `getDb()`.

```ts
// Each parallel branch gets its OWN getDb() connection: a Drizzle instance
// wraps a single mysql2 connection which serializes commands, so sharing one
// instance across Promise.all branches would still execute sequentially.
const competitionDb = getDb()
const registrationsDb = getDb()
const [competition, registrations] = await Promise.all([
  competitionDb.select()...,
  registrationsDb.select()...,
])
```

> Do **not** "fix" this by memoizing `getDb()` into a shared pooled instance —
> naive memoization would serialize all parallel queries again. Per-request
> connection pooling is a deliberate infra decision, not a perf-audit change.

## 2. cloudflare:workers leaking into the client bundle

`@/db` imports `cloudflare:workers`, which Vite **cannot resolve in the browser**.
TanStack Start's client compile strips `createServerFn` **handler bodies** (and
their imports), but it **cannot strip exported plain functions**. So an exported
plain helper that calls `getDb()`, living in a `src/server-fns/*` module, drags
`@/db` → `cloudflare:workers` into the client graph and breaks the build:

```
[vite:import-analysis] Failed to resolve import "cloudflare:workers" from "src/db/index.ts"
```

This bites specifically when consolidating fns: extracting shared DB helpers as
exported plain functions is the natural refactor, and it's the one that breaks.

**Fix — follow the `src/server/` convention:**

- DB-backed plain helpers go in `src/server/*.ts` with `import "server-only"` at
  the top (e.g. `src/server/competition-detail.ts`,
  `src/server/competition-divisions.ts`).
- Client-safe pieces (Zod parsers, constants, plain types like
  `parseCompetitionSettings`, `PublicCompetitionDivision`) go in `src/utils/*`
  (e.g. `src/utils/competition-settings.ts`) so server modules can use them with
  no cycle. Re-export from the original `*-fns.ts` so existing importers (incl.
  client routes) stay unchanged.
- `src/server-fns/*` files then reference the helpers **only inside handler
  bodies**, which the client compiler strips.

Always run `pnpm build` (not just `type-check`) after a consolidation — the
client-bundle resolution error only appears at build time.

## 3. Push-based DB workflow

No migrations directory exists. Schema/index changes are applied with
`pnpm db:push` during development. When a perf fix adds an index, the index lives
in the Drizzle schema's table-extras callback and the PR must call out the
`pnpm db:push` step explicitly. Do **not** hand-write SQL migrations.

## 4. Preserve loader data shapes

The goal is faster loading with **zero** change to what components receive. Keep
each loader's returned object shape identical (same keys, same types) so child
components and their props are untouched. `pnpm type-check` is the guardrail — if
it passes, the contract held. The only acceptable shape change is deleting a
genuinely dead field (e.g. `organizerContactEmail`), and only after confirming no
consumer reads it.

## 5. Server fn = HTTP round trip

A `createServerFn` call awaited in a loader is a network request on client-side
navigation. Composing fns **in-process** (one server fn calling another's logic
server-side) costs no extra round trip. That's why consolidation works: the
loader makes 1–2 calls, and the fan-out happens server-to-server. When you need
two loader-level calls, make them parallel and have each resolve its own
prerequisites (e.g. both take the `slug`) so neither blocks the other.

## 6. Security holes surface during the audit

Tracing every fetch is also an authz audit. Two real holes found in PR #512:

- **IDOR:** `getUserCompetitionRegistrationsFn` accepted a client-supplied
  `userId` with no session check — any visitor could read another user's
  registrations. Fix: derive the user from `getSessionFromCookie()`, never trust
  client input for identity.
- **Draft exposure:** `getHeatsForCompetitionFn` returned unpublished heats —
  including athlete names — to anonymous visitors. Fix: filter
  `schedulePublishedAt IS NOT NULL` unless the viewer is a site admin or holds
  owner/admin/`manage_programming` on the organizing team. Add regression tests
  and verify every existing caller is unaffected.

When over-fetching also leaks sensitive columns (`passwordHash`, profile JSON via
full `users` rows), the projection fix in anti-pattern #5 is a security fix too.

## 7. Caching is deferred, not free

These optimizations are about call structure, not caching. Caching the
now-consolidated public payloads (KV), enabling Hyperdrive query caching, and
per-request connection pooling are separate infra decisions — Hyperdrive query
caching is explicitly disabled in `alchemy.run.ts`; verify *why* before flipping
it. Don't bundle these into a structural perf audit.
