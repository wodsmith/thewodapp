# Plan 001: Make tracks understandable from discovery through daily Training

This plan separates athlete following, gym-library access, and site administration, then connects dated provider programming to the athlete's daily view.

## Status

- Priority: P1
- Effort: L overall; deliver in the ordered slices below.
- Risk: MED, concentrated in daily-source identity, permission checks, and score preservation.
- Depends on: none; CrossFit importer PR #681 is merged and deployed.
- Category: direction, UX, correctness.
- Planned at: `50890e5d5`, September 6, 2026. Production merge commit: `4ab9cbb1c3dcb7152f5fba3e76925f9a551d0e59`. Reconciled implementation base: `18bfd7f8b`; newer workout-import access checks in programming-fns and its tests must be preserved.
- Status: DONE — implemented and reviewed on `codex/track-experience`, September 6, 2026; not released.
- Product choice: the user approved personal following plus separate gym-library actions. Existing billing and entitlement rules remain unchanged.

## Why this matters

The CrossFit page currently puts a long list of team subscription buttons above the daily workout, exposes importer controls within the reader experience, and appends 114 older library entries with raw order values. Subscribing makes a track eligible for Training but does not populate its calendar from the provider's dated imports. A successful import therefore does not yet produce a coherent daily training experience.

The user's admin account must remain useful as an athlete account. Administrative privilege should add a clearly labeled destination, not change the meaning or hierarchy of the reader page.

## Product contract

The experience has four distinct jobs. Treat the first three actions as separate persistent concepts; never make one silently perform another.

| Person and intent | Label | What changes | What the person sees next |
| --- | --- | --- | --- |
| Athlete wants ongoing access to CrossFit programming | Follow track / Following | Active subscription in their own personal workspace, resolved by the server | Track available under My training; a View in Training link |
| Athlete wants this track when opening Training | Make default track | Existing per-athlete, per-workspace default preference | Confirmation naming that track; merely browsing another track does not change the default |
| Coach wants a source available to a gym | Add to gym library | Subscription for one eligible, explicitly selected gym | Added to [gym]; link to that gym's Training context |
| Athlete wants to perform one workout | Add to my day | Explicitly confirmed composition for one workspace and performed date | My session with full scoring and source attribution |
| Site admin wants to operate the importer | Admin · Manage imports | Preview is read-only; Publish changes the provider ledger/source track | Admin result and link back to the published date |

Following is not an email subscription, payment, gym programming publication, or automatic copy of workouts into personal sessions. Use those distinctions in explanatory copy only where a choice needs them. Ordinary browsing creates no subscription, preference, session, or score.

## Design brief

Extend the existing dark-neutral WODsmith interface with orange reserved for the primary action. This is an Operate/Read surface, optimized first for a phone in the gym. Reuse `src/styles.css`, existing UI primitives, and the Training shell; do not transplant the benchmark-specific category rail or replace the global design system.

### Track page

The first viewport should establish the track's identity, the selected date, and its programming. Administration and long organization lists must not precede the workout.

Sequence:

1. Back to tracks; track name and a short existing description. One primary Follow track action, or Following with a quiet menu to unfollow. Do not create promotional claims or invent subscriber counts.
2. Selected-date heading such as “Sunday, September 6, 2026” with a small Today label only when true. Show the selected day's workout prescription directly; reveal scaling and longer source material on demand. An explicit rest entry leads with Rest day and has no logging action.
3. For each scoreable component, a useful name, human-readable scoring description, View workout, and Add to my day. A time-plus-load day retains both components and their separate scores.
4. Previous days in compact, newest-first rows. The selected date persists in the URL. The existing sixty-day feed is a bounded archive, not an unlimited history promise; selected-date reads must work independently of that sixty-row window.
5. For eligible coaches, a secondary “For your gym” disclosure containing Add to gym library and one searchable gym selector. Show only active, unexpired memberships with programming permission and relevant training access. Exclude competition-event teams; treat personal workspaces separately. Do not change legacy event subscriptions or delete them.
6. For site admins only, a small, separated section headed **Admin** with helper text “Only visible to site administrators” and a Manage imports link. No inline date input, raw JSON, run IDs, or global team chooser here.
7. Older undated track entries live under a collapsed “Workout library” disclosure. Preserve all records, make each item navigable, format names as text without literal Markdown markers, and omit raw order values. Never infer a canonical source date by parsing legacy notes. Do not delete apparent duplicates in this UX change.

