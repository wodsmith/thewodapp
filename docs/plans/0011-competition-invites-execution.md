---
status: draft
adr: docs/adr/0011-competition-invites.md
owner: Zac Jones
created: 2026-04-21
---

# ADR-0011 Execution Plan — Stacked Commits

Implementation plan for [ADR-0011 Competition Invites](../adr/0011-competition-invites.md), laid out as a sequence of small, stacked commits. Each commit is scoped to be independently reviewable, leaves the codebase in a working state, and stacks atop the previous so reviewers can move forward PR-by-PR without rebase churn.

## Stacking Philosophy

- **One thing per commit.** A commit either (a) adds/changes schema, (b) adds server logic, (c) exposes a server function, (d) adds UI, or (e) wires a cross-cutting concern (auth, workflow, queue, cron). No "schema + UI + tests" omnibus.
- **Tests ride with their code.** Unit tests for a helper go in the same commit as the helper. Integration/E2E tests get their own commit at phase boundaries where they exercise multiple stack layers.
- **Each commit passes `pnpm type-check`, `pnpm lint`, and `pnpm test`.** No broken intermediate states.
- **Schema changes land on the PlanetScale `competition-invites` branch via the PlanetScale MCP.** No `pnpm db:push` against a developer's private branch — the `competition-invites` branch is the shared source of truth for this effort. `pnpm db:generate` still runs once per phase to produce a Drizzle migration file for code review; production promotion is via a PlanetScale **deploy request** from `competition-invites` → `main` at final release, not via `pnpm db:migrate`.
- **Deploy gates at phase boundaries.** Between phases, the stack is paused, the feature is verified in preview (Cloudflare preview env pointed at the `competition-invites` PlanetScale branch), and a release checkpoint is cut before the next phase's commits land.
- **Commit titles use conventional commits scoped `invites`**, e.g. `feat(invites): add sources schema`. This matches recent work on the `feat/competition-invites` branch.

### Why this shape

A strict serialization is required because almost every commit touches either `src/db/schemas/competition-invites.ts`, `src/server/competition-invites/*`, or `src/server-fns/competition-invite-fns.ts`. Parallel branches would collide in every one of those files. The stacking depth below is the minimum that keeps review blocks under ~500 diff lines while still respecting dependency order.

## Prerequisites (before Commit 1)

These unlock the stack and should be resolved first. None of them are code changes.

1. **Resolve ADR open questions 1, 2, 5, 6, 7.** They affect schema defaults, unique-index behavior, and timezone interpretation. Q3, Q4 can slip to Phase 4 start.
2. **Decide visual variant** ("by-the-book" vs "bold flagship" from the mockup) — blocks Phase 3 UI polish but not Phase 1/2 server work, so this can land in parallel.
3. **Branch off `main` to `feat/competition-invites`** (already present on the current branch). All stacks land there; `feat/competition-invites` → `main` is the final merge.
4. **Cut the PlanetScale `competition-invites` branch** from the current `main` PlanetScale branch. Confirm via `mcp__planetscale__*` that the branch exists, is writable, and the team has authenticated via `mcp__planetscale__authenticate`. Point the preview-environment `DATABASE_URL` at this branch (via `.dev.vars` + `pnpm alchemy:dev`) so every commit in the stack runs against the shared schema.
5. **Confirm Cloudflare bindings** — email queue, KV claim-token namespace, cron trigger slot — exist in `alchemy.run.ts`. Add stubs before Phase 2 if missing; running `pnpm alchemy:dev` after changes is the gate.

## Stack Map

High-level view of phases, commit counts, and deploy gates.

```
Phase 1  ─ Sources + Roster (read-only)              [ 8 commits] ─ deploy gate 1
Phase 2  ─ Email-Locked Single-Send                  [18 commits] ─ deploy gate 2
Phase 3  ─ Rounds + Round Builder                    [ 9 commits] ─ deploy gate 3
Phase 4  ─ Email Composer + Template Library         [ 7 commits] ─ deploy gate 4
Phase 5  ─ Series Global Integration                 [ 4 commits] ─ deploy gate 5
Release  ─ Migration consolidation + ADR/lat.md sync [ 2 commits] ─ final merge
                                                      ───────────
                                                      48 commits
```

Per-phase granularity expands below. The "Depends on" column lists the commit(s) a given entry builds on; any commit not listed depends only on the immediately prior commit.

---

## Phase 1 — Sources + Roster (read-only)

Organizer declares qualification sources for a championship and sees the unified roster. **No ability to send yet.** End-state: roster table renders with cutoff line, sources tab is editable, sidebar shows the new "Invites" nav entry.

ADR reference: Phase 1 in `docs/adr/0011-competition-invites.md`, mockups `project/invites/sources.jsx` + `project/invites/leaderboard.jsx` + `project/invites/chrome.jsx`.

### 1.1 `feat(invites): add competition_invite_sources schema`
- **Scope:** `src/db/schemas/competition-invites.ts` (new), wire into `src/db/schema.ts`. Only the `competitionInviteSourcesTable` — no invites/rounds/templates yet.
- **Includes:** `commonColumns`, ULID `$defaultFn`, indexes `(championshipCompetitionId, sortOrder)`, `(sourceCompetitionId)`, `(sourceGroupId)`.
- **DB action:** apply the `CREATE TABLE` DDL to the PlanetScale `competition-invites` branch via the PlanetScale MCP. Do **not** run `pnpm db:push`. Verify the table landed on-branch before merging. No migration file committed mid-stack.
- **Tests:** none (pure schema).

### 1.2 `feat(invites): add sources CRUD helpers + write-time constraint`
- **Scope:** `src/server/competition-invites/sources.ts` — `listSourcesForChampionship`, `createSource`, `updateSource`, `deleteSource`. Implement the "exactly one of `sourceCompetitionId` / `sourceGroupId`" constraint in the helper (not in DB).
- **Tests:** `test/server/competition-invites/sources.test.ts` — CRUD happy path, constraint violation, delete with in-use sources.
- **Depends on:** 1.1.

