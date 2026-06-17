# Plan: Organizer file-drop import agent

> Drag a roster, packet, or spreadsheet onto any organizer page. The agent reads
> it, matches it against what already exists, drafts proposed changes, and writes
> nothing until the organizer confirms once. PII stays server-side; source files
> are stored privately.

This is a step-by-step implementation guide. Each step lists **what**, **why**,
**files**, a **code sketch** grounded in the existing repo patterns, and **how to
verify**. Steps are ordered so each is independently testable and the feature can
ship behind a flag incrementally.

All paths are relative to `apps/wodsmith-start/` unless noted.

---

## 0. Precedent and guiding patterns

We are cloning the architecture of the existing **AI Judge Scheduler**, which is
the repo's blessed "model proposes → server validates → organizer confirms"
pattern. Read these before starting:

- Agent: `src/agents/judge-scheduler-agent.ts` (`Agent<Env, AgentState>`,
  `@callable()`, `setState`, abort controller, intent tools, AI Gateway).
- Schemas: `src/lib/judge-scheduler/schemas.ts` (Zod for proposals/state/tools).
- Pure helpers: `src/lib/judge-scheduler/tools.ts` (validation, no LLM).
- Server context (server-only): `src/server/judge-scheduler/context.ts`.
- Access control: `src/server/judge-scheduler/access.ts` (3 entry points incl. a
  DB-direct one for the Durable Object).
- Apply server fns: `src/server-fns/judge-scheduler-ai-fns.ts`
  (`loadAiSchedulingContextFn`, `applyAiProposalsFn`).
- UI: `src/routes/compete/organizer/$competitionId/judges-ai.tsx`
  (`useAgent`, streamed proposals, review/apply).
- WS auth + DO routing: `src/server.ts`.
- Infra: `alchemy.run.ts` (DO namespace, `Ai()`, `AiGateway`, `R2Bucket`).
- Upload: `src/routes/api/upload.ts`, `src/server/upload-authorization.ts`.
- Docs to update: `lat.md/architecture.md#AI Agents`,
  `lat.md/organizer-dashboard.md`.

**The 4-layer entitlement gating contract** (`lat.md/architecture.md#AI
Agents#Entitlement gating`) must be reproduced: page loader, write server fn,
agent WebSocket route, and agent `@callable()` entrypoint each re-check access.

---

## 1. UX intent (from the wireframe)

The wireframe ("organizer file-drop agent") explores **three ways a page reacts to
a dragged file**, with a shared confirm loop:

| Pattern | When | Notes |
|---|---|---|
| **A — Drawer** (right-side) | quick imports | keeps the page visible; lightest weight |
| **B — Full screen** | big/messy rosters | "home base"; downside: a context switch, hides the page you dropped onto |
| **C — Inline diff** | single event edits | field-level before/after, "shows exactly what changes, in place", one zone per section |

Shared principles pulled from the wireframe:

- **"One drag to one confirmed change."** Upload + parse happen automatically
  (user initiated the drop). Nothing is written **without an explicit confirm**.
- **The list *is* the preview** — "no checkbox grids", "no per-row checkboxes" as
  the primary affordance; the proposals render as the thing that will happen, with
  Confirm-all and per-item exclude ("Yes, add as drafts" / "No, leave them out").
- **Refine by prompt** — "a draft you refine in words, then confirm once."
  ("coaches should be head judges, skip anyone with no email" → agent re-drafts.)
- **Matching is shown inline** — "matched on email", "already a volunteer",
  "already judging Heat 3", "duplicates skipped", rows without email flagged.
- **Intent disambiguation** — drop a roster on Events → "ask if you meant
  Volunteers."