On mobile, use a single content column, wrapping names, date navigation with accessible labels, and targets at least 44px high/wide where appropriate. Use restrained separators rather than nested cards for every line. On desktop, retain the same reading order; optional secondary controls can sit beside the content without dominating it.

### Site administrator destination

Create `/admin/programming/$trackId` as the explicit source-track operations destination, with server-authorized access and an “Admin / Programming / CrossFit.com” breadcrumb. It must identify the source track directly, never infer an operating team from `session.teams[0]`.

Use the page title **Admin · CrossFit.com imports**. Group controls under Preview an import, Publish an import, and Import history. Default the source-date field to today's date in the importer's fixed PST calendar, label it **CrossFit workout date**, and show the long-form date next to the native date control. Preview is read-only. Show a human-readable preview with component/scoring details before the Publish action; keep publication independently explicit. Tie preview state to its date and clear it when the date changes. Surface changed content/source hashes for review instead of silently publishing a different prescription.

Published dates show **Already published** and an Open published day link. Explain replay preservation next to any retry control. Show status, completion time, and readable errors first; place raw Workflow IDs, model information, and JSON under Technical details. Keep mutation checks in `requireAdmin`, not merely a client-visible badge.

Admin-only schedule copy: “Daily import: 05:00 PST (UTC−8), year-round. During Pacific daylight time this is 06:00 local.” Preserve the current cron; changing its timezone semantics is outside this plan.

### Daily Training

Label the context selector **Training for**, displaying **My training** for the athlete's personal workspace and gym names for gym contexts. A coach action uses **Coach tools**; site operations use **Admin**. A site admin without a gym's live membership receives no implicit gym-coach access.

The track selector groups followed personal tracks and gym-available tracks within their respective selected contexts. A View in Training link carries the confirmed workspace, track, and selected date. It must not land on an unrelated saved default. Make default track remains a separate explicit action.

The week strip and day body use the same resolved source and distinguish:

| State | Reader presentation | Available action |
| --- | --- | --- |
| Provider workout published for selected date | Date, track attribution, prescription, each scoreable component | View workout; Add to my day |
| Provider explicitly published rest | Rest day; optional source article | Browse another day; no dummy workout or score |
| No published provider entry for date | No programming published for this date | Previous/next date; no rest inference or automatic substitution of an older day |
| Read failed | Could not load programming | Retry, retaining workspace/track/date |
| No followed/available tracks | Choose a track to follow | Browse tracks; eligible gym-library management for coaches |
| Personal composition exists | My session and saved items remain stable; chosen track is still browsable below as source programming | Explicit add/remove; never replace the composition on a track change |
| Followed but training entitlement unavailable | Track can remain followed; explain unavailable Training access before navigation | Existing account/access destination; never silently grant features |

Source publication is projected into daily reads, not copied into a gym training session. If a coach has published a session for the same gym/track/date, that publication takes precedence; provider content remains available via its track link. A draft-only coach session does not suppress provider publication for athletes or leak draft content. Saved personal compositions and results take precedence over both for the athlete's own session.

Use the selected workspace's existing timezone to choose its initial daily date. Provider dates remain calendar labels: “CrossFit.com · Programmed September 4” stays September 4 when an athlete performs it on September 7. On the source track page, Today follows the provider's fixed PST calendar. Do not parse a date-only string into local midnight and shift it across timezones.

## Current state and evidence

These findings were verified against the named source files. HIGH confidence describes the current behavior; the approved implementation includes personal following and separate gym libraries.