### 1.3 `feat(invites): add source server functions with permission gating`
- **Scope:** `src/server-fns/competition-invite-fns.ts` (new file) — `listInviteSourcesFn`, `createInviteSourceFn`, `updateInviteSourceFn`, `deleteInviteSourceFn`. Each wrapped in `withRequestContext` and `requireTeamPermission(MANAGE_COMPETITIONS)` on *both* the championship's and source's organizing team.
- **Tests:** `test/server-fns/competition-invite-fns.sources.test.ts` — cross-org permission denial (organizer without `MANAGE_COMPETITIONS` on source comp gets 403).
- **Depends on:** 1.2.
- **Notes:** Skill references — `server-fn-auth`, `permissions`, `logging`.

### 1.4 `feat(invites): add invite-sources list + form components`
- **Scope:** `src/components/compete/organizer/invite-sources-list.tsx`, `invite-source-form.tsx`. Two source kinds (single-comp, series). Allocated-spots summary card matching `project/invites/sources.jsx`.
- **Tests:** light component tests for form validation (exactly one of compId/groupId, required `globalSpots` for single-comp).
- **Depends on:** 1.3.

### 1.5 `feat(invites): add invite organizer route shell with sources tab`
- **Scope:** `src/routes/compete/organizer/$competitionId/invites/index.tsx` with tabs (Roster, Sources, stubs for Round History, Email Templates, Series Global). Sources tab is live; other tabs render "Coming soon" placeholders. Sidebar nav gains "Invites" entry under Athletes with no badge yet.
- **Tests:** loader-level check that `MANAGE_COMPETITIONS` is enforced on the route.
- **Depends on:** 1.4.

### 1.6 `feat(invites): add roster computation (source rows only, no invite state)`
- **Scope:** `src/server/competition-invites/roster.ts` — `getChampionshipRoster({ championshipId, divisionId, filters })`. Loads sources, delegates to `getCompetitionLeaderboard` / `getSeriesLeaderboard`, applies division mapping, computes qualifying set, returns `RosterRow[]` with `sourcePlacement`/`sourcePlacementLabel` populated. Invite-state columns return `null` for now.
- **Tests:** `test/server/competition-invites/roster.test.ts` — aggregation across single-comp + series, division mapping, cutoff line insertion, skip-already-qualified for series global.
- **Depends on:** 1.2.

### 1.7 `feat(invites): expose roster server function + render roster table`
- **Scope:** `getChampionshipRosterFn` added to `competition-invite-fns.ts`. `championship-roster-table.tsx` component — RankCell, AthleteAvatar, SourceTag, StatusPill (everything `not_invited` for now), FilterChips, dashed cutoff row. Wire into the Roster tab on the route added in 1.5.
- **Tests:** basic render test.
- **Depends on:** 1.5, 1.6.

### 1.8 `feat(invites): add series-source per-comp + global sub-tabs (read-only)`
- **Scope:** Within the Sources tab, series sources render both per-comp tabs and a series-global tab displaying raw leaderboard positions. Invite-state columns stay empty. `SeriesGlobalView` visual from `project/invites/app.jsx` minus invite pills.
- **Tests:** none (covered by component + route tests; snapshot optional).
- **Depends on:** 1.7.

### Deploy Gate 1 — Sources + Roster

**Verification checklist** (mirrors ADR Phase 1 checklist):
- [ ] Organizer adds single-comp source pointing at another of their competitions.
- [ ] Organizer adds series source pointing at one of their series.
- [ ] Organizer with `MANAGE_COMPETITIONS` on championship but not source cannot reference that source (403).
- [ ] Roster renders with athletes ordered by source priority, cutoff at division capacity.
- [ ] Series source renders both per-comp tabs and series-global tab.

**Release action:** stack merges to `feat/competition-invites`, not to `main`. At phase close, run `pnpm db:generate --name=competition-invite-sources` against the current Drizzle schema file and commit the generated migration — this is record-of-intent only; the actual promotion to prod happens via PlanetScale deploy request at the end of the whole effort (see **R.1** / **Migration strategy** below).

---

## Phase 2 — Email-Locked Single-Send Invites

Organizer picks roster rows (or staged bespoke invitees), clicks Send, and athletes can claim end-to-end via email-locked tokens. **No round concept yet** — every send is a one-off "Round 1" that lives in metadata only.

This is the largest phase. It splits into four sub-arcs (schema + tokens, issue + bespoke, claim flow, auth + registration + delivery) each of which could be merged in isolation.

### Sub-arc A: Schema + Tokens + Issue

#### 2.1 `feat(invites): add competition_invites schema`
- **Scope:** Extend `src/db/schemas/competition-invites.ts` with `competitionInvitesTable`. All columns per ADR "Database Schema" section including `activeMarker`, `claimTokenHash`, `claimTokenLast4`, `sendAttempt` (int not null default 0), `origin`, `bespokeReason`. Status enum is `pending | accepted_paid | declined | expired | revoked` — no `accepted` state, no `acceptedAt` column. Unique indexes: `(championshipCompetitionId, email, championshipDivisionId, activeMarker)`, `claimTokenHash`; secondary `(roundId)`, `(sourceId)`, `(origin)`, `(status)`, `(email)`. Note: `roundId` is `varchar(255) NOT NULL` with a placeholder default that Phase 3 rewrites to FK-style.
- **DB action:** apply DDL (create table + indexes) to the `competition-invites` PlanetScale branch via the MCP. Re-verify index shape on-branch — the active-marker unique index is the critical correctness guarantee for this feature.
- **Tests:** none.

#### 2.2 `feat(invites): add token generation + hashing helpers`
- **Scope:** `src/lib/competition-invites/tokens.ts` — 32-byte URL-safe random token generator (Web Crypto `crypto.getRandomValues` + base64url), SHA-256 hash, `last4` extraction. Pure functions, no I/O.
- **Tests:** `test/lib/competition-invites/tokens.test.ts` — determinism of hash, collision-resistance sanity (1000-generation uniqueness check), last4 format.

