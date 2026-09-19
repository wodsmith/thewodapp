# Anti-pattern catalog: detection + fix + code

Each section: how to spot it, how to fix it, and real before/after from
`wodsmith-start` (PRs #502, #512). Code is illustrative — match the existing
file's imports and style when applying.

## Contents

1. [Loader waterfall → consolidated server fn](#1-loader-waterfall)
2. [N+1 server-fn call → batched map fn](#2-n1-server-fn-call)
3. [Sequential independent awaits → Promise.all](#3-sequential-independent-awaits)
4. [Fake parallelism → one getDb() per branch](#4-fake-parallelism)
5. [Over-fetching → project + filter in SQL](#5-over-fetching)
6. [Scan-to-check → EXISTS-scoped query](#6-scan-to-check)
7. [Missing hot-path index](#7-missing-hot-path-index)
8. [Dead query → delete](#8-dead-query)
9. [Per-item on critical path → defer](#9-per-item-on-critical-path)

---

## 1. Loader waterfall

**Detect.** A route `loader` awaits one server fn, then awaits a second using
the first's result, then a third. Each await is an HTTP round trip on
client-side navigation. A page that issues 3–6 sequential waves pays 3–6 serial
network latencies before render.

**Fix.** Collapse the waves into **one consolidated server fn** that composes
the existing fns/queries in-process (server-to-server, no extra round trips), or
into **≤2 parallel** fns when one is public and one is session-specific. Both
take the same input (e.g. `slug`) so neither waits on the other — one extra
cheap indexed lookup beats a serial HTTP wave. Keep the loader's returned data
shape identical so components don't change.

Reference fns: `getPublicCompetitionPageDataFn` + `getViewerCompetitionContextFn`
(`src/server-fns/competition-page-fns.ts`), `getPublicWorkoutsPageDataFn`
(`competition-workouts-page-fns.ts`), `getPublicEventPageDataFn`
(`competition-event-page-fns.ts`).

```ts
// BEFORE — loader: 3 sequential round trips
const comp = await getCompetitionFn({ data: { slug } })
const divisions = await getDivisionsFn({ data: { competitionId: comp.id } })
const sponsors = await getSponsorsFn({ data: { competitionId: comp.id } })

// AFTER — one consolidated fn; public branches fan out in-process, each on its
// own connection. Anonymous viewers get empty stubs with zero DB work.
export const getPublicCompetitionPageDataFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => competitionPageInputSchema.parse(d))
  .handler(async ({ data }) => {
    const { competition } = await getCompetitionBySlugFn({ data: { slug: data.slug } })
    if (!competition) return { competition: null, divisions: [], sponsors: emptySponsors }
    const [divisionsResult, sponsors, judgesScheduleResult] = await Promise.all([
      getPublicCompetitionDivisionsForCompetition({ competition }),
      getCompetitionSponsorsFn({ data: { competitionId: competition.id } }),
      hasJudgesScheduleFn({ data: { competitionId: competition.id } }),
    ])
    return { competition, divisions: divisionsResult.divisions, sponsors, /* … */ }
  })
```

Split public vs. session data when one half needs no session: the public fn
does zero session work and is cacheable; the viewer fn reads the session **once**
and short-circuits to empty stubs for anonymous visitors.

---

## 2. N+1 server-fn call

**Detect.** A server fn (or multi-query fn) invoked once per item in a list:
`volunteers.map(v => canInputScoresFn({ data: v.userId }))`, or a parent fetching
child data once per child. Cost scales with list length — the classic N+1.

**Fix.** Add a **batched fn** that takes an array of ids, issues **one
`inArray` query**, and returns a `Record<id, …>` map (pre-filled with defaults so
every requested id is present). Callers do a map lookup instead of a call.
Exploit shared scope: if children share a parent's competition-scoped data, fetch
it once for all of them rather than per child.

Reference fns: `getScoreAccessMapFn` (`src/server-fns/volunteer-fns.ts`),
`getJudgeSchedulingDataForEventsFn` (`judge-scheduling-fns.ts`),
`getEventScoreEntryDataWithHeatsBatchFn` (`competition-score-fns.ts`),
`getHeatsByWorkoutIdsInternal` (`competition-heats-fns.ts`).

```ts
// BEFORE — N queries, one per volunteer
const access = {}
for (const v of volunteers) {
  access[v.userId] = await canInputScoresFn({ data: { userId: v.userId, competitionTeamId } })
}

// AFTER — one inArray query, returns userId -> boolean map
export const getScoreAccessMapFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ userIds: z.array(z.string()), competitionTeamId: competitionTeamIdSchema }).parse(d),
  )
  .handler(async ({ data }): Promise<Record<string, boolean>> => {
    const accessMap: Record<string, boolean> = {}
    for (const userId of data.userIds) accessMap[userId] = false  // defaults
    if (data.userIds.length === 0) return accessMap
    const db = getDb()
    const entitlements = await db
      .select({ userId: entitlementTable.userId })
      .from(entitlementTable)
      .where(and(
        inArray(entitlementTable.userId, data.userIds),
        eq(entitlementTable.teamId, data.competitionTeamId),
        eq(entitlementTable.entitlementTypeId, SCORE_INPUT_TYPE_ID),
        isNull(entitlementTable.deletedAt),
      ))
    for (const e of entitlements) if (e.userId) accessMap[e.userId] = true
    return accessMap
  })
```

When batching collapses N calls to 1, the per-item result may now be missing for
a bad id. Preserve prior behavior explicitly — e.g. `throw` "Event not found" if a
child's data is absent from the batch result (matching the old per-child error)
rather than silently dropping it. Also avoid re-introducing O(items × rows): group
rows by their key in a single pass, don't `.filter` all rows per item.

---

## 3. Sequential independent awaits

**Detect.** Inside a fn or loader, `const a = await x(); const b = await y()`
where `y` does **not** use `a`. They are independent but run serially.

**Fix.** `const [a, b] = await Promise.all([x(), y()])`. But across **server fns**
this is real concurrency; across **raw queries on one `db`** it is not — see #4.

Reference: pricing loader (5 independent fetches → one `Promise.all`), sponsors
loader, `getCompetitionRevenueStats` (`src/server/commerce/fee-calculator.ts`),
all in PR #502.

---

## 4. Fake parallelism

**Detect.** `Promise.all([...])` whose branches all use the **same** `db` /
`getDb()` instance. mysql2 serializes commands on a single connection, so this
runs sequentially despite the `Promise.all` — the most insidious trap because it
*looks* parallel.

**Fix.** Give each parallel branch its **own** `getDb()`. In-process server-fn
composition gets this for free (each fn calls `getDb()` internally), but raw
queries you parallelize by hand must each open a connection.

Reference: `getCompetitionLeaderboard` (`src/server/competition-leaderboard.ts`)
runs three dependency-ordered parallel groups, each branch on its own connection.

```ts
// BEFORE — fake parallelism: one connection serializes both
const db = getDb()
const [competition, registrations] = await Promise.all([
  db.select().from(competitionsTable).where(...),
  db.select().from(registrationsTable).where(...),
])

// AFTER — one connection per branch actually runs them concurrently
const competitionDb = getDb()
const registrationsDb = getDb()
const [competition, registrations] = await Promise.all([
  competitionDb.select().from(competitionsTable).where(...),
  registrationsDb.select().from(registrationsTable).where(...),
])
```

Dependency-order the groups: group 1 fetches what group 2 needs; within a group,
everything is independent and each branch has its own connection.

---

## 5. Over-fetching

**Detect.** `db.select()` (whole row) when only a few columns are used —
especially joining `users`, which ships `passwordHash` and `athleteProfile` JSON
for every athlete onto the wire. Or fetching all rows and filtering by a field in
JS.

**Fix.** Project only the consumed columns with `select({ … })`, and push the
filter into SQL with `where(...)` instead of a JS `.filter`.

Reference: leaderboard registrations now project only the
registration/user/division columns the ranking consumes and filter division in
SQL (`src/server/competition-leaderboard.ts`, PR #512).

```ts
// BEFORE — full user rows + JS division filter
const regs = (await db.select().from(registrationsTable)
  .innerJoin(users, eq(users.id, registrationsTable.userId)))
  .filter(r => r.division_id === divisionId)

// AFTER — projected columns + SQL filter
const regs = await db
  .select({ id: registrationsTable.id, name: users.firstName, divisionId: registrationsTable.divisionId })
  .from(registrationsTable)
  .innerJoin(users, eq(users.id, registrationsTable.userId))
  .where(eq(registrationsTable.divisionId, divisionId))
```

---

## 6. Scan-to-check

**Detect.** Fetching every row in a scope, then `.find`/`.some` in JS to test
whether one exists — e.g. loading every registration in a competition just to see
if a given email has a pending team invite.

**Fix.** One `EXISTS`-correlated or `inArray`-scoped query that answers the
question in SQL.

Reference: pending team invites now use a single EXISTS-scoped query on the
invitee email instead of scanning every registration
(`getPendingTeamInvitesForEmail`, `src/server/competition-detail.ts`, PR #512).

---

## 7. Missing hot-path index

**Detect.** Frequent `inArray`/`eq` lookups on a junction/global table that has
no index on the looked-up column — a full table scan on every hit. PR #512 found
`workout_movements` and `workout_tags` (global junction tables) were full-scanned
on hot `inArray` lookups, plus `judge_heat_assignments(rotationId)`.

**Fix.** Add the index in the Drizzle schema's table-extras callback, then apply
with `pnpm db:push` — **no migration files** (push-based workflow; no migrations
dir exists). Flag the `db:push` step explicitly in the PR.

```ts
// src/db/schemas/workouts.ts
export const workoutTagsTable = mysqlTable(
  "workout_tags",
  { ...commonColumns, id: varchar({ length: 255 }).primaryKey(),
    workoutId: varchar({ length: 255 }).notNull(), tagId: varchar({ length: 255 }).notNull() },
  (table) => [
    index("workout_tags_workout_idx").on(table.workoutId),
    index("workout_tags_tag_idx").on(table.tagId),
  ],
)
```

---

## 8. Dead query

**Detect.** A fetched value that nothing downstream reads — a `totalEvents` count
returned but never rendered, a `getTeamContactEmailFn` loader fetch whose result
is unused, a duplicate mapping query. Grep the symbol; if no consumer, it's dead.

**Fix.** Delete it. PR #512 removed `totalEvents`, a dead `getTeamContactEmailFn`
fetch, a duplicate leaderboard mappings query, and redundant inline registration
fns. Each deletion is one fewer query on the critical path.

---

## 9. Per-item on critical path

**Detect.** Non-essential, expensive data (heats, schedules) awaited in the
loader, blocking first paint, when the component could hydrate it after render.

**Fix.** Keep it **off** the loader's critical path: chain the fn off the
page-data promise **un-awaited** and let the component resolve it client-side
(deferred data). Distinct from #1 — here the goal isn't fewer round trips but
keeping a slow fetch out of the blocking path.

Reference: event-detail published heats — the route chains `getPublicEventHeatsFn`
off the page-data promise un-awaited and the heat-schedule component resolves it
client-side (`src/routes/compete/$slug/workouts/$eventId.tsx`, PR #512).

> Regression watch: when deferring, ensure the deferred promise is actually
> forwarded to the component and not accidentally awaited or dropped — PR #512's
> adversarial review caught a heats-deferral regression.