| Finding | Category / impact | Effort / fix risk | Evidence |
| --- | --- | --- | --- |
| Team membership list dominates the reader page and includes event teams | UX: pushes daily programming below irrelevant actions | S–M / LOW | `src/routes/_protected/programming/$trackId/index.tsx:55`, `:227`, `:294` |
| Import operations are mixed into the track page | UX: admin account sees unrelated operating controls | S / LOW | Same route `:295`; `src/components/crossfit-import-admin.tsx:19`, `:62` |
| Subscription eligibility does not deliver dated provider content | Direction/correctness: selectable track with no imported daily content | M–L / MED | `src/server/training.ts:101`, `:271`; `src/server/training-personal.ts:161`; `src/server/crossfit-import.ts:193` |
| Daily link cannot select a track | Correctness: View in Training can open an unrelated default | S / LOW | `src/routes/_protected/training/index.tsx:7`; `src/components/training/athlete-training.tsx:143` |
| Library additions lose visible provider provenance | UX/history: programmed and performed dates cannot be distinguished | M / MED | `src/lib/training/personal-types.ts:23`; `src/server/training-personal.ts:301`; `src/components/training/athlete-personal-session.tsx:382` |

Paths in this table are relative to `apps/wodsmith-start/`.

Load-bearing current excerpts:

```tsx
// src/routes/_protected/programming/$trackId/index.tsx
const userTeams = (session?.teams || []) as UserTeam[]
// The entire subscription Card is rendered before these:
<CrossFitTrackDays days={days} />
{canManageImports && <CrossFitImportAdmin />}
```

```ts
// src/server/training-personal.ts:161
const [source] = selectedTrackId
  ? await getDb().select().from(trainingSessionsTable)
      .where(and(
        eq(trainingSessionsTable.teamId, data.teamId),
        eq(trainingSessionsTable.trackId, selectedTrackId),
        eq(trainingSessionsTable.trainingDate, data.trainingDate),
      ))
  : []
```

The existing personal workspace is identified by `teams.isPersonalTeam` plus `personalTeamOwnerId`; `src/server/user.ts#getUserPersonalTeamId` resolves it. Some signup paths omit `type`, leaving its schema default of `gym`, so do not identify personal workspaces solely by `type === "personal"`. Do not create a second personal workspace.

Subscriptions already use `teamProgrammingTracksTable`. `subscribeToTrackFn` requires live programming permission and a public track; `requireTrainingAccess` separately requires membership, tracking entitlement, and eligible track access. The new UI must expose these facts accurately. Global admin is not a replacement for those checks.

Coached `TrainingBlock` supports a limited set of score formats. `src/lib/training/library-block.ts#libraryWorkoutToBlock` deliberately rejects rounds, caps, and unsupported aggregation. `PersonalLibraryItem`, the rich log route, and snapshot history are the existing preservation path. Do not weaken the rejection or flatten CrossFit scoring.

## Architecture and data boundaries

Keep the importer as the source of published provider days. Add a date/range reader with an explicit union such as coach-session, provider-day, or unavailable; preserve provider rest as a real state. Extend daily and weekly read contracts together rather than constructing fake `TrainingSession` IDs/blocks in UI code. Batch reads by date range and component IDs; do not issue one request per calendar cell or score component.

Provider reads return only published entries. Administrative statuses, source snapshots under review, failure details, and model output stay behind admin APIs. A public missing date must not disclose private review diagnostics. The track page may display published programming without following; following gates its convenient availability in Training, not ownership of the source.

Personal Follow resolves the caller's existing owned personal workspace on the server and reuses its active track association. Do not accept another user's personal-team ID. Make following idempotent with the existing unique subscription identity. Gym additions accept one selected gym ID, then revalidate type, live membership, programming permission, and applicable feature access. Filter the selector server-side and repeat authorization on mutation. Do not change permission semantics for unrelated legacy clients without characterization tests.

Provider components render their original workout IDs and rich scoring metadata. Add to my day reuses the existing library confirmation and composition path. Viewing or cancelling creates nothing. For multi-component days, offer an explicit Add all to my day preview, preserving order and capacity constraints; commit all selected additions as one composition revision or fail without a partial addition. Logging follows the existing rich personal result path after the explicit add. A direct Log action from a provider preview is outside the first slice unless it preserves the same explicit composition consent and persistence guarantees.

Add optional server-resolved provider provenance to `PersonalLibraryItem` snapshots: import ID, track ID/name, source date, and source URL. Resolve membership from published import items, never from client claims. Preserve provenance in historical result snapshots after source edits, workout removal, or unfollowing. Existing library items without provenance keep their current fallback label and remain readable.