#### 2.3 `feat(invites): add invite issue helpers`
- **Scope:** `src/server/competition-invites/issue.ts` — `issueInvitesForRecipients({ championshipId, divisionId, recipients, roundLabel, subject, bodyJson, rsvpDeadlineAt })` and `reissueInvite({ inviteId, newExpiresAt })`. Issue: transactional flow via `INSERT ... ON DUPLICATE KEY UPDATE` keyed on the active-marker unique index, returns `{ inserted, alreadyActive }`. Re-issue: rotates `claimTokenHash`/`claimTokenLast4`, increments `sendAttempt`, bumps `expiresAt`, flips `status` back to `"pending"` (and restores `activeMarker = "active"`) if it had expired. Both paths **reject when the target division's resolved registration fee is $0** — free comps are not eligible for invites in the MVP. Neither path enqueues email (that's 2.11). Email normalization (`email.trim().toLowerCase()`) applied at write.
- **Tests:** `test/server/competition-invites/issue.test.ts` — token hashing, idempotency (second call with same recipients = no-ops), division pre-attach, source vs bespoke origin tagging, email normalization, re-issue rotates token + increments `sendAttempt` + preserves `invite.id`, free-comp rejection.
- **Depends on:** 2.1, 2.2.

#### 2.4 `feat(invites): add bespoke invite staging helpers`
- **Scope:** `src/server/competition-invites/bespoke.ts` — `createBespokeInvite`, `createBespokeInvitesBulk`. Single-add validates `(championshipId, email, divisionId)` uniqueness, bulk parses CSV *and* TSV (per open-question 5 resolution). Duplicates returned as structured errors, not exceptions. Creates **draft** rows (`status = "pending"`, `roundId = ""` sentinel) not-yet-sent.
- **Tests:** `test/server/competition-invites/bespoke.test.ts` — single-add validation, bulk CSV + TSV parse, dedup against existing invites, source-leaderboard-vs-bespoke dedup precedence.
- **Depends on:** 2.3.

### Sub-arc B: Claim Resolution + Athlete Routes

#### 2.5 `feat(invites): add claim resolution logic`
- **Scope:** `src/server/competition-invites/claim.ts` — `resolveInviteByToken(tokenPlaintext)` (hashes + lookup), `assertInviteClaimable(invite)` (status, expiry, competition still accepting), `identityMatch(session, invite)` returning `{ ok: true } | { ok: false, reason: "wrong_account" | "needs_sign_in" | "needs_sign_up" }`. The function that transitions an invite to `accepted` happens inside the registration path (2.13), so claim.ts is read-side-only here.
- **Tests:** `test/server/competition-invites/claim.test.ts` — wrong-account rejection, email-lock, expired-token rejection, double-claim defense (token nulled on `accepted_paid`), case-insensitive email match.
- **Depends on:** 2.3.

#### 2.6 `feat(invites): add claim landing route (signed-in paths)`
- **Scope:** `src/routes/compete/$slug/claim/$token.tsx`. Loader calls `resolveInviteByToken` + `identityMatch`. Renders the pre-attached registration page (championship + division, waivers, checkout button) when signed in as the correct email. Renders the "wrong account" page when signed in as a different email (with sign-out + sign-in-as CTA). Sign-in / sign-up redirects land here in 2.7.
- **Tests:** loader unit tests for the three branches.
- **Depends on:** 2.5.

#### 2.7 `feat(invites): extend sign-in + sign-up for claim param`
- **Scope:** `src/routes/_auth/sign-in.tsx` and `sign-up.tsx` accept `?email=...&claim=...`. When `claim` is present: email field pre-filled and read-only; on successful auth, redirect is `/compete/<slug>/claim/<token>` so the claim re-runs with the new session. Sign-up path uses the existing placeholder-user claim primitive (see team-memory architecture note on `sign-up?claim=<token>` flow).
- **Tests:** integration test: signed-out + no-account → `/sign-up?email=&claim=` → complete form → redirected to claim → invite accepts.
- **Depends on:** 2.6.

#### 2.8 `feat(invites): add claim decline + invite-pending routes`
- **Scope:** `src/routes/compete/$slug/claim/$token/decline.tsx` (explicit decline, same identity-match rules, sets `status = "declined"`, `declinedAt = now`, nulls `claimTokenHash` + `activeMarker`). `src/routes/compete/$slug/invite-pending.tsx` (informational page shown to athletes who arrive signed-in-as-wrong-account).
- **Tests:** decline route unit tests for identity-match + status transition.
- **Depends on:** 2.6.

### Sub-arc C: Registration + Stripe Workflow + Queue

