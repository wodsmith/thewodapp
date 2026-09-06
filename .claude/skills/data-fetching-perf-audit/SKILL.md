---
name: data-fetching-perf-audit
description: >-
  Audit and optimize data fetching across TanStack Start route loaders, server
  functions (createServerFn), and Drizzle/PlanetScale queries in wodsmith-start.
  Use when a page or route group feels slow, when asked to do a "performance
  analysis" / "perf audit" of data fetching, or to investigate loader
  waterfalls, N+1 query patterns, sequential awaits of independent queries,
  fake parallelism, over-fetching, or missing indexes. Triggers: slow compete
  pages, slow organizer dashboard, "why is this loader slow", "optimize the
  queries on X", "eliminate N+1", "reduce round trips", "batch these fetches".
  Models the methodology proven in PRs #502 and #512.
---

# Data Fetching Performance Audit

Find and fix data-fetching slowness in `wodsmith-start` — the layer between a
route loader and the database. The wins are almost never "make the query
faster"; they are **fewer round trips** and **real parallelism**. This skill
encodes the audit methodology and the fix catalog proven in PR #502 (batch N+1
across organizer routes) and PR #512 (eliminate waterfalls on public compete
pages).

## Why this stack is different

Three facts drive every decision here. Internalize them before touching code:

1. **A server fn called from a loader is an HTTP round trip.** On client-side
   navigation, each `createServerFn` call the loader awaits is a separate
   request. Three sequential `await fooFn()` calls = three serial network waves
   before the page renders. Collapsing waves matters more than query speed.
2. **`getDb()` wraps a single mysql2 connection, and mysql2 serializes commands
   per connection.** `Promise.all([db.select()…, db.select()…])` on **one** `db`
   runs sequentially on the wire — fake parallelism. Real parallelism requires
   each branch to use its **own** `getDb()`.
3. **The push-based DB workflow has no migrations dir.** Index changes are
   schema edits applied with `pnpm db:push`, not generated migrations.

## The audit workflow

Work top-down: a page is slow because of how its loader composes server fns,
which is slow because of how each server fn composes queries.

1. **Scope.** Pick the route or route group (e.g. everything under
   `/compete/organizer/$competitionId/`, or the public `/compete/$slug` tree).
   Enumerate every route file in scope — don't sample.
2. **Trace each loader → server fn → query chain.** For each route's `loader`,
   list the server fns it awaits and whether they run sequentially or in
   `Promise.all`. Open each server fn and list its internal DB queries and
   whether *those* are sequential. Note anything called once per item in a list.
3. **Classify** every finding against the [anti-pattern catalog](#anti-pattern-catalog).
   Read `references/anti-patterns.md` for the detection signal, the fix, and
   real before/after code for each.
4. **Fix**, smallest blast radius first. Preserve loader data shapes so
   components and their props are untouched (verify with `pnpm type-check`).
   Keep single-item server fns alongside new batched ones — targeted refreshes
   still need them.
5. **Watch the two traps** in `references/stack-gotchas.md` — they will silently
   undo your work (fake parallelism) or break the client build
   (`cloudflare:workers` leaking into the bundle).
6. **Verify** with the checklist below.

For a thorough audit of a large route group, fan out: one agent per
page/loader tracing its full chain, then an adversarial pass that re-checks
each proposed fix for regressions (deferred-data drops, serialization,
behavior changes). PR #512's analysis was a 10-agent trace reviewed by a
20-agent adversarial pass. Scale the agent count to the scope.

## Anti-pattern catalog

Quick reference — full detection + fix + code in `references/anti-patterns.md`.

| Anti-pattern | Smell | Fix |
|---|---|---|
| **Loader waterfall** | Loader `await`s fn A, then B with A's result, then C — each a round trip on client nav | Consolidate into one server fn (or ≤2 parallel) that composes the work in-process |
| **N+1 server-fn call** | `items.map(i => someFn({ data: i.id }))` / a per-item call inside a loop | One batched fn taking `ids[]`, one `inArray` query, returns a `Record<id, …>` map |
| **Sequential independent awaits** | `const a = await x(); const b = await y()` where `y` doesn't use `a` | `const [a, b] = await Promise.all([x(), y()])` |
| **Fake parallelism** | `Promise.all` over one shared `getDb()` instance | One `getDb()` per parallel branch (mysql2 serializes per connection) |
| **Over-fetching** | `select()` whole rows / full `users` (ships `passwordHash`, profile JSON); filtering in JS | Project only consumed columns; push filters into SQL (`where`) |
| **Scan-to-check** | Fetch all rows then `.find`/`.some` in JS to test existence | Single `EXISTS`-scoped / `inArray` query |
| **Missing hot-path index** | `inArray` / `eq` on a junction table (`workout_movements`, `workout_tags`) doing full scans | Add `index(...)` in the schema, apply with `pnpm db:push` |
| **Dead query** | A fetched value that nothing in the loader/component consumes | Delete it |
| **Per-item on critical path** | Non-essential data blocking first render | Defer it off the loader (chain un-awaited, hydrate client-side) |

## Security while optimizing

Tracing every fetch surfaces authz holes — fix them in the same pass (PR #512
found two). Watch for: client-supplied `userId`/ids trusted without a session
check (IDOR — derive identity from `getSessionFromCookie()`), and unpublished/
draft data (e.g. heats with athlete names) returned to anonymous viewers. See
`references/stack-gotchas.md`.

## Verification checklist

- [ ] `pnpm type-check` — loader data shapes unchanged (component contracts intact)
- [ ] `pnpm build` — confirms no `@/db` / `cloudflare:workers` leaked into the client bundle
- [ ] `pnpm test` — at parity with `main` (run suspected pre-existing failures on a clean `main` to confirm)
- [ ] `pnpm check` (Biome) clean on changed files
- [ ] If indexes changed: `pnpm db:push` applied (no migration files)
- [ ] `lat check` passes; update `lat.md/architecture.md` to document new consolidated/batched fns
- [ ] Each parallel branch verified to use its own `getDb()` (no fake parallelism)