Unfollow stops future convenience access and does not erase personal compositions, logs, or source publication. Keep current live access rules for gym/private data. Characterize what happens when a now-ineligible track is a stored default: fall back visibly without silently rewriting the preference, as current Training does.

## Scope

Only change the following application surfaces and their direct tests. Documentation changes required by repository instructions are included separately.

- Generated route artifact: `apps/wodsmith-start/src/routeTree.gen.ts` changes only to register the new Admin destination.
- Existing routes: `apps/wodsmith-start/src/routes/_protected/programming/{index.tsx,subscriptions/index.tsx,$trackId/index.tsx}` and `_protected/training/index.tsx`.
- New admin route: `apps/wodsmith-start/src/routes/_protected/admin/programming/$trackId/index.tsx`.
- Components: `src/components/crossfit-track-days.tsx`, `crossfit-import-admin.tsx`; new `track-follow-actions.tsx` and `track-detail-view.tsx` (shared production reader and verification fixture); `src/components/training/athlete-training.tsx` and `athlete-personal-session.tsx`.
- Server/functions: `src/server/crossfit-import.ts`, `training.ts`, `training-personal.ts`; `src/server-fns/crossfit-import-fns.ts`, `programming-fns.ts`, `training-fns.ts`, `training-personal-fns.ts`; a new scoped `track-follow-fns.ts` if needed to avoid widening legacy contracts.
- Types: `src/lib/training/types.ts`, `personal-types.ts`; source date helpers in `src/lib/crossfit/source.ts` only if needed for reuse, and `src/lib/crossfit/display.ts` for shared date/scoring labels, without changing cron semantics.
- Workflow preview binding: `src/workflows/crossfit-daily-import-workflow.ts` and its direct tests may accept an optional expected source hash and reject changed content before publication. Preserve cron behavior and the existing publication transaction.
- Shared snapshot typing: `packages/wodsmith-db/src/schemas/training-personal.ts` adds optional provider provenance to existing JSON item/result types; no DDL or migration.
- New tests: `test/components/track-experience.test.tsx`, `test/components/track-preview-fixtures.test.ts`, `test/components/crossfit-import-admin.test.tsx`, `test/server-fns/track-follow.test.ts`, `test/server-fns/crossfit-import-admin-auth.test.ts`, `src/server/training-provider.test.ts`.
- Existing tests: `test/components/crossfit-track-days.test.tsx`, `test/server-fns/crossfit-track-mutations.test.ts`, `test/components/training/athlete-training.test.tsx`, `src/server/training-personal.test.ts` and directly associated preview fixtures under `test/preview/training/`.
- Documentation: `lat.md/crossfit-import.md`, `lat.md/training.md`, `lat.md/training-personal.md`, this plan and its index.

All abbreviated `src/` and `test/` paths above are under `apps/wodsmith-start/`. Excluded: Crew, competition pages, global branding, billing/entitlement grants, production data cleanup, importer conversion/publication transaction changes, schedule changes, backfills, and deployment. Do not add a migration unless inspection proves the existing associations and JSON snapshots cannot represent this contract; report that finding first.

## Implementation order and verification

Execute the slices in order, retaining working application behavior after each. Read local AGENTS instructions, run `lat expand`/`lat search`, and run GitNexus upstream impact for every existing symbol before editing it. Report blast radius and warn on HIGH/CRITICAL findings. Run `detect_changes({scope:"all"})` before any commit. Do not use stale index absence as evidence of zero risk.

### 1. Separate the reading and admin surfaces

Move importer controls to the dedicated admin route, protect its loader/server reads, and leave the explicit Admin link on the track page. Put dated programming first and collapse the legacy library. Use calendar-safe long dates and a selected-date URL. Default the admin date with the existing fixed-PST helper; hide technical details until requested. Add tests covering site admin versus ordinary member, all three day states, and mobile-length names.

Verify: `pnpm --filter wodsmith-start exec vitest run test/components/crossfit-track-days.test.tsx test/components/track-experience.test.tsx test/components/crossfit-import-admin.test.tsx test/server-fns/crossfit-track-mutations.test.ts` exits 0. Existing rest and multi-component tests must still pass after updating display-label assertions.