#### 2.9 `feat(invites): extend initiateRegistrationPaymentFn with inviteToken`
- **Scope:** `src/server-fns/registration-fns.ts` — `initiateRegistrationPaymentFn` gains optional `inviteToken` Zod param. When present: (a) re-validates invite + email match, (b) skips registration-window check, (c) runs invite-aware capacity rule (pending invites don't consume, `accepted_paid` does), (d) tags the `commercePurchase` with `inviteId` in Stripe metadata. No invite status transition happens here — the row stays `pending` until the webhook confirms payment. Free-comp path is **rejected upstream at `issueInvitesFn`** (target division fee = $0 is a hard error), so no synchronous-flip path exists.
- **Tests:** unit tests for the four branches; integration test deferred to 2.18.
- **Depends on:** 2.5.

#### 2.10 `feat(invites): propagate inviteId through Stripe checkout workflow`
- **Scope:** `src/workflows/stripe-checkout-workflow.ts` — the "send-teammate-invitations" discrete step already exists (team-memory architecture note); here we add an "update-competition-invite-status" step that reads `inviteId` from purchase metadata and sets `status = "accepted_paid"`, `paidAt = now`, `claimedRegistrationId = <new registration id>` after the registration row is created. Idempotent — safe on workflow retry.
- **Tests:** unit tests for the workflow step in isolation.
- **Depends on:** 2.9.

#### 2.11 `feat(invites): extend email queue consumer for invite discriminator`
- **Scope:** `src/workers/email-queue-consumer.ts` — add a `kind: "competition-invite"` handler that calls Resend with `Idempotency-Key: invite-${inviteId}-${sendAttempt}` (the `sendAttempt` suffix is what lets a re-send with the same `inviteId` actually dispatch) and updates `emailDeliveryStatus` on `queued → sent | failed`. Reuses existing Resend client + DLQ plumbing from broadcasts.
- **Tests:** unit test for the message-shape parse + `Idempotency-Key` header assertion; queue-consumer integration test extended.
- **Depends on:** 2.1.

#### 2.12 `feat(invites): add React Email component library + default template`
- **Scope:** `src/react-email/competition-invites/` — `<InviteHero />`, `<EventCard />`, `<ClaimButton />` (server-injects URL), `<DeadlineFooter />`, `<InviteFooter />`. Add the seeded system-default template JSON as a constant (the DB row lands in Phase 4; for Phase 2 the constant is the body source). `renderInviteEmail({ invite, round, championship, body })` in `src/lib/competition-invites/render.ts` produces `{ html, text }`.
- **Tests:** `test/lib/competition-invites/render.test.ts` — happy-path render, text fallback, unknown-variable literal rendering.
- **Depends on:** 2.1.
- **Notes:** Engineer-side preview via `pnpm email:dev` against this directory.

#### 2.13 `feat(invites): add issue + decline + resolve server functions`
- **Scope:** `competition-invite-fns.ts` gains `issueInvitesFn` (calls 2.3 + 2.12 + enqueues via 2.11), `getInviteByTokenFn` (calls 2.5), `declineInviteFn`. `issueInvitesFn` is transactional: insert invites → render per-recipient email → enqueue → mark `emailDeliveryStatus = "queued"`. Over-allocation warnings are advisory metadata on the return value.
- **Tests:** server-fn-level tests for permission gating, transactional guarantees, queue-enqueue-count assertion with a mock queue.
- **Depends on:** 2.3, 2.5, 2.11, 2.12.

#### 2.14 `feat(invites): add bespoke server functions`
- **Scope:** `createBespokeInviteFn`, `createBespokeInvitesBulkFn` (parses CSV + TSV, returns `{ created, duplicates, invalid }`).
- **Tests:** server-fn-level permission + dedup tests.
- **Depends on:** 2.4.

### Sub-arc D: Organizer UI + Cron

#### 2.15 `feat(invites): add bespoke invite dialogs`
- **Scope:** `src/components/compete/organizer/add-bespoke-invitee-dialog.tsx`, `bulk-add-invitees-dialog.tsx`. Single-add form (email required, name + reason optional, division pre-filled). Bulk-add paste box accepting CSV or TSV; row-level error display for duplicates. Wired into the Roster tab header.
- **Tests:** component tests for form validation + dialog open/close flow.
- **Depends on:** 2.14, Phase 1.

#### 2.16 `feat(invites): add roster selection + single-send UX`
- **Scope:** Roster table gains selection checkboxes (from 1.7 scaffold) and a "Send invites" button in the header that opens a simple send dialog (subject, deadline, uses seeded default body — no composer yet). Status pills reflect real invite state (via 2.13). Row tinting per `STATUS_META` in `project/invites/leaderboard.jsx`. Bespoke section renders inline below source sections.
- **Tests:** component tests for selection state + send-dialog submission.
- **Depends on:** 2.13, 2.15.

##### 2.16.1 Tab UX evolution: Candidates + Sent

Follow-up to 2.16 (no schema changes, behind the same `competition-invites` flag). See `docs/plans/0011-invites-candidates-and-sent-tabs.md` for the full plan.

- The "Roster" tab in the organizer route shell is renamed to **Candidates**. Pairs cleanly with the Sources tab; the underlying server-side helpers (`getChampionshipRoster`, `RosterRow`, `championship-roster-table.tsx`) keep their names since they describe a join across source-competition leaderboards, not a registered list.
- A new **Sent** tab is added between Sources and the disabled Round History placeholder. It groups every issued invite (active + terminal) by championship division using a new `listAllInvitesFn` server fn, with status counters per card and page-level filters (status / origin / free-text search). Per-row action is read-only "copy live claim link" — revoke / reissue / resend stay in the round builder (Phase 3 / sub-arc D).
- The new server fn returns an `AuditInviteSummary` DTO that extends `ActiveInviteSummary` with `divisionLabel` (joined from `scalingLevels`), `sourcePlacementLabel`, and `lastUpdatedAt` (mapped from the row's `updatedAt` — the table has no dedicated `lastSentAt` column today and `updatedAt` is the closest available signal of "last activity").

#### 2.17 `feat(invites): add invite-expiry cron sweep`
- **Scope:** `src/workflows/invite-expiry-workflow.ts` (or plain handler). Paginates `status = "pending" AND expiresAt < now`, transitions them to `"expired"`, nulls `claimTokenHash` + `activeMarker`. Wire as hourly Cron Trigger in `alchemy.run.ts`.
- **Tests:** `test/workflows/invite-expiry.test.ts` — sweep correctness, idempotency, pagination.
- **Depends on:** 2.1.

#### 2.18 `test(invites): add full claim-flow integration test`
- **Scope:** `test/integration/invite-claim-flow.test.ts`. Exercises: signed-in-right-email → claim → checkout → `accepted_paid`; signed-out-no-account → sign-up → claim → checkout → `accepted_paid`; signed-in-wrong-email → rejection page. Both source and bespoke origins. Mocks Stripe + Resend at network boundary.
- **Depends on:** 2.7, 2.10, 2.13, 2.16.

### Deploy Gate 2 — Email-Locked Single-Send

**Verification checklist** (mirrors ADR Phase 2):
- [ ] Organizer selects sourced rows → click Send → Resend receives messages with `Idempotency-Key: invite-<id>`.
- [ ] Organizer adds bespoke invitee via single-add dialog → draft row appears → include in single-recipient send → claim email works.
- [ ] Bulk CSV + TSV paste stages drafts; duplicates reported inline.
- [ ] Bespoke dedup wins over source leaderboard for the same (email, division).
- [ ] Claim link signed-in-right-email → pre-attached registration → Stripe → `accepted_paid`. Tested for source + bespoke.
- [ ] Claim link signed-in-wrong-email → rejection page.
- [ ] Signed-out + no account → `/sign-up?email=&claim=` → pre-filled + read-only email → new account → auto-claim.
- [ ] Reading DB doesn't yield reusable tokens (only hashes stored).
- [ ] Expiry cron flips pending invites to `expired`; expired link shows expired page.
- [ ] No round table yet — all invites attached to a placeholder `roundId` sentinel.

**Release action:** `pnpm db:generate --name=competition-invites-phase-2` → commit. Record-of-intent only; production promotion is via the PlanetScale deploy request at R.1.

---

## Phase 3 — Rounds + Round Builder

Sends become wave-based with subject/body/deadline metadata. The right-rail round builder UI from `project/invites/round-builder.jsx` and the timeline from `project/invites/rounds-timeline.jsx` go live.

### 3.1 `feat(invites): add competition_invite_rounds schema + backfill roundId`
- **Scope:** Add `competitionInviteRoundsTable` to `competition-invites.ts`. Drop the placeholder `roundId` default from 2.1 and introduce a real FK-style column. Backfill: every Phase-2 invite gets assigned to a synthetic "Round 1 — Backfill" row per championship (write a one-shot migration script in `src/scripts/backfill-invite-rounds.ts`).
- **DB action:** apply `CREATE TABLE` for rounds + column alteration for `competition_invites.roundId` to the `competition-invites` PlanetScale branch via the MCP. Run the backfill script (`bun src/scripts/backfill-invite-rounds.ts`) against the branch — the branch's isolation keeps any Phase-2 test data in the preview env from leaking into main. Because PlanetScale is Vitess-backed, confirm the column-alter is online (no table rewrite) before applying.
- **Tests:** unit test for the backfill script against a fixture DB.

### 3.2 `feat(invites): add round CRUD + state-machine helpers`
- **Scope:** `src/server/competition-invites/rounds.ts` — `createRoundDraft`, `updateRoundDraft` (only when `status = "draft"`), `sendRound` (the `SELECT ... FOR UPDATE` guarded transition `draft → sending → sent|failed`). The revoke-then-reissue flow: if a recipient already has an active invite for the same division, transition it to `revoked` (null `activeMarker` + `claimTokenHash`) in the **same transaction** that inserts the new row.
- **Tests:** `test/server/competition-invites/rounds.test.ts` — state-machine, `SELECT ... FOR UPDATE` double-click defense, atomic revoke+reissue, partial-failure rollback.
- **Depends on:** 3.1.

### 3.3 `feat(invites): route invite-issue through rounds`
- **Scope:** Update `issueInvitesFn` (2.13) to require a `roundId`. The Phase-2 "send button" on the roster page now creates an implicit draft round, sets its metadata from the send dialog, and calls `sendRound`. Single-send UX unchanged from the user's perspective, but every invite is now attached to a real round row.
- **Tests:** updated server-fn tests; integration test 2.18 updated to assert round attribution.
- **Depends on:** 3.2.

### 3.4 `feat(invites): add round server functions`
- **Scope:** `competition-invite-fns.ts` — `createRoundDraftFn`, `updateRoundDraftFn`, `sendRoundFn`, `listRoundsFn`, `getRoundDetailFn`, `revokeInviteFn`.
- **Tests:** permission gating + state-machine assertions.
- **Depends on:** 3.2.

### 3.5 `feat(invites): add round builder right-rail component`
- **Scope:** `src/components/compete/organizer/round-builder/` — selected-list (count + chip list), round-meta form (label, subject, deadline, body placeholder — composer arrives in Phase 4), recipients chips, sticky send button, over-allocation advisory. Matches the layout in `project/invites/round-builder.jsx` modulo the body-composer (which shows a "Use default template" read-only card in Phase 3).
- **Tests:** component tests for selected-list state + send-button disabled states.
- **Depends on:** 3.4.

### 3.6 `feat(invites): add smart-select quick actions`
- **Scope:** Quick-add buttons in the round builder. Implementations:
  - "Re-invite non-responders" — selects all invites from the most recent sent round with `status IN (pending, expired, revoked)`.
  - "Next 5 / Next 10 on leaderboard" — the next N roster rows below cutoff not yet invited.
  - "All draft bespoke invitees" — every bespoke row with no active invite.
- **Tests:** unit tests on the selector-set helpers (pure functions over roster + invite arrays).
- **Depends on:** 3.5.

### 3.7 `feat(invites): add rounds timeline view`
- **Scope:** `src/components/compete/organizer/rounds-timeline.tsx` — vertical timeline, progress bars stacked (ticket/accepted/pending/declined/expired), per-round StatTick row, draft-next-round placeholder. Matches `project/invites/rounds-timeline.jsx`. Wire into a new tab on the invites route.
- **Tests:** snapshot + data-shape test.
- **Depends on:** 3.4.

### 3.8 `feat(invites): add rounds routes + revoke row action`
- **Scope:** `src/routes/compete/organizer/$competitionId/invites/rounds.tsx` (timeline + builder rail) and `rounds/$roundId.tsx` (round detail — recipients grouped by source vs bespoke, status breakdown). Roster rows gain a "Revoke" action when `status = pending`.
- **Tests:** route loader tests + revoke e2e smoke.
- **Depends on:** 3.4, 3.7.

### 3.9 `test(invites): add multi-round integration test`
- **Scope:** `test/integration/round-builder-flow.test.ts`. R1 sends to 5 source + 2 bespoke → 3 accept, 2 pending, 1 declined, 1 expired → R2 uses "Re-invite non-responders" + "Next 5" + "All draft bespoke" → verifies R1 tokens dead on next click, R2 tokens issued, each athlete has exactly one active invite.
- **Depends on:** 3.6, 3.8.

### Deploy Gate 3 — Rounds

**Verification checklist** (mirrors ADR Phase 3):
- [ ] R1 sends populate round metadata; history view renders progress bar.
- [ ] R2 draft pre-selects non-responders via quick action.
- [ ] R2 draft pre-selects next-N on leaderboard.
- [ ] R2 draft pre-selects all draft bespoke invitees.
- [ ] Round detail mixes sourced + bespoke visually grouped.
- [ ] R2 to athletes with active R1 revokes R1 token in same transaction as R2 insert.
- [ ] Round edit blocked once `status ≠ draft`.
- [ ] Manual revoke on pending works; link dies.
- [ ] Double-click Send is idempotent; partial-send retry clean.

**Release action:** `pnpm db:generate --name=competition-invite-rounds` → commit. Record-of-intent only; production promotion is via the PlanetScale deploy request at R.1.

---

## Phase 4 — Email Composer + Template Library

Structured composer over the React Email components. Organizer-saved templates per organizing team.

### 4.1 `feat(invites): add competition_invite_email_templates schema + system default`
- **Scope:** Add `competitionInviteEmailTemplatesTable`. Seed one `isSystemDefault = true` row per environment via a migration seed script (idempotent — check by `(isSystemDefault, organizingTeamId IS NULL)`).
- **DB action:** apply DDL to the `competition-invites` PlanetScale branch via the MCP. Seed script runs as part of app startup the first time; for the shared branch, run it manually once after DDL lands so the default row is present for preview testing.
- **Tests:** seed-idempotency test.

### 4.2 `feat(invites): finalize render + variable resolution`
- **Scope:** Finalize `src/lib/competition-invites/render.ts` (from 2.12) — complete variable resolution (`{athlete_name}`, `{source}`, `{deadline}`, `{championship_name}`, `{division}`, `{spots_remaining}`, `{claim_url}`), text fallback derivation via `@react-email/render`'s text mode, unknown-variable literal rendering + save-time console warning.
- **Tests:** full matrix of `render.test.ts` — every variable, unknown-variable, text fallback, HTML safety (no organizer HTML leakage).
- **Depends on:** 4.1.

### 4.3 `feat(invites): add template server functions + preview fn`
- **Scope:** `competition-invite-fns.ts` — `listTemplatesFn`, `createTemplateFn`, `updateTemplateFn`, `deleteTemplateFn` (blocks delete of system default), `previewInviteEmailFn` (resolves against a sample athlete payload supplied by the caller).
- **Tests:** permission gating — only `MANAGE_COMPETITIONS` on the organizing team; system-default mutation rejection.
- **Depends on:** 4.2.

### 4.4 `feat(invites): add email composer structured form`
- **Scope:** `src/components/compete/organizer/email-composer/` — cards for Hero, EventCard, CTA, FooterNote. Each card edits the relevant slice of `InviteBodyJson`. No freeform HTML input. Zod validation on body shape.
- **Tests:** component state-shape tests.
- **Depends on:** 4.3.

### 4.5 `feat(invites): add email preview modal`
- **Scope:** `src/components/compete/organizer/email-preview-modal.tsx` — mock email-client frame (From/To/Subject header, hero, event card, CTA, contact footer) + right-rail Variables panel listing `{athlete_name}`, `{source}`, `{deadline}`, `{claim_url}` resolved against a sample athlete from the round. **No tone toggle / tone-comparison panel.**
- **Tests:** snapshot test of resolved preview shape.
- **Depends on:** 4.4.

### 4.6 `feat(invites): add email templates route`
- **Scope:** `src/routes/compete/organizer/$competitionId/invites/email-templates.tsx`. List/create/edit/delete organizer templates. System-default row is locked (edit button reads "Clone to customize").
- **Tests:** route-level permission gating.
- **Depends on:** 4.5.

### 4.7 `feat(invites): wire composer into round builder`
- **Scope:** Round builder's body slot from 3.5 becomes a real composer. Template picker dropdown (templates + "Start from scratch"). Preview button opens the modal from 4.5. Round draft with no template falls back to seeded system default.
- **Tests:** integration test — compose custom body → send → Resend receives correctly-rendered HTML.
- **Depends on:** 4.6.

### Deploy Gate 4 — Composer + Templates

**Verification checklist** (mirrors ADR Phase 4):
- [ ] Organizer saves custom template scoped to their org.
- [ ] Seeded system default renders unchanged across rounds.
- [ ] Preview modal matches sent email (modulo client quirks).
- [ ] Round draft with no template picked falls back to system default.

**Release action:** `pnpm db:generate --name=competition-invite-templates` → commit. Record-of-intent only; production promotion is via the PlanetScale deploy request at R.1.

---

## Phase 5 — Series Global Integration

Direct-qualified annotation + global-slot positioning on the series-global tab.

### 5.1 `feat(invites): add series global roster logic`
- **Scope:** `src/server/competition-invites/series-roster.ts` — `getSeriesGlobalRosterForChampionship({ championshipId, divisionId })`. Classifies each athlete as `direct_qualified` (on a throwdown's top-`directSpotsPerComp` within the source's division mapping), `global_candidate` (next `globalSpots` not direct-qualified), or neither. Attaches current invite state per row.
- **Tests:** `test/server/competition-invites/series-roster.test.ts` — direct-qualified skip logic, per-source spot allocation, division-mapping propagation.

### 5.2 `feat(invites): add series global server fn`
- **Scope:** `getSeriesGlobalRosterFn`. Permission-gated per standard pattern.
- **Tests:** permission test.
- **Depends on:** 5.1.

### 5.3 `feat(invites): add series global leaderboard UI`
- **Scope:** `src/components/compete/organizer/series-global-leaderboard.tsx`. Columns: #, Athlete, Best finish (SourceTag + detail), Points, Status (either "Direct-qualified" disabled pill or `GLB N/M` chip + StatusPill). Selection checkbox disabled with tooltip for direct-qualified. Matches `SeriesGlobalView` in `project/invites/app.jsx`.
- **Tests:** snapshot + disabled-selection test.
- **Depends on:** 5.2.

### 5.4 `feat(invites): add series route + quick-add filter`
- **Scope:** `src/routes/compete/organizer/$competitionId/invites/series.tsx`. Round builder's "Next N on leaderboard" for a series source uses `getSeriesGlobalRosterFn` and excludes direct-qualified rows.
- **Tests:** route-level + quick-add exclusion test.
- **Depends on:** 5.3.

### Deploy Gate 5 — Series Global

**Verification checklist** (mirrors ADR Phase 5):
- [ ] Direct-qualified athletes show pill + unselectable.
- [ ] Next `globalSpots` get `GLB N/M` chip + recommendation.
- [ ] Per-comp vs global toggle shows consistent invite-state pills.

**Release action:** no new tables — `pnpm db:generate` should report a no-op. If drift appears, investigate before R.1.

---

## Release — Finalization

### R.1 `chore(invites): open PlanetScale deploy request + consolidate migrations`
- **Scope:** Production schema promotion. The `competition-invites` PlanetScale branch has carried every DDL change since Commit 1.1; at release time it gets promoted to `main` via a **deploy request** opened from the PlanetScale dashboard (or via the MCP if supported). Drizzle migration files committed per phase are code-side record-of-intent; PlanetScale owns the actual DDL apply on production. Before opening the deploy request:
  1. Diff the `competition-invites` branch against `main` on PlanetScale — the diff should match the union of the per-phase Drizzle migrations.
  2. If drift exists (e.g. a DDL applied on-branch but never reflected in the Drizzle schema file), reconcile by running `pnpm db:generate --name=competition-invites-final` and committing the delta so code and DB agree.
  3. Open the deploy request; have a reviewer approve; run the deploy.
  4. After deploy, delete the `competition-invites` PlanetScale branch.
- **Tests:** a clean-room replay — spin up a throwaway PlanetScale branch from `main`, run every committed Drizzle migration in order (`pnpm db:migrate:local` pointed at the throwaway), and verify the resulting schema matches what the deploy request produced. Catches any drift between code and branch.

### R.2 `docs(invites): accept ADR-0011, update lat.md, update sidebar badges`
- **Scope:** ADR frontmatter `status: accepted`, date = accept date. Add `lat.md/competition-invites.md` describing the shipped system (sources, rounds, invites, claim flow, capacity rule, token model). Update `lat.md/registration.md` cross-references. Run `lat check`. Sidebar "Invites" nav gains pending-badge count from `project/invites/chrome.jsx`.
- **Tests:** `lat check` passes.
- **Depends on:** R.1.

---

## Cross-Cutting Concerns

### Migration strategy

PlanetScale-branch-based, not Drizzle-migration-based for prod apply.

- **Dedicated PlanetScale branch.** All DDL for this effort goes to the shared `competition-invites` branch, cut from `main` at prerequisite step 4. The preview Cloudflare env points `DATABASE_URL` at this branch for the duration of the work. No developer runs `pnpm db:push` against their own branch — everyone converges on the shared branch so claim-flow testing, email sends, and round-builder QA all see the same schema state.
- **Applying DDL.** Schema changes are issued to the `competition-invites` branch through the **PlanetScale MCP** (`mcp__planetscale__*` tools). Typical per-commit flow:
  1. Author/modify the Drizzle schema in `src/db/schemas/competition-invites.ts`.
  2. Via the MCP, run the corresponding `CREATE TABLE` / `ALTER TABLE` / `CREATE INDEX` against the `competition-invites` branch.
  3. Verify the schema on-branch (MCP query: `DESCRIBE competition_invites`, `SHOW INDEX FROM competition_invites`).
  4. Commit the Drizzle schema file. Do **not** run `pnpm db:push`; do **not** commit a migration file yet.
- **Per-phase migration file.** At each phase's deploy gate, run `pnpm db:generate --name=<phase-scope>` once to produce a Drizzle migration that captures what PlanetScale applied on-branch. Commit it. This is the code-side record of intent — it's what reviewers diff against to confirm the Drizzle schema and the branch agree.
- **Drift detection.** If `pnpm db:generate` at a phase gate produces SQL you didn't expect, it means the MCP-applied DDL and the schema file drifted. Resolve before moving to the next phase: either re-apply the correct DDL via MCP, or update the schema file to match reality.
- **Production promotion (R.1).** A single PlanetScale **deploy request** from `competition-invites` → `main` at the end of the whole effort. The per-phase Drizzle migrations serve as a human-readable audit log; they are not individually applied to prod via `pnpm db:migrate`. PlanetScale's deploy-request review is the last gate.
- **Local development.** Engineers working on the code-side of commits point their local `DATABASE_URL` at the shared `competition-invites` branch via `.dev.vars`. If strict isolation is needed (e.g. running tests that mutate schema), cut a sub-branch *from* `competition-invites` for that engineer only and delete when done.

### Rollback strategy

Because prod schema doesn't change until R.1, pre-release rollback is free: the `competition-invites` PlanetScale branch can be reset or deleted without touching `main`. Post-release rollback splits into code-side and schema-side:

- **Code-side rollback (any phase, any time).** Feature-flag `competition_invites_enabled` on the organizing team gates Phase 1+ organizer UI. Flipping off hides the feature; athlete-facing claim routes stay live because in-flight tokens must still resolve.
- **Pre-R.1 schema rollback.** Discard the `competition-invites` PlanetScale branch and recut from `main`. No prod impact because prod still runs on pre-invites schema. Code-side: revert the Drizzle schema file commits and the generated migration files.
- **Post-R.1 schema rollback.** PlanetScale deploy-request **revert** from `main`. This is a fresh deploy request in the opposite direction — not a blind drop — and requires the same review gate. Per-phase flavor:
  - **Phase 1 only deployed:** drop `competition_invite_sources`. No athlete impact (no invites yet).
  - **Phase 2 deployed:** nulls in `claimTokenHash` leave invite rows intact but dead. Prefer code-side feature-flag flip over schema rollback, because dropping `competition_invites` deletes audit history organizers may still need.
  - **Phase 3 deployed:** rounds rollback via revert deploy request; invites stay attached to the backfilled synthetic Round-1 rows — re-applying Phase 3 later re-links them.
  - **Phase 4 deployed:** template table drop is safe; rounds keep their frozen `bodyJson` from send time.
  - **Phase 5 deployed:** UI-only — feature-flag flip is sufficient, no schema revert needed.

### Feature-flag story

A single `competition_invites_enabled` entitlement on the organizing team gates Phase 1+ organizer-side UI. Athlete-side claim routes are *not* flag-gated — once a token is in the wild, it must resolve. Flag toggling is done via the existing team-entitlements admin UI; default-off until all phases ship.

### Test strategy per layer (Testing Trophy)

- **Unit:** token hashing, render + variable resolution, selector-set helpers, identity-match pure function, claim state-machine transitions.
- **Integration:** every claim path (2.18), multi-round flow (3.9), composer-to-send (4.7), series-global exclusion (5.4). These cross ≥2 of (server fn, DB, UI, workflow).
- **E2E (Playwright):** one happy-path at release — organizer creates championship → adds source → builds Round 1 → sends → athlete claims → checkout → registration shows in organizer roster as `accepted_paid`. Covers the primary user journey end-to-end but is not per-commit gated (too slow).

### Observability

Every server function emits:
- `logEntityCreated` on invite/round/source/template creation.
- `logEntityUpdated` on status transitions (`pending → accepted_paid`, `* → revoked/expired/declined`, `expired → pending` on re-send with `sendAttempt` increment).
- `logInfo` with the `inviteId` / `roundId` / `tokenLast4` as request-context attributes.
- `logError` on claim-resolution failures and send-transaction rollbacks — the error object includes the attempted `email` (lowercased) and `championshipId` for debugging.

See `logging` skill for correlation-id patterns.

### Review expectations

- Each stacked PR targets ≤500 LOC of non-generated diff, ~1h review budget.
- Phase 2 is the heaviest review phase — expect to split Sub-arc B (claim + auth) as a separate stack branch that rebases onto the tail of Sub-arc A if reviewer bandwidth is a constraint.
- Each deploy gate must have both code review approval *and* one manual verification pass against the preview environment before the next phase starts stacking.

---

## Risk Register

| Risk | Detected where | Mitigation |
|---|---|---|
| Token-hash collision or reuse after status transition | 2.2, 2.3 | `claimTokenHash` unique; MySQL allows multiple NULLs so terminal transitions null the column safely. Secondary: the `activeMarker` index ensures only one active row per (championship, email, division). |
| Race: 12 athletes claim 10 spots at once | 2.9, 2.10 | Capacity check fires inside the Stripe webhook / registration-creation step. Losers hit the existing "division just filled" refund path; invite stays `pending` so the organizer can extend later. No intermediate `accepted` state. Documented in ADR Capacity Math section. |
| Partial send crashes mid-round | 2.13, 3.2 | Round stays `draft` on transactional rollback. `INSERT ... ON DUPLICATE KEY UPDATE` keyed on active-marker index makes retry idempotent. Consumer retries use `Idempotency-Key`. |
| Cross-org source fishing | 1.3 | `createInviteSourceFn` requires `MANAGE_COMPETITIONS` on *both* championship and source orgs. Unit-tested in 1.3. |
| Wrong-account claim bypass | 2.5, 2.7 | Identity-match is server-side in the claim loader; sign-in/sign-up routes lock the email field when `?claim=` is present. Redirect after auth re-runs the loader, which re-validates. |
| Organizer impersonation via DB access | 2.2 | Only hashes stored; plaintext tokens exist only in Resend-delivered email bodies. `claimTokenLast4` is support-facing, not sufficient for claim. |
| Backfill breakage when Phase 3 adds `roundId` | 3.1 | Synthetic "Round 1 — Backfill" per championship; one-shot script covered by unit test; run against the `competition-invites` PlanetScale branch first. Because prod schema doesn't change until R.1, a bad backfill on-branch is recoverable without prod impact — just reset the branch and re-run. |
| Schema drift between Drizzle file and PlanetScale branch | Migration strategy, every phase gate | `pnpm db:generate` at each phase gate surfaces drift as unexpected SQL. Fix by re-applying correct DDL via MCP or updating the schema file before advancing. Non-negotiable gate — no phase closes with unexplained drift. |
| Deploy-request promotion fails or diverges from migrations | R.1 | Pre-R.1 clean-room replay (throwaway branch from `main`, apply every committed Drizzle migration in order) must produce the same schema as the deploy-request diff. Mismatch = stop, reconcile, replay. |
| Email deliverability variance | 2.12, 4.2 | Mirror broadcast Resend pattern exactly; rely on existing bounce/complaint webhooks. Release-time Litmus smoke is listed as out-of-automated-scope in ADR Phase 4 tests. |
| Performance of N+1 leaderboard fetches in roster | 1.6 | Bounded (≤5 sources × ~hundreds of rows). KV cache on `(sourceId, divisionId, source-data-version)` deferred per ADR; add only if p95 regression shows. |

---

## Open Questions Carried from ADR

Must be resolved before the phase they gate. Repeated here because they change commit behavior.

| # | Gate phase | Question | Suggested default |
|---|---|---|---|
| 1 | Before 2.3 | Athlete already has paid registration — skip / issue no-op / hard-block? | **Skip with warning.** |
| 2 | Before 2.3 | Multi-division in one round? | **Yes** — distinct invites per `championshipDivisionId`. |
| 3 | Before 4.1 | Templates per-org vs per-championship? | **Per-org.** |
| 4 | Before 2.4 | Bespoke + source dedup — show secondary source info? | **No, stay clean.** |
| 5 | Before 2.4 | Bulk import — CSV only or CSV + TSV? | **Both.** |
| 6 | Before 1.3 | Cross-org sources — same-org only for MVP? | **Same-org only.** |
| 7 | Before 3.2 | `rsvpDeadlineAt` timezone interpretation? | **Championship TZ at write; render in championship + recipient TZ.** |

---

## Summary

- **48 commits** across 5 phases + 2 release commits.
- **5 deploy gates** — Phase 1, Phase 2, Phase 3, Phase 4, Phase 5 — each independently shippable.
- **4 new tables** — sources, invites, rounds, email templates.
- **4 cross-cutting extensions** — Stripe checkout workflow, email queue consumer, sign-in/sign-up auth routes, registration fn.
- **1 Cron Trigger** — hourly invite-expiry sweep.
- **1 React Email component library** — 5 branded components + 1 seeded system template.

The stack depth reflects the reality that sources → roster → invites → rounds → composer is a genuinely linear dependency chain. Parallelism is possible within Phase 2's sub-arcs if reviewer bandwidth allows; all other phases serialize cleanly.