- **Undo + receipt** — after confirm, show a receipt ("12 invites sent, 3 dupes
  skipped") with an **Undo import** path.
- **Privacy** — "PII stays server-side", source files "Stored privately",
  "never public".
- **Persistent assistant dock** — always reachable, "keeps the page in view, like
  the pre-publish checks panel."

### MVP sequencing recommendation

Build the **drawer (A) + review surface** first as the primary surface, with a
**persistent dock** as the entry point and the **inline diff (C)** reserved for the
event-detail page in a later phase. Full-screen (B) is a presentation variant of
the same review surface and is cheap to add once A exists. Rationale: A is the
lightest surface that exercises the whole loop (drop → draft → refine → confirm →
undo), and the wireframe frames the drawer as the quick-import default.

---

## 2. Architecture overview

```
Organizer page (any of: /volunteers, /volunteers/judges, /events, /events/$eventId)
   │  user drags a file onto the page
   ▼
[OrganizerImportShell]  (mounted once in the $competitionId layout)
   │  1. detect page intent from the active route (useMatches)
   │  2. createImportRunFn → { importRunId } (DB row, status=created)
   │  3. POST /api/agent-import/upload (multipart) → private R2 key, checksum
   │  4. useAgent({ agent: "organizer-file-import-agent", name: `${importRunId}__${userId}` })
   │  5. agent.stub.start({ importRunId, competitionId, routeKind, eventId? })
   ▼
[OrganizerFileImportAgent]  (Durable Object, sqlite:true)
   │  - loads page context + existing volunteers/events/divisions/movements
   │  - reads the private R2 object, parses to rows/text (server-side)
   │  - runs generateText() through AI Gateway with PROPOSAL-ONLY tools
   │  - streams proposals + activity into state (auto-synced over WS)
   │  - refine(instruction) re-runs with current proposals + the new instruction
   ▼
[Review surface] (drawer / full screen / inline diff)
   │  organizer reviews, excludes rows, refines by prompt
   │  clicks Confirm  →  applyOrganizerImportFn (server fn, NOT the model)
   ▼
applyOrganizerImportFn
   - re-checks access + ownership + entitlement
   - validates each proposal deterministically
   - applies via existing fns (volunteer invite/metadata/role, event create/update)
   - records created/updated entities on the import run (for the receipt + Undo)
   - returns per-row results
   ▼
[Receipt]  "12 added, 3 duplicates skipped, 1 needs email"  +  Undo import
```

**Naming convention (enforced by `server.ts`):** Durable Object instance names
must match `^([a-z0-9_-]{1,128})__([a-z0-9_-]{1,128})$` where the suffix is the
session user id. We use `${importRunId}__${userId}` so each dropped file is an
isolated agent instance (a fresh ULID per drop — see the agent-name note in Step 12).

---

## 3. Locked decisions and open questions

Decisions taken for MVP (override later if product disagrees). Each has a
recommended default so the plan is actionable today.

| # | Question (from research) | MVP decision |
|---|---|---|
| D1 | Private vs public source files? | **Private.** Dedicated `/api/agent-import/upload` route stores under `agent-imports/{competitionId}/{importRunId}/{filename}` and returns **only** the key (never a public URL). Agent reads server-side via `env.R2_BUCKET.get(key)`. |
| D2 | New upload route or reuse `/api/upload`? | **New route.** Reuse the auth/logging shape but do not return a public URL and use a private prefix + import-run validation. |
| D3 | DB import-run row before any model call? | **Yes.** `agent_import_runs` row created first — gives audit, retention, idempotency (checksum), and the Undo receipt anchor. |
| D4 | File types for MVP | **CSV/TSV + XLSX + plain text/markdown.** PDF/DOCX text extraction is **Phase 9 (spike)**; do not block MVP on model file-part support. |
| D5 | Multiple files per drop? | **One file per drop** for MVP (one drag → one run). |
| D6 | Imported people become…? | **Direct volunteer invitations** (matches `inviteVolunteerFn`). Rows without email → proposed as "needs email", excluded from confirm by default. |
| D7 | Send invite emails on confirm? | **Yes, on confirm** (wireframe: "invite emails send on confirm"); the confirm UI must say so explicitly. A "create silently" toggle is a fast-follow. |
| D8 | Duplicate matching key | **Email first**, then exact name match as a soft signal. Existing invitation OR membership counts as a duplicate → proposed as "skip" or "update metadata". |
| D9 | Row-by-row vs all-or-nothing | **Row-by-row include/exclude**, single confirm applies the included set. |
| D10 | New bulk apply fn vs N× existing fns | **New `applyOrganizerImportFn`** that internally reuses `inviteVolunteerFn`/`updateVolunteerMetadataFn`/`bulkAssignVolunteerRoleFn`/`createWorkoutAndAddToCompetitionFn`/`saveCompetitionEventFn` logic, returns per-row results, idempotent by `(importRunId, rowKey)`. |
| D11 | Entitlement | **New `AI_FILE_IMPORT` feature** gating, mirroring `AI_JUDGE_SCHEDULING`. (Alternatively reuse an org-AI bundle — confirm with product.) |
| D12 | Retention | **Delete source file after successful apply OR 30 days**, whichever first (a scheduled cleanup; MVP can start with 30-day TTL only). |
| D13 | Refine-by-prompt in MVP? | **Yes** — it is central to the wireframe loop. Adds a `refine(instruction)` callable. |
| D14 | Undo in MVP? | **Undo for creates** (delete what we made) ships in MVP. Undo for **updates** needs before-snapshots (Step 13) — store snapshots so update-undo is possible; surface Undo for creates first. |

**Still genuinely open (confirm with product, do not block):** malware scanning
beyond MIME/extension checks; whether judges default to `judge` vs `head_judge`;
whether imports may *update* existing volunteer metadata or only create; score-input
entitlements for imported volunteers; waiver/required-question handling for
directly-imported volunteers.

---

## Phase 1 — Data model and infrastructure

### Step 1 — Add the `agent_import_runs` table

**Why:** durable anchor for audit, retention, idempotency, and the Undo receipt.
Created *before* any model call so an orphaned/abandoned drop is still tracked.

**Files:**
- `src/db/schemas/agent-imports.ts` (new)
- `src/db/schema.ts` (export the new schema)
- `src/db/schemas/common.ts` (add id generator)

**Code sketch** — `src/db/schemas/agent-imports.ts`:

```ts
import { datetime, index, json, mysqlTable, varchar } from "drizzle-orm/mysql-core"
import { commonColumns } from "./common"

export const AGENT_IMPORT_ROUTE_KIND = {
  VOLUNTEERS: "volunteers",
  JUDGES: "judges",
  EVENTS: "events",
  EVENT_DETAIL: "event_detail",
} as const
export type AgentImportRouteKind =
  (typeof AGENT_IMPORT_ROUTE_KIND)[keyof typeof AGENT_IMPORT_ROUTE_KIND]

export const AGENT_IMPORT_STATUS = {
  CREATED: "created",
  UPLOADED: "uploaded",
  PARSING: "parsing",
  THINKING: "thinking",
  PROPOSALS_READY: "proposals_ready",
  APPLYING: "applying",
  APPLIED: "applied",
  REJECTED: "rejected",
  ERROR: "error",
} as const
export type AgentImportStatus =
  (typeof AGENT_IMPORT_STATUS)[keyof typeof AGENT_IMPORT_STATUS]

/** Records of entities created/updated by a confirmed import, for the Undo path. */
export interface AppliedEntity {
  kind: "volunteer_invite" | "volunteer_metadata" | "judge_role" | "event_create" | "event_update"
  /** id of the created/updated row (membershipId, invitationId, trackWorkoutId, …) */
  entityId: string
  rowKey: string
  /** before-snapshot for updates so Undo can restore prior values */
  before?: Record<string, unknown>
}

export const agentImportRunsTable = mysqlTable(
  "agent_import_runs",
  {
    id: varchar({ length: 255 }).primaryKey(), // aimp_<ulid>
    competitionId: varchar({ length: 255 }).notNull(),
    organizingTeamId: varchar({ length: 255 }).notNull(),
    createdByUserId: varchar({ length: 255 }).notNull(),
    routeKind: varchar({ length: 32 }).notNull().$type<AgentImportRouteKind>(),
    eventId: varchar({ length: 255 }), // trackWorkoutId when routeKind=event_detail
    status: varchar({ length: 32 }).notNull().$type<AgentImportStatus>(),
    // file metadata (no public URL — private key only)
    r2Key: varchar({ length: 1024 }),
    originalFilename: varchar({ length: 512 }),
    mimeType: varchar({ length: 128 }),
    fileSize: varchar({ length: 32 }), // store as string; PlanetScale returns strings for ints
    checksum: varchar({ length: 128 }), // sha-256 hex, for idempotency / dup-import detection
    appliedEntities: json().$type<AppliedEntity[]>(),
    appliedByUserId: varchar({ length: 255 }),
    appliedAt: datetime(),
    errorMessage: varchar({ length: 1024 }),
    ...commonColumns,
  },
  (t) => [
    index("aimp_competition_idx").on(t.competitionId),
    index("aimp_checksum_idx").on(t.competitionId, t.checksum),
  ],
)

export type AgentImportRun = typeof agentImportRunsTable.$inferSelect
```

In `src/db/schemas/common.ts` add:

```ts
export const createAgentImportRunId = () => `aimp_${ulid()}`
```

In `src/db/schema.ts` add `export * from "./schemas/agent-imports"`.

**Verify:** `pnpm db:push` applies it to the dev branch; `pnpm db:studio` shows the
table. (Local-dev workflow per `CLAUDE.md` — no migration file until merge.)

> Gotcha (team memory): PlanetScale returns **strings** for COUNT/int aggregates —
> wrap with `Number()` when reading counts. We store `fileSize` as a string for the
> same reason.

### Step 2 — Provision the Durable Object namespace + bindings

**Why:** the agent is a Durable Object; Cloudflare requires the namespace bound and
the class exported from the Worker entry.

**Files:** `alchemy.run.ts`, `src/server.ts`.

**Code sketch** — `alchemy.run.ts` (mirror `judgeSchedulerAgent`):

```ts
const organizerFileImportAgent = DurableObjectNamespace("organizer-file-import-agent", {
  className: "OrganizerFileImportAgent",
  sqlite: true,
})
```

Add to `TanStackStart(...).bindings`:

```ts
ORGANIZER_FILE_IMPORT_AGENT: organizerFileImportAgent,
```

(`AI`, `CF_AIG_GATEWAY`, `R2_BUCKET`, `HYPERDRIVE` are already bound and reused.)

**Verify:** `pnpm alchemy:dev` (deploys local dev with bindings) then
`pnpm cf-typegen` so `Env` includes `ORGANIZER_FILE_IMPORT_AGENT`.

> Gotcha (team memory): the DO namespace is typed `<undefined>` by autogen env
> types because Alchemy doesn't pipe the class through — cast at the
> `getAgentByName` call site (see Step 3), exactly like `JUDGE_SCHEDULER_AGENT`.

### Step 3 — Export the class and route `/agents/organizer-file-import-agent/*`

**Why:** WebSocket upgrades must be handled before the TanStack Start handler, and
the connecting user must be authenticated against the agent name suffix.

**Files:** `src/server.ts`.

**Code sketch** — add the re-export and a routing branch alongside the judge agent:

```ts
export { OrganizerFileImportAgent } from "./agents/organizer-file-import-agent"

// inside createServerEntry({ fetch }) after the judge-scheduler-agent branch:
if (namespace === "organizer-file-import-agent") {
  const match = /^([a-z0-9_-]{1,128})__([a-z0-9_-]{1,128})$/i.exec(name)
  if (!match) return new Response("Invalid agent name", { status: 400 })
  const [, , userId] = match
  const session = await getSessionFromRequestCookie(request)
  if (!session?.userId || session.userId !== userId) {
    return new Response("Unauthorized", { status: 401 })
  }
  const ns = env.ORGANIZER_FILE_IMPORT_AGENT as unknown as
    DurableObjectNamespace<OrganizerFileImportAgent>
  const stub = await getAgentByName(ns, name)
  return stub.fetch(request)
}
```

(Import the type: `import type { OrganizerFileImportAgent } from
"./agents/organizer-file-import-agent"`.)

**Verify:** unit-test the name regex; a manual WS connect returns 401 for a
mismatched user id.

### Step 4 — Add the `AI_FILE_IMPORT` entitlement key

**Why:** consistent with the per-team AI gating model.

**Files:** `src/config/features.ts` (add the key), plus a DB `features` row seeded
through the existing entitlements admin (no code seed needed — metadata lives in
DB per that file's note).

```ts
// in FEATURES
AI_FILE_IMPORT: "ai_file_import",
```

**Verify:** `hasFeature(teamId, FEATURES.AI_FILE_IMPORT)` resolves; admins can grant
it from the platform entitlements panel (same path as `AI_JUDGE_SCHEDULING`).

---

## Phase 2 — Private upload and import-run creation

### Step 5 — `createImportRunFn` server function

**Why:** create the durable row and authorize before a byte is uploaded; returns the
`importRunId` the upload + agent name key off.

**Files:** `src/server-fns/organizer-file-import-fns.ts` (new; grows over later
steps), `src/server/organizer-file-import/access.ts` (Step 10).

```ts
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { getDb } from "@/db"
import { agentImportRunsTable, AGENT_IMPORT_ROUTE_KIND, AGENT_IMPORT_STATUS } from "@/db/schema"
import { createAgentImportRunId } from "@/db/schemas/common"
import { loadFileImportScope, requireFileImportTeamAccess } from "@/server/organizer-file-import/access"

const createRunSchema = z.object({
  competitionId: z.string().min(1),
  routeKind: z.nativeEnum(AGENT_IMPORT_ROUTE_KIND),
  eventId: z.string().min(1).optional(),
})

export const createImportRunFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createRunSchema.parse(d))
  .handler(async ({ data }) => {
    const scope = await loadFileImportScope(data) // verifies competition + event ownership
    await requireFileImportTeamAccess({ teamId: scope.organizingTeamId, scope })
    const db = getDb()
    const id = createAgentImportRunId()
    await db.insert(agentImportRunsTable).values({
      id,
      competitionId: scope.competitionId,
      organizingTeamId: scope.organizingTeamId,
      createdByUserId: scope.userId,
      routeKind: data.routeKind,
      eventId: data.eventId ?? null,
      status: AGENT_IMPORT_STATUS.CREATED,
    })
    return { importRunId: id }
  })
```

**Verify:** integration test — a non-organizer caller throws; the row appears with
`status=created`.

### Step 6 — Private upload route `/api/agent-import/upload`

**Why:** stores the dropped file privately, computes a checksum, and stamps it onto
the import-run row. Mirrors `api/upload.ts` auth/logging but returns no public URL.

**Files:** `src/routes/api/agent-import/upload.ts` (new).

```ts
import { env } from "cloudflare:workers"
import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { getDb } from "@/db"
import { agentImportRunsTable, AGENT_IMPORT_STATUS } from "@/db/schema"
import { loadFileImportScopeByRun, requireFileImportTeamAccess } from "@/server/organizer-file-import/access"
import { getSessionFromCookie } from "@/utils/auth"
import { logInfo } from "@/lib/logging"

const MAX_BYTES = 15 * 1024 * 1024 // 15MB
const ALLOWED = new Set([
  "text/csv", "text/tab-separated-values", "text/plain", "text/markdown",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // PDF/DOCX gated behind Phase 9 — reject for now
])

export const Route = createFileRoute("/api/agent-import/upload")({
  server: { handlers: { POST: async ({ request }) => {
    const session = await getSessionFromCookie()
    if (!session) return json({ error: "Unauthorized" }, { status: 401 })

    const form = await request.formData()
    const file = form.get("file") as File | null
    const importRunId = form.get("importRunId") as string | null
    if (!file || !importRunId) return json({ error: "Missing file or importRunId" }, { status: 400 })
    if (file.size > MAX_BYTES) return json({ error: "File too large (max 15MB)" }, { status: 400 })
    if (!ALLOWED.has(file.type)) return json({ error: `Unsupported type: ${file.type}` }, { status: 400 })

    // Authorize against the run's competition (defense in depth).
    const scope = await loadFileImportScopeByRun(importRunId)
    await requireFileImportTeamAccess({ teamId: scope.organizingTeamId, scope })
    if (scope.createdByUserId !== session.user.id) {
      return json({ error: "Forbidden" }, { status: 403 })
    }

    const bytes = await file.arrayBuffer()
    const digest = await crypto.subtle.digest("SHA-256", bytes)
    const checksum = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const key = `agent-imports/${scope.competitionId}/${importRunId}/${safeName}`
    await env.R2_BUCKET.put(key, bytes, {
      httpMetadata: { contentType: file.type },
      customMetadata: { uploadedBy: session.user.id, importRunId, purpose: "agent-import" },
    })

    const db = getDb()
    await db.update(agentImportRunsTable).set({
      status: AGENT_IMPORT_STATUS.UPLOADED,
      r2Key: key, originalFilename: file.name, mimeType: file.type,
      fileSize: String(file.size), checksum,
    }).where(eq(agentImportRunsTable.id, importRunId))

    logInfo({ message: "[AgentImport] upload completed", attributes: { importRunId, key, checksum } })
    // Return NO public URL — PII stays server-side.
    return json({ key, checksum, originalFilename: file.name, fileSize: file.size, mimeType: file.type })
  } } },
})
```

**Verify:** drop a CSV → object exists at the private key (check via Studio/R2), the
run row flips to `uploaded`, response has no URL. Oversized/unsupported files 400.

> Note on D1 privacy: the shared bucket has a public devDomain, but we never emit the
> public URL and keys contain an unguessable ULID. True hard-private storage (separate
> bucket or signed reads) is a follow-up; flag in `lat.md`.

---

## Phase 3 — Shared schemas, parsing, and validation helpers

These live under `src/lib/organizer-file-import/` so they are unit-testable without
the LLM or a Durable Object (per `lat.md/architecture.md#AI Agents`).

### Step 7 — Schemas (`src/lib/organizer-file-import/schemas.ts`)

**Why:** one source of truth shared by the agent, the apply server fn, and the UI.

```ts
import { z } from "zod"
import { VOLUNTEER_ROLE_TYPE_VALUES, VOLUNTEER_AVAILABILITY } from "@/db/schemas/volunteers"

export const confidenceSchema = z.enum(["high", "medium", "low"])
export const proposalActionSchema = z.enum(["create", "update", "skip", "needs_input"])

/** A single volunteer/judge the model proposes importing. */
export const volunteerProposalSchema = z.object({
  proposalId: z.string().min(1).max(64),
  rowKey: z.string().min(1),               // stable key from the source row, for idempotency
  action: proposalActionSchema,
  name: z.string().max(200).nullable(),
  email: z.string().email().nullable(),
  phone: z.string().max(40).nullable(),
  roleTypes: z.array(z.enum(VOLUNTEER_ROLE_TYPE_VALUES)).default([]),
  credentials: z.string().max(200).nullable(),
  shirtSize: z.string().max(20).nullable(),
  availability: z.enum([
    VOLUNTEER_AVAILABILITY.MORNING, VOLUNTEER_AVAILABILITY.AFTERNOON, VOLUNTEER_AVAILABILITY.ALL_DAY,
  ]).nullable(),
  // match info surfaced inline ("matched on email", "already a volunteer")
  matchKind: z.enum(["new", "existing_invite", "existing_member"]).default("new"),
  matchedMembershipId: z.string().nullable(),
  confidence: confidenceSchema,
  rationale: z.string().max(280),
  warnings: z.array(z.string().max(200)).max(10).default([]), // e.g. "no email — can't invite"
  status: z.enum(["pending", "accepted"]).default("pending"),
})
export type VolunteerProposal = z.infer<typeof volunteerProposalSchema>

/** Create or update an event/workout. */
export const eventProposalSchema = z.object({
  proposalId: z.string().min(1).max(64),
  rowKey: z.string().min(1),
  action: z.enum(["create", "update", "skip"]),
  targetTrackWorkoutId: z.string().nullable(), // set for updates
  name: z.string().min(1).max(200),
  description: z.string().max(5000).nullable(),
  scheme: z.string().nullable(),               // validated against WORKOUT_SCHEME_VALUES server-side
  scoreType: z.string().nullable(),
  timeCap: z.number().int().positive().nullable(),
  // field-level diff for inline pattern C
  changedFields: z.record(z.string(), z.object({ before: z.unknown(), after: z.unknown() })).default({}),
  confidence: confidenceSchema,
  rationale: z.string().max(280),
  warnings: z.array(z.string().max(200)).max(10).default([]),
  status: z.enum(["pending", "accepted"]).default("pending"),
})
export type EventProposal = z.infer<typeof eventProposalSchema>

/** Asked when the file doesn't match the page ("did you mean Volunteers?"). */
export const clarificationSchema = z.object({
  question: z.string().max(300),
  suggestedRouteKind: z.string().nullable(),
}).nullable()

export const activityEntrySchema = z.object({
  id: z.string(), timestamp: z.number(),
  kind: z.enum(["thinking", "tool", "proposed", "skipped", "done", "error"]),
  message: z.string(),
})
export type ActivityEntry = z.infer<typeof activityEntrySchema>

export const importStatusSchema = z.enum(["idle", "parsing", "thinking", "proposals_ready", "error"])

export const agentStateSchema = z.object({
  importRunId: z.string().nullable(),
  routeKind: z.string().nullable(),
  status: importStatusSchema,
  volunteerProposals: z.array(volunteerProposalSchema).default([]),
  eventProposals: z.array(eventProposalSchema).default([]),
  clarification: clarificationSchema.default(null),
  thinkingLog: z.array(activityEntrySchema).default([]),
  parseWarnings: z.array(z.string()).default([]),
  summary: z.string().nullable(),
  errorMessage: z.string().nullable(),
  startedAt: z.number().nullable(),
  completedAt: z.number().nullable(),
})
export type AgentState = z.infer<typeof agentStateSchema>

export const initialAgentState: AgentState = {
  importRunId: null, routeKind: null, status: "idle",
  volunteerProposals: [], eventProposals: [], clarification: null,
  thinkingLog: [], parseWarnings: [], summary: null, errorMessage: null,
  startedAt: null, completedAt: null,
}

export const MAX_THINKING_LOG_ENTRIES = 200

// client → agent kickoff + refine
export const startImportInputSchema = z.object({
  importRunId: z.string().min(1),
  competitionId: z.string().min(1),
  routeKind: z.string().min(1),
  eventId: z.string().min(1).optional(),
})
export const refineInputSchema = z.object({ instruction: z.string().min(1).max(500) })
export const markImportAppliedInputSchema = z.object({ proposalIds: z.array(z.string().min(1)).min(1) })
```

**Verify:** `pnpm type-check`; these compile and re-export volunteer enums cleanly.

### Step 8 — File parsing (`src/lib/organizer-file-import/parse.ts`)

**Why:** deterministic parse to rows/text *before* the model sees anything (cheaper,
safer, bounded). The model normalizes/maps columns; it does not parse bytes.

**Add dependencies** (verify Workers compatibility): `papaparse` (CSV/TSV, pure JS,
Workers-safe). For XLSX use **`xlsx` (SheetJS) via dynamic import** so it doesn't
bloat cold start. Spike: confirm `xlsx` parses an `ArrayBuffer` under Workers (no
Node `fs`).

```ts
import Papa from "papaparse"

export interface ParsedTable { headers: string[]; rows: Record<string, string>[]; warnings: string[] }

export function parseCsv(text: string): ParsedTable {
  const out = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy" })
  const warnings = out.errors.slice(0, 20).map((e) => `row ${e.row}: ${e.message}`)
  return { headers: out.meta.fields ?? [], rows: out.data, warnings }
}

export async function parseXlsx(bytes: ArrayBuffer): Promise<ParsedTable> {
  const XLSX = await import("xlsx") // dynamic import keeps cold start lean
  const wb = XLSX.read(bytes, { type: "array" })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" })
  return { headers: rows.length ? Object.keys(rows[0]) : [], rows, warnings: [] }
}

/** Cap what we send to the model: first N rows + a header summary. */
export function boundTableForModel(t: ParsedTable, maxRows = 200): ParsedTable {
  return { ...t, rows: t.rows.slice(0, maxRows) }
}
```

**Verify:** unit tests with fixture CSV/XLSX
(`test/lib/organizer-file-import/parse.test.ts`): headers detected, empty lines
skipped, >200 rows bounded, malformed CSV yields warnings.

### Step 9 — Validation helpers (`src/lib/organizer-file-import/validate.ts`)

**Why:** the same deterministic checks run in the agent's proposal tools *and* in the
apply server fn (the model is never trusted to gate writes).

```ts
import type { VolunteerProposal } from "./schemas"

export interface ExistingVolunteer { membershipId: string; email: string | null; name: string | null; isInvite: boolean }

/** Returns dedup match + blocking warnings. Pure. */
export function classifyVolunteer(
  p: Pick<VolunteerProposal, "email" | "name">,
  existing: ExistingVolunteer[],
): { matchKind: VolunteerProposal["matchKind"]; matchedMembershipId: string | null; warnings: string[] } {
  const warnings: string[] = []
  if (!p.email) warnings.push("No email — cannot send an invitation; provide one to import.")
  const byEmail = p.email ? existing.find((e) => e.email?.toLowerCase() === p.email!.toLowerCase()) : undefined
  if (byEmail) {
    return {
      matchKind: byEmail.isInvite ? "existing_invite" : "existing_member",
      matchedMembershipId: byEmail.membershipId, warnings,
    }
  }
  return { matchKind: "new", matchedMembershipId: null, warnings }
}

export function isBlockedVolunteer(p: VolunteerProposal): boolean {
  return p.action === "create" && !p.email
}
```

**Verify:** unit tests for email dedup (case-insensitive), no-email blocking,
existing-member vs existing-invite distinction.

---

## Phase 4 — Server access and context (server-only)

### Step 10 — Access control (`src/server/organizer-file-import/access.ts`)

**Why:** reproduce the judge scheduler's entry points — team-access and a DB-direct
agent access (Durable Objects have no Start request context) — plus run-scoped
variants for the upload route. Each verifies competition/event ownership +
`MANAGE_COMPETITIONS` + the `AI_FILE_IMPORT` entitlement.

```ts
import "server-only"
import { eq } from "drizzle-orm"
import { FEATURES } from "@/config/features"
import { getDb } from "@/db"
import { agentImportRunsTable } from "@/db/schema"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { hasFeature } from "@/server/entitlements"

export interface FileImportScope {
  competitionId: string
  organizingTeamId: string
  competitionTeamId: string | null
  routeKind: string
  eventId: string | null
  createdByUserId: string
  userId: string
}

export async function loadFileImportScope(input: {
  competitionId: string; routeKind: string; eventId?: string
}): Promise<FileImportScope> {
  /* resolve competition (organizingTeamId, competitionTeamId); if eventId, prove the
     trackWorkout belongs to the competition's programming track — mirror
     judge-scheduler/access.ts#loadAiSchedulingScope. Set userId from the request session. */
}

export async function loadFileImportScopeByRun(importRunId: string): Promise<FileImportScope> {
  const db = getDb()
  const run = await db.query.agentImportRunsTable.findFirst({ where: eq(agentImportRunsTable.id, importRunId) })
  if (!run) throw new Error("Import run not found")
  const scope = await loadFileImportScope({ competitionId: run.competitionId, routeKind: run.routeKind, eventId: run.eventId ?? undefined })
  return { ...scope, createdByUserId: run.createdByUserId }
}

export async function requireFileImportTeamAccess({ teamId, scope }: { teamId: string; scope: FileImportScope }) {
  if (scope.organizingTeamId !== teamId) throw new Error("Competition does not belong to this team")
  const { requireTeamPermission } = await import("@/utils/team-auth")
  await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_COMPETITIONS)
  if (!(await hasFeature(teamId, FEATURES.AI_FILE_IMPORT))) throw new Error("Your plan does not include AI File Import")
}

/** DO context: no Start request ALS — re-check from DB using the user id baked into the agent name. */
export async function requireFileImportAgentAccess(
  input: { competitionId: string; routeKind: string; eventId?: string }, userId: string,
): Promise<FileImportScope> {
  /* same shape as judge-scheduler/access.ts#requireAiSchedulingAgentAccess:
     look up user, admin bypass, team permission via membership/role, entitlement check */
}
```

**Verify:** integration tests for each guard (wrong team, missing permission, missing
entitlement, cross-competition event id).

### Step 11 — Context loaders (`src/server/organizer-file-import/context.ts`)

**Why:** give the model flat, pre-formatted facts to match against — never raw DB
rows. These also power the inline "matched against existing" UI.

**Loaders to implement:**

- `loadPageContext(scope)` → `{ routeKind, eventId, competitionName }`.
- `loadExistingVolunteers(competitionTeamId)` → `ExistingVolunteer[]` (volunteer
  system-role memberships + direct invitations; reuse the join in
  `judge-scheduler/context.ts#loadJudgeRoster` and `volunteer-fns`).
- `loadExistingEvents(competitionId)` → `{ trackWorkoutId, name, scheme, … }[]`
  (reuse `getCompetitionWorkoutsFn`'s query).
- `loadDivisions(competitionId)` and `loadMovements(teamId)` for event proposals.
- `readImportFile(scope)` → fetch `env.R2_BUCKET.get(run.r2Key)`, parse via Step 8,
  return a bounded table/text.

**Verify:** integration tests assert volunteers/events/divisions come back shaped for
the schema; `readImportFile` round-trips an uploaded fixture.

---

## Phase 5 — The agent

### Step 12 — `OrganizerFileImportAgent` (`src/agents/organizer-file-import-agent.ts`)

**Why:** the Durable Object that parses, reasons, and streams **proposal-only** state.
It mirrors `JudgeSchedulerAgent` (abort controller, activity log, `setState`,
AI Gateway) and adds a **refine** loop and **intent disambiguation**.

**Callables:**
- `start(input)` — validate, `requireFileImportAgentAccess`, `status="parsing"`,
  read+parse the file, `status="thinking"`, run `generateText` with the tools, finish
  `proposals_ready`.
- `refine({ instruction })` — re-run seeded with current proposals + the user's
  instruction ("coaches should be head judges, skip anyone with no email") so the
  model edits the draft in place.
- `stop()` / `reset()` — same as judge agent.
- `markApplied({ proposalIds })` — flip accepted proposals so a re-run/refine won't
  re-propose them (parallels `markAccepted`).

**Tools (proposal-only — NO write tool):**
- Context: `get_page_context`, `get_import_table` (bounded rows + headers),
  `get_existing_volunteers`, `get_existing_events`, `get_divisions`, `get_movements`.
- Proposals: `propose_volunteer`, `propose_event_create`, `propose_event_update`,
  `revoke_proposal`, `ask_clarification` (sets `state.clarification` — "did you mean
  Volunteers?"), `mark_complete`.

Each proposal tool runs the Step 9 validators, attaches `matchKind`/`warnings`, and
`setState`s so the review surface streams it in (same mechanism as judge proposals).

```ts
import "server-only"
import { createId } from "@paralleldrive/cuid2"
import { Agent, callable } from "agents"
import { generateText, stepCountIs, type Tool, tool } from "ai"
import { createAiGateway } from "ai-gateway-provider"
import { createUnified } from "ai-gateway-provider/providers/unified"
import { z } from "zod"
import {
  type AgentState, initialAgentState, startImportInputSchema, refineInputSchema,
} from "@/lib/organizer-file-import/schemas"
import { requireFileImportAgentAccess } from "@/server/organizer-file-import/access"
import {
  loadPageContext, loadExistingVolunteers, loadExistingEvents,
  loadDivisions, loadMovements, readImportFile,
} from "@/server/organizer-file-import/context"

const MODEL_ID = "workers-ai/@cf/moonshotai/kimi-k2.6" // same model as judge scheduler
const MAX_STEPS = 24

export class OrganizerFileImportAgent extends Agent<Env, AgentState> {
  initialState: AgentState = initialAgentState
  #abort: AbortController | null = null

  logActivity(kind, message) { /* identical cap+broadcast logic to JudgeSchedulerAgent.logActivity */ }

  @callable()
  async start(raw: unknown) {
    try {
      const input = startImportInputSchema.parse(raw)
      const userId = getUserIdFromAgentName(this.name)
      const scope = await requireFileImportAgentAccess(input, userId)

      this.setState({ ...initialAgentState, importRunId: input.importRunId, routeKind: input.routeKind, status: "parsing", startedAt: Date.now() })
      const table = await readImportFile(scope)
      if (table.warnings.length) this.setState({ ...this.state, parseWarnings: table.warnings })

      const ctx = await loadAllContext(scope)
      this.setState({ ...this.state, status: "thinking" })

      const gw = this.env.AI.gateway(this.env.CF_AIG_GATEWAY)
      const aiGateway = createAiGateway({ binding: { run: (d) => gw.run(d as any) } })
      const unified = createUnified()
      this.#abort = new AbortController()
      const result = await generateText({
        model: aiGateway(unified(MODEL_ID)),
        system: SYSTEM_PROMPT(scope.routeKind),
        prompt: buildKickoff(scope, table, ctx),
        tools: buildTools(this, scope, table, ctx),
        stopWhen: stepCountIs(MAX_STEPS),
        abortSignal: this.#abort.signal,
      })
      if (this.state.status !== "proposals_ready") {
        this.setState({ ...this.state, status: "proposals_ready", summary: result.text || "Done.", completedAt: Date.now() })
      }
      return { ok: true }
    } catch (err) { /* abort→idle soft-land + error state, identical to judge agent */ }
    finally { this.#abort = null }
  }

  @callable()
  async refine(raw: unknown) {
    const { instruction } = refineInputSchema.parse(raw)
    /* mirrors start() but prompt = buildRefinePrompt(this.state, instruction);
       keeps importRunId/ctx; tools can revoke/re-propose so the draft updates in place */
  }

  @callable() stop() { /* identical to JudgeSchedulerAgent.stop */ }
  @callable() reset() { /* setState(initialAgentState) */ }
  @callable() markApplied(raw: unknown) { /* flip proposals to accepted; drop them from the review list */ }
}

function getUserIdFromAgentName(name: string): string {
  const m = /^[a-z0-9_-]{1,128}__([a-z0-9_-]{1,128})$/i.exec(name)
  if (!m?.[1]) throw new Error("Invalid agent name")
  return m[1]
}
```

**System prompt must encode the human-in-the-loop contract:** the agent may
classify/extract/validate/propose only; it must never imply it has written anything;
it must call `ask_clarification` when the file's content doesn't match the page (e.g.
a roster on `/events`); it must set `confidence` and populate `warnings`.

**Verify:** with `pnpm alchemy:dev` running, drop a small CSV on `/volunteers`;
proposals stream into agent state over the WS; a roster dropped on `/events` triggers
`ask_clarification`.

> Agent-name gotcha: ULIDs are uppercase Crockford base32, which the `[a-z0-9_-]`
> regex in `server.ts` accepts case-insensitively (`/i`). The `aimp_<ULID>` id is a
> valid name segment as-is — do **not** lowercase the run id when forming
> `${importRunId}__${userId}` or the DO won't match the DB row.

---

## Phase 6 — Confirm (apply) and Undo

### Step 13 — `applyOrganizerImportFn` + `undoImportFn` (`src/server-fns/organizer-file-import-fns.ts`)

**Why:** the **only** place writes happen — triggered by an explicit organizer click,
never the model. Re-validates everything, applies via existing domain logic, records
created/updated entities for the receipt + Undo, and returns per-row results.

**`applyOrganizerImportFn`:**
1. `loadFileImportScopeByRun` + `requireFileImportTeamAccess` (+ entitlement).
2. Re-run Step 9 validators on the submitted proposals (reject blocked rows).
3. Volunteers: in a transaction, `create` → same logic as `inviteVolunteerFn`
   (invite + role types); `update` → `updateVolunteerMetadataFn` logic; collect
   `{rowKey, status, entityId, error}`. Idempotency: skip rows whose
   `(importRunId, rowKey)` is already in `appliedEntities`.
4. Events: `create` → `createWorkoutAndAddToCompetitionFn` logic; `update` →
   `saveCompetitionEventFn` logic, capturing a **before-snapshot** in `before`.
5. Persist `appliedEntities`, `status="applied"`, `appliedAt`, `appliedByUserId`.
6. Return `{ applied, skipped, failed, results }` for the receipt.

```ts
export const applyOrganizerImportFn = createServerFn({ method: "POST" })
  .inputValidator((d) => applyImportSchema.parse(d)) // { importRunId, volunteerProposals?, eventProposals? }
  .handler(async ({ data }) => {
    const scope = await loadFileImportScopeByRun(data.importRunId)
    await requireFileImportTeamAccess({ teamId: scope.organizingTeamId, scope })
    const db = getDb()
    return db.transaction(async (tx) => {
      /* validate → apply via existing domain helpers → record AppliedEntity[] → return per-row results */
    })
  })
```

**`undoImportFn`:** reverse `appliedEntities` — delete created invitations/workouts;
restore `before` snapshots for updates; clear `appliedEntities`; set
`status="rejected"`. Authorization identical.

Also add **`loadFileImportContextFn`** (GET) returning `{ hasAccess }` (+ optional
existing-data preview) so the page/dock can render a paywall when the team lacks
`AI_FILE_IMPORT`, exactly like `loadAiSchedulingContextFn`.

**Verify (integration — the highest-value tests):**
- create-only apply invites N volunteers, skips duplicates, fails no-email rows;
  re-running with the same `importRunId`+`rowKey` is a no-op (idempotent).
- event create adds a workout to the competition; event update changes only the
  proposed fields; `before` snapshot captured.
- `undoImportFn` removes exactly what was created and restores updated fields.
- every guard rejects a non-organizer / unentitled caller.

---

## Phase 7 — UI

### Step 14 — Drop shell + persistent dock, mounted in the layout

**Why:** the wireframe's "drag it anywhere on the page" + "persistent assistant dock"
means a single shell wrapping `<Outlet/>` in the organizer layout, not per-page code.

**Files:**
- `src/components/organizer-import/import-shell.tsx` (new) — full-page drag overlay
  + dock + drawer host.
- `src/components/organizer-import/use-page-intent.ts` (new) — derive `routeKind`
  (+ `eventId`) from `useMatches()`.
- `src/routes/compete/organizer/$competitionId.tsx` — wrap `<Outlet/>`.

**Page-intent detection:** map the active route to `AGENT_IMPORT_ROUTE_KIND`:
`/volunteers` → `volunteers`, `/volunteers/judges` → `judges`, `/events` (index) →
`events`, `/events/$eventId` → `event_detail` (capture `eventId = params.eventId`).
Only these four routes enable the drop affordance for MVP; others show nothing.

**Native HTML5 drag/drop** (not `@atlaskit/pragmatic-drag-and-drop`, which is for
in-app sortable lists). On `dragenter`/`dragover` when `e.dataTransfer.types`
includes `"Files"`, show a full-page overlay ("Drop to import to Volunteers"). On
`drop`: `createImportRunFn` → POST `/api/agent-import/upload` → open the drawer and
connect the agent.

```tsx
function ImportShell({ children }: { children: React.ReactNode }) {
  const { competition } = getRouteApi("/compete/organizer/$competitionId").useLoaderData()
  const intent = usePageIntent() // { routeKind, eventId } | null
  const [dragging, setDragging] = useState(false)
  const [run, setRun] = useState<{ importRunId: string } | null>(null)

  async function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    if (!intent) return
    const file = e.dataTransfer.files[0]; if (!file) return
    const { importRunId } = await createImportRunFn({ data: { competitionId: competition.id, routeKind: intent.routeKind, eventId: intent.eventId } })
    const fd = new FormData(); fd.append("file", file); fd.append("importRunId", importRunId)
    const res = await fetch("/api/agent-import/upload", { method: "POST", body: fd })
    if (!res.ok) { toast.error((await res.json()).error ?? "Upload failed"); return }
    setRun({ importRunId }) // drawer mounts, connects the agent, calls start()
  }

  return (
    <div onDragEnter={() => intent && setDragging(true)} onDragOver={(e) => e.preventDefault()} onDrop={onDrop} onDragLeave={() => setDragging(false)}>
      {children}
      {dragging && intent && <DropOverlay label={`Drop to import to ${labelFor(intent.routeKind)}`} />}
      <ImportDock intent={intent} hasActiveRun={!!run} />
      {run && <ImportReviewDrawer importRunId={run.importRunId} competition={competition} intent={intent} onClose={() => setRun(null)} />}
    </div>
  )
}
```

**Verify:** dragging a file over each of the four pages shows the correct labelled
overlay; other organizer pages show no overlay; the dock is always visible.

### Step 15 — Review surface (drawer) with refine + confirm + receipt

**Why:** the heart of the loop. Reuse the proposal-card visual language from
`judges-ai.tsx` (`AiProposalsBar`, `ProposalCard`, confidence badges, activity log).

**Files:** `src/components/organizer-import/import-review-drawer.tsx`,
`-proposal-list.tsx`, `-receipt.tsx`.

**Behavior:**
- `useAgent<AgentState>({ agent: "organizer-file-import-agent", name: \`${importRunId}__${userId}\` })`;
  call `agent.stub.start({...})` on mount.
- Render `status` (`parsing` → `thinking` → `proposals_ready`) via the activity-log
  ribbon pattern. Show `parseWarnings` and the `clarification` banner ("Did you mean
  Volunteers?" with a one-click switch that starts a new run on the other routeKind).
- **The list is the preview** — each proposal renders as the change that will happen,
  with inline match badges ("matched on email → already a volunteer", "duplicate,
  will skip") and warnings ("no email"). Per-item **exclude** (not a checkbox grid),
  and a single **Confirm** button: "Add 12 volunteers as drafts / send invites" —
  copy must state emails will send (D7).
- **Refine by prompt:** a text input → `agent.stub.refine({ instruction })`; proposals
  re-stream.
- **Confirm:** `applyOrganizerImportFn({ data: { importRunId, volunteerProposals: included } })`
  → on success `agent.stub.markApplied(...)`, `router.invalidate()`, render the
  **receipt** ("12 added · 3 duplicates skipped · 1 needs email") with **Undo
  import** → `undoImportFn`.

**Verify (manual happy path):** drop a 10-row coaches CSV on `/volunteers` → proposals
stream → type "make the coaches head judges, skip anyone without an email" → list
updates → Confirm → roster shows new invites after `router.invalidate()` → Undo
removes them.

### Step 15b (later) — Full-screen variant + inline event diff

- **Full screen (B):** same review body rendered in a route/modal for big rosters
  ("room for big rosters"). Cheap once Step 15 exists — extract the review body into a
  shared component hosted in either a `Sheet` (drawer) or a full-screen dialog.
- **Inline diff (C):** on `/events/$eventId`, render `eventProposal.changedFields` as
  field-level before/after badges in place ("one zone per section") instead of a
  drawer. This is the recommended pattern for single-event edits.

---

## Phase 8 — Tests, docs, and the required checklist

### Step 16 — Tests

Per the repo's Testing-Trophy lean (integration > unit):

- **Unit** (`test/lib/organizer-file-import/`): `parse.test.ts` (CSV/XLSX/bounds),
  `validate.test.ts` (email dedup, no-email blocking, match kinds).
- **Integration** (`test/server-fns/` or `test/integration/`): create-run + upload
  auth; `applyOrganizerImportFn` create/update/idempotency/failure; `undoImportFn`
  reversal; all access guards.
- Keep agent LLM calls out of tests — test the pure tools/validators and the apply
  path, exactly as the judge scheduler is tested.

`pnpm test` must pass.

### Step 17 — Documentation + final checks (REQUIRED by CLAUDE.md)

- Update `lat.md/architecture.md#AI Agents` — add an "Organizer file-drop import"
  subsection describing the new agent, the private upload path, and the
  proposal→confirm→undo loop; link
  `[[apps/wodsmith-start/src/agents/organizer-file-import-agent.ts#OrganizerFileImportAgent]]`.
- Update `lat.md/organizer-dashboard.md` — document the drop shell/dock on the
  organizer layout and the per-page intents (volunteers/judges/events/event detail).
- Add the 4-layer entitlement note for `AI_FILE_IMPORT`.
- Run `lat check` — all wiki links + code refs must pass (gated by `CLAUDE.md`).
  Note: `lat` was not on PATH in the planning container — ensure it's installed
  (`pnpm`/`npx lat`) before running.
- `pnpm cf-typegen` (after the `alchemy.run.ts` binding change), `pnpm type-check`,
  `pnpm check` (Biome lint+format).

---

## File manifest

**New**
- `src/db/schemas/agent-imports.ts`
- `src/lib/organizer-file-import/{schemas,parse,validate,tools}.ts`
- `src/server/organizer-file-import/{access,context}.ts`
- `src/server-fns/organizer-file-import-fns.ts`
- `src/agents/organizer-file-import-agent.ts`
- `src/routes/api/agent-import/upload.ts`
- `src/components/organizer-import/{import-shell,import-dock,import-review-drawer,proposal-list,receipt}.tsx`
- `src/components/organizer-import/use-page-intent.ts`
- `test/lib/organizer-file-import/*.test.ts`, `test/server-fns/organizer-file-import*.test.ts`

**Changed**
- `alchemy.run.ts` (DO namespace + binding)
- `src/server.ts` (export class + WS routing branch)
- `src/db/schema.ts`, `src/db/schemas/common.ts` (export + id generator)
- `src/config/features.ts` (`AI_FILE_IMPORT`)
- `src/routes/compete/organizer/$competitionId.tsx` (mount `ImportShell`)
- `package.json` (`papaparse`, `xlsx`; `@types/papaparse`)
- `lat.md/architecture.md`, `lat.md/organizer-dashboard.md`

---

## Rollout

1. Ship Phases 1–6 behind `AI_FILE_IMPORT` with no UI → backend testable in isolation.
2. Enable the dock/drawer (Phase 7) for internal teams only via the entitlement.
3. Add full-screen + inline-diff variants (Step 15b).
4. Phase 9 spike: PDF/DOCX text extraction (`unpdf` for PDF — serverless-friendly;
   evaluate a DOCX path) and decide model-native file parts vs pre-extraction, then
   widen the `ALLOWED` MIME set in Step 6.

## Risks / things to validate early

- **`xlsx` under Workers** — confirm `XLSX.read(arrayBuffer)` works in the Workers
  runtime (no Node `fs`); spike in Step 8 before committing to it.
- **Bundle size / cold start** — keep `xlsx` behind a dynamic import.
- **True file privacy** — shared bucket has a public devDomain; MVP relies on
  unguessable keys + never emitting URLs. Decide if a separate private bucket or
  signed reads are needed before GA (D1).
- **DO name charset** — keep run ids within `[a-z0-9_-]` (ULID is fine under `/i`).
- **Email send on confirm is irreversible** — the confirm copy must say invites will
  send; Undo deletes the invitation rows but cannot un-send email.