### 2. Make following and gym-library actions explicit

Implement the chosen personal-following contract, using the existing personal workspace if that option is confirmed. Keep gym-library selection secondary and permission-aware. Split the subscriptions page into My followed tracks and Gym libraries, keeping personal identities distinct from gym/event identities. Show success inline and retain current state/input on failure. Missing personal workspace is a recoverable account/setup error, not a reason to pick `teams[0]` or create one during a read.

Verify: `pnpm --filter wodsmith-start exec vitest run test/server-fns/track-follow.test.ts test/components/track-experience.test.tsx` exits 0. Fixtures include an admin with many event teams, ordinary gym member, authorized coach, expired membership, personal team whose type defaults to gym, unavailable entitlement, repeated follow/unfollow, and a forged target personal workspace.

### 3. Connect selected tracks and published provider dates to Training

Add validated optional `trackId` search state and preserve explicit route selection over the remembered default. Revalidate against the selected workspace. Extend week/day reads with the provider origin and the documented precedence, applying existing live access rules before reads. Use date-range queries, reflect rest and unavailable states in both week strip and day body, and reject stale async responses after workspace/track/date changes.

Verify: `pnpm --filter wodsmith-start exec vitest run src/server/training-provider.test.ts test/components/training/athlete-training.test.tsx` exits 0. Include explicit-track deep links, inaccessible IDs, read-only projection with zero inserts, provider rest versus missing, coach publication precedence, draft privacy, midnight/DST boundaries, and a pre-existing personal composition.

### 4. Preserve scoring and provenance when adding to a day

Add provider attribution to server-resolved library snapshots and reuse the explicit library-add confirmation. Show the selected performed date and retain the programmed date. Test one component and ordered multi-component additions, cancellation, duplicate confirmation, concurrent revisions, capacity failure, and failed saves. Rich scoring and historical snapshot behavior must remain unchanged.

Verify: `pnpm --filter wodsmith-start exec vitest run src/server/training-provider.test.ts src/server/training-personal.test.ts test/components/track-experience.test.tsx` exits 0 for the configured test layers. The disposable-MySQL tests must additionally exercise a capped workout and multi-round load workout through the real persistence path; do not count skipped DB tests as passing.

### 5. Complete the whole-flow review

Update `lat.md/` with implemented behavior and test references, distinguishing provider projection from coached publication and personal composition. Run the quality gates below, then inspect desktop and mobile together using actual components with clearly labeled fixtures. Fix that bounded review's findings in one batch and confirm once. No production writes are part of design verification.

## Commands and acceptance gates

These commands come from the current package scripts. Use existing installed dependencies and Node 24. Do not install, deploy, or run database push as a verification shortcut.

| Purpose | Command | Expected result |
| --- | --- | --- |
| Drift check | `git diff --stat 50890e5d5..HEAD -- apps/wodsmith-start/src apps/wodsmith-start/test lat.md` | Review touched in-scope files against the current-state excerpts before editing |
| Type check | `pnpm --filter wodsmith-start type-check` | Exit 0 |
| App lint | `pnpm --filter wodsmith-start lint` | Exit 0; no new warnings caused by this change |
| App tests | `pnpm --filter wodsmith-start test` | Exit 0; new focused tests included |
| Build | `pnpm --filter wodsmith-start build` | Exit 0; generated route typing includes admin destination |
| Schema ownership | `pnpm check:schema-ownership` | Exit 0 |
| Architecture links | `lat check` | All checks passed |
| Whitespace | `git diff --check` | Exit 0 |
| Design detector (set `IMPECCABLE_SKILL_DIR` to your installed Impeccable skill directory) | `node "$IMPECCABLE_SKILL_DIR/scripts/detect.mjs" --json <changed-UI-files>` | Run once after UI implementation; resolve applicable findings |

DB verification uses an explicitly supplied disposable local `training_test` database through `TRAINING_TEST_DATABASE_URL`, following `src/server/training-personal.test.ts`. Never use the default localhost proxy without verifying its destination; it may proxy production. No credentials belong in this plan or logs.

Use `test/components/crossfit-track-days.test.tsx` for React Testing Library conventions and `src/server/training-personal.test.ts` for real MySQL transaction tests. Each new durable test specification gets exactly one nearby `@lat` reference. Keep visual fixtures outside production routes.

## Done criteria

All behavior and verification gates must hold; a prettier track page alone does not complete this plan.

- Ordinary member DOM contains no importer operations, source diagnostics, or Admin section. Admin DOM has a labeled link to the separately protected admin destination.
- The selected day's programming appears before subscription administration and legacy library content.
- Only eligible gyms appear in the gym selector; personal following resolves to the current user and never mutates another workspace.
- View in Training opens the exact eligible workspace/track/date without modifying a default preference.
- Provider workout, rest, unavailable, and error states agree between calendar and day view; reads create zero session rows.
- A confirmed addition retains every score component, rich scoring metadata, original source identity, and performed date; cancelling creates nothing.
- Existing personal composition/history survives track navigation and unfollowing within existing access rules.
- All listed gates pass; DB tests actually run against the disposable database.
- At 390px and desktop width, labels are readable, controls fit, keyboard focus is visible, and no horizontal page overflow occurs. No tiny order-number badges or literal Markdown title markers remain in the reader's library list.
- Diff scope is limited to named files; update this plan's status and index only after verification.

## STOP conditions and unresolved choices

Pause the dependent slice and report evidence if the user's personal-following choice is still unresolved at implementation time; independent reader/admin cleanup can proceed. Do not decide billing or entitlement policy from silence.

Also report before extending scope if personal workspaces are absent for affected real accounts, full scoring requires schema changes, live code has drifted materially from the quoted contracts, or provider/gym precedence conflicts with a newly recorded product decision. Never substitute a logged-in admin's permissions for ordinary user access to make a demo work.

## Maintenance and handoff

Recommended branch: `codex/track-experience`. Create it from current main after checking drift; do not continue committing on the merged importer branch. Follow recent conventional messages such as `feat: clarify track following and daily programming`. Do not push, open a PR, merge, or deploy without the operator's instruction for this work.

Future providers must supply dated publication and rich component identities rather than assuming sequence order means calendar date. Review any future subscription change against the distinction between follow, default preference, coach publication, and personal composition. Calendar behavior and result provenance are the highest-risk review areas.

## Implementation review

The approved flow is implemented on `codex/track-experience`, based on `18bfd7f8b`. The reviewer approved the scoped implementation after independent functional, visual, and regression verification.

The reader leads with dated programming; personal Follow and eligible gym-library actions are separate. Admin operations have their own server-protected destination and same-date, hash-bound preview. Training projects provider days without creating coach sessions; explicit additions preserve scoring, performed/source dates, and snapshots after unfollowing or provider removal. Personal ownership does not expose gym coaching controls. Failed track reads discard stale visible source data and retain a retry for the selected context.

Verification completed with Node 24:

- Full app Vitest: 229 files passed, 3,475 tests passed; six unrelated suites/57 tests remained skipped. Training DB suites ran against the explicitly configured disposable local database.
- Workout-import runtime: five files, 30 tests passed.
- Final focused provider, follow, admin, and Training checks: 76 tests passed; subsequent targeted checks passed 39 tests for snapshot/access changes and 21 component tests including failed-read retry.
- Final production build, type check, lint, schema ownership, whitespace, and `lat check` passed. App lint retains 144 repository warnings; changed-file lint reported no warnings.
- Actual production components reviewed at 390px and 1280px: readable prescriptions, eligible gym selection, separated Admin preview, explicit multi-add/cancel, saved item order, and no horizontal overflow. The single Impeccable detector run returned no findings.
- GitNexus reported LOW for indexed changes. Its canonical index lacks newer Training symbols and untracked additions, so direct code review and regression tests supplied the missing coverage.

Necessary supporting scope was reconciled explicitly: shared reader component, display helpers, generated route registration, preview-only fixtures, direct admin authorization tests, optional Workflow expected-source hash, and shared JSON snapshot typing. No feature migration or production data mutation was introduced. The disposable test database needed current schema synchronization because committed migrations lacked a pre-existing scoring column; synchronization was pinned to the isolated local test port.
