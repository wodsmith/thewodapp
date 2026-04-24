# Competition Invites

ADR-0011 ships a qualification-source → roster → invite-round system for championship competitions. Organizers declare where invitees come from, see a unified roster from those sources, and — later — send email-locked invites in waves.

Phase 1 is read-only: declarative sources, a roster table that joins source leaderboards with invite-state columns set to null, and the organizer route shell. Schema lives in [[apps/wodsmith-start/src/db/schemas/competition-invites.ts]]. ADR reference: `docs/adr/0011-competition-invites.md`.

Phase 2 (in progress) lays the data + logic groundwork for email-locked single-send invites: per-athlete invite rows in `competition_invites`, SHA-256-hashed claim tokens, server-side issue + reissue helpers, and bespoke staging. Routes, Stripe workflow wiring, email queue, and the organizer UI follow in the remaining sub-arcs.

## Sources schema

A qualification source attached to a championship competition. Each row references either a single competition or a series (never both); allocation and division-mapping columns describe how many invitees the source contributes.

Defined by [[apps/wodsmith-start/src/db/schemas/competition-invites.ts#competitionInviteSourcesTable]] with three indexes — `(championshipCompetitionId, sortOrder)` drives the Sources tab list, `(sourceCompetitionId)` lets us find every championship a given source competition feeds, and `(sourceGroupId)` does the same for series. ULID primary keys generated via [[apps/wodsmith-start/src/db/schemas/common.ts#createCompetitionInviteSourceId]]. No FKs (PlanetScale convention).

## Sources helpers

Server-side CRUD helpers for the sources table live in [[apps/wodsmith-start/src/server/competition-invites/sources.ts]]. `listSourcesForChampionship`, `createSource`, `updateSource`, `deleteSource`, and `getSourceById` compose the CRUD surface.

The write-time constraint "exactly one of `sourceCompetitionId` / `sourceGroupId`" is enforced in [[apps/wodsmith-start/src/server/competition-invites/sources.ts#assertSourceReferenceValid]], not at the DB, because PlanetScale has no check constraints and a typed `InviteSourceValidationError` from one boundary is cleaner than mixing DB and validation errors. `updateSource` re-runs the validator against the post-patch shape so a partial update that breaks the rule fails before reaching the DB.

## Source server fns

The organizer endpoints live in [[apps/wodsmith-start/src/server-fns/competition-invite-fns.ts]] — `listInviteSourcesFn`, `createInviteSourceFn`, `updateInviteSourceFn`, `deleteInviteSourceFn` — gated by `MANAGE_COMPETITIONS` on the championship's organizing team.

`listInviteSourcesFn` returns the source rows plus resolved display lookups: `competitionNamesById` (for single-comp sources), `seriesNamesById` (for series sources), and `seriesCompCountsById` (number of competitions in each referenced series). The counts feed [[apps/wodsmith-start/src/components/organizer/invites/invite-sources-list.tsx]]'s `allocatedSpotsFor`, which computes a series' total contribution as `directSpotsPerComp * compCount + globalSpots` — `directSpotsPerComp` is per-comp so scaling by the series size matters for multi-comp series.

When a source references another competition or series, [[apps/wodsmith-start/src/server-fns/competition-invite-fns.ts#requireSourcePermissions]] also requires `MANAGE_COMPETITIONS` on that source's organizing team. Per ADR Open Question 6 (same-org only for MVP) the two organizing teams must currently match; cross-org references throw. The policy lives in the server fn so a future phase can relax it by deleting a single check. Each fn wraps its handler in `withRequestContext` so `logEntityCreated` / `logEntityUpdated` / `logEntityDeleted` calls carry correlation IDs.

## Roster computation

`getChampionshipRoster({ championshipId, divisionId })` in [[apps/wodsmith-start/src/server/competition-invites/roster.ts]] returns an ordered `RosterRow[]` for a championship + division. Invite-state columns are `null` in Phase 1.

The function loads all sources, delegates to [[apps/wodsmith-start/src/server/competition-leaderboard.ts#getCompetitionLeaderboard]] for single-comp sources and [[apps/wodsmith-start/src/server/series-leaderboard.ts#getSeriesLeaderboard]] for series sources, resolves each source's division mapping, and flags rows below each source's spot allocation as `belowCutoff`. Pure helpers (`parseDivisionMappings`, `resolveSourceDivisionId`, `resolveSpotsForDivision`, `aggregateQualifyingRows`) are extracted and unit-tested directly so the cutoff + skip-already-qualified logic can be exercised without mocking the leaderboard stack. The server fn `getChampionshipRosterFn` gates this with `MANAGE_COMPETITIONS` on the championship.

Series sources have two qualifier tiers handled by `loadSeriesDirectRows` and `loadSeriesGlobalRows`. Direct qualifiers come from each comp's own leaderboard — the source's `directSpotsPerComp` × number of comps in the series. Globals come from the series-aggregate leaderboard with direct qualifiers filtered out. The per-comp division for each comp is resolved via [[apps/wodsmith-start/src/db/schemas/series.ts#seriesDivisionMappingsTable]]; the resulting source cutoff expands to `directCount + globalSpots` so both tiers count as qualified for the `belowCutoff` waterline.

"Already qualified" in [[apps/wodsmith-start/src/server/competition-invites/roster.ts#aggregateQualifyingRows]] means fully qualified in a higher-priority source — being on a prior source's waitlist does not block the same athlete from qualifying in a later source. When a later source promotes a previously waitlisted athlete, the earlier waitlist row is removed so each athlete appears at most once (qualified rows win; waitlist rows dedupe across sources).

## Organizer route shell

The Phase-1 organizer route is [[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/invites/index.tsx]]. It renders five tabs — Roster, Sources, Round History, Email Templates, Series Global — with Roster and Sources live and the others placeholders for later phases.

The loader loads sources, divisions, and the first division's roster in parallel via `Promise.all` and passes them to child components. The sidebar ([[apps/wodsmith-start/src/components/competition-sidebar.tsx]]) gains an "Invites" entry under the Athletes section. Series sources within the Sources tab render per-comp tabs plus a series-global tab via [[apps/wodsmith-start/src/components/organizer/invites/series-source-sub-tabs.tsx]] — Phase 1 is read-only, so the component receives data from the loader rather than fetching its own, and invite pills are deliberately omitted until Phase 2.

## Feature-flag gate

Both the sidebar link and the route page are gated on the PostHog feature flag `competition-invites`. When disabled the link is hidden from [[apps/wodsmith-start/src/components/competition-sidebar.tsx]] and the route component redirects to the competition overview.

Pattern mirrors the existing `competition-global-leaderboard` gate in [[apps/wodsmith-start/src/routes/compete/organizer/series/$groupId/leaderboard.tsx]] — `posthog.isFeatureEnabled()` seeds state, `posthog.onFeatureFlags()` subscribes to flag updates. The gate only compares `=== true` / `=== false` so the `undefined` pre-load state neither shows the link nor triggers a redirect, avoiding flicker.

## Invites schema

Each invite is a per-athlete row in [[apps/wodsmith-start/src/db/schemas/competition-invites.ts#competitionInvitesTable]] carrying the email-locked claim token, status, and origin attribution. ULID primary keys via [[apps/wodsmith-start/src/db/schemas/common.ts#createCompetitionInviteId]].

The `activeMarker` column is the correctness pivot: it holds the literal `"active"` while `status IN (pending, accepted_paid)` and is NULL on every terminal state. Combined with the unique index `(championshipCompetitionId, email, championshipDivisionId, activeMarker)` this enforces "at most one active invite per (championship, division, email)" while letting declined/expired/revoked rows accumulate (MySQL treats multiple NULLs as distinct). The unique index on `claimTokenHash` exploits the same semantics — terminal transitions null the hash so historical rows coexist. `sendAttempt` (default 0) is the re-send counter that drives the Resend `Idempotency-Key` suffix; reusing `invite.id` across re-issues stays safe because the suffix rotates.

Draft bespoke rows (created before any send) use a distinctive shape: `activeMarker = "active"`, `claimTokenHash = NULL`, `expiresAt = NULL`, `emailDeliveryStatus = "skipped"`. The unique-active index blocks duplicate bespoke adds for the same (championship, division, email). Secondary indexes cover the organizer table queries — `(roundId)`, `(sourceId)`, `(origin)`, `(status)`, `(email)`, plus `(championshipCompetitionId)` and `(userId)` for roster-side joins.

Phase 2 uses `roundId = ""` as a sentinel pending the Phase 3 `competition_invite_rounds` table; the column is NOT NULL with a default of `""` so a Phase-3 backfill can rewrite every Phase-2 row to a synthetic "Round 1 — Backfill" without schema gymnastics.

## Token helpers

Claim tokens are 32-byte URL-safe random strings, hashed with SHA-256 before they touch the DB. Helpers live in [[apps/wodsmith-start/src/lib/competition-invites/tokens.ts]].

[[apps/wodsmith-start/src/lib/competition-invites/tokens.ts#generateInviteClaimTokenPlaintext]] uses `crypto.getRandomValues` + base64url-no-padding (via `@oslojs/encoding`) so every character carries entropy and the result is safe in a URL path; [[apps/wodsmith-start/src/lib/competition-invites/tokens.ts#hashInviteClaimToken]] returns lowercase hex that matches the `varchar(64)` column exactly; [[apps/wodsmith-start/src/lib/competition-invites/tokens.ts#inviteClaimTokenLast4]] exposes the support-facing display suffix. The one-shot [[apps/wodsmith-start/src/lib/competition-invites/tokens.ts#generateInviteClaimToken]] returns `{ token, hash, last4 }` so all three artifacts derive from the same plaintext and the plaintext never has a chance to escape the email path. Pure functions — safe to call from server functions, workflows, queue consumers, and tests.

## Issue helpers

The DB-side-only layer that writes invite rows lives in [[apps/wodsmith-start/src/server/competition-invites/issue.ts]]. It never renders HTML and never enqueues — that belongs to the `issueInvitesFn` server fn in a later sub-arc.

[[apps/wodsmith-start/src/server/competition-invites/issue.ts#issueInvitesForRecipients]] runs in a single transaction: it snapshots existing active invites for the recipient emails, treats matches as `alreadyActive` (annotated with `isDraft` when the row has no `claimTokenHash` yet so the caller can choose to reissue instead of skip), and inserts fresh rows for the rest. Each new row carries a freshly generated token hash, `activeMarker = "active"`, `status = "pending"`, and `sendAttempt = 0`. The return shape `{ inserted, alreadyActive }` hands the caller the *plaintext* tokens for the just-inserted rows — the only moment the plaintext exists in process memory before it's templated into an outgoing email.

[[apps/wodsmith-start/src/server/competition-invites/issue.ts#reissueInvite]] rotates the token on an existing row in place, increments `sendAttempt`, bumps `expiresAt`, restores `activeMarker = "active"`, and flips `expired` rows back to `pending`. It covers both the "extend an expired invite" path and the "activate a draft bespoke invite" path (draft rows have `claimTokenHash = NULL`; reissue installs the first token). Preserving `invite.id` across rotations keeps Stripe metadata, webhook correlation, and audit queries stable. Both helpers reject via [[apps/wodsmith-start/src/server/competition-invites/issue.ts#FreeCompetitionNotEligibleError]] when the target division resolves to a $0 registration fee — free competitions are scope-trimmed out of invites in the MVP (ADR-0011 "Capacity Math → Free competitions").

[[apps/wodsmith-start/src/server/competition-invites/issue.ts#normalizeInviteEmail]] (trim + lowercase) is the canonical normalizer — applied at every write, every lookup, and every identity match so the email lock compares apples to apples.

## Bespoke helpers

Bespoke staging lives in [[apps/wodsmith-start/src/server/competition-invites/bespoke.ts]]. A draft bespoke invite stages a row the organizer can later include in a send; it has the distinctive "active but no token" shape described in "Invites schema".

[[apps/wodsmith-start/src/server/competition-invites/bespoke.ts#createBespokeInvite]] validates the email format, rejects free divisions, checks the unique-active invariant, and inserts a draft row. [[apps/wodsmith-start/src/server/competition-invites/bespoke.ts#createBespokeInvitesBulk]] accepts a paste body — CSV, TSV (Google Sheets paste), or one-email-per-line — parses rows via [[apps/wodsmith-start/src/server/competition-invites/bespoke.ts#parseBespokePaste]], normalizes emails, dedups within-batch, checks cross-batch against existing active invites, and inserts the survivors. Duplicates and invalid rows come back as `BulkDuplicateRow[]` / `BulkInvalidRow[]` — structured results, not exceptions — so the organizer UI can render row-level inline feedback. The paste is capped at `BESPOKE_BULK_MAX_ROWS` (500, per ADR-0011 OQ#8).

The line parser auto-detects delimiter per line — tab wins when present so a Google Sheets column paste keeps comma-containing fields intact — and skips literal header rows whose first column is `email` (case-insensitive). A division-hint column is accepted for copy-paste compatibility but ignored in Phase 2 (the caller always passes `championshipDivisionId` explicitly).

## Claim resolution

Read-side helpers for the `/compete/$slug/claim/$token` route live in [[apps/wodsmith-start/src/server/competition-invites/claim.ts]] (DB reads) and [[apps/wodsmith-start/src/server/competition-invites/identity.ts]] (pure helpers route files can import without dragging `getDb` into the client bundle).

The split exists because Vite chokes on `cloudflare:workers` when bundling client code, and `getDb` transitively imports it. Route files import only from `identity.ts`; server-side callers can use either module.

[[apps/wodsmith-start/src/server/competition-invites/claim.ts#resolveInviteByToken]] hashes the plaintext token via [[apps/wodsmith-start/src/lib/competition-invites/tokens.ts#hashInviteClaimToken]] and looks up the row on `claimTokenHash`. It returns `null` on miss so the route can render the generic "invalid link" page without leaking whether a hash ever existed. [[apps/wodsmith-start/src/server/competition-invites/identity.ts#assertInviteClaimable]] throws [[apps/wodsmith-start/src/server/competition-invites/identity.ts#InviteNotClaimableError]] when status, `claimTokenHash`, `expiresAt`, or `activeMarker` fail the live checks — each terminal state maps to a distinct `reason` (`expired`, `declined`, `revoked`, `already_paid`, `not_found`) so the route can render tailored copy.

[[apps/wodsmith-start/src/server/competition-invites/identity.ts#identityMatch]] is the pure email-lock gate. Given `{ email }` from the session (or `null`) plus the invite plus an `accountExistsForInviteEmail` boolean (resolved by the caller against `userTable`), it returns the discriminated result the route loader branches on: `{ ok: true }`, `{ ok: false, reason: "wrong_account" | "needs_sign_in" | "needs_sign_up" }`. Case-insensitive on both sides so `Mike@Example.com` and `mike@example.com` compare equal.

## Claim routes

The athlete-facing surfaces live under `apps/wodsmith-start/src/routes/compete/$slug/claim/`.

Phase 2 sub-arc B wires three pages: `$token.tsx` (claim landing), `$token/decline.tsx` (explicit decline), and a sibling `invite-pending.tsx` page for wrong-account recovery.

`$token.tsx` is the entry point clicked from the email. The loader calls [[apps/wodsmith-start/src/server-fns/competition-invite-fns.ts#getInviteByTokenFn]] — a public (session-free) server fn that resolves the token, confirms the invite's championship slug matches the URL (anti-typo guard), and returns either `{ kind: "not_claimable", reason }` or `{ kind: "claimable", invite, championshipName, divisionLabel, accountExistsForInviteEmail }`. The loader then runs `identityMatch` against `context.session`. The four-way branch is: happy-path → render pre-attached registration CTA; `wrong_account` → render "this invite is for a different account" page; `needs_sign_in` / `needs_sign_up` → `redirect` into `/sign-in?redirect=…&email=<invite.email>&invite=<token>` (or sign-up equivalent) so post-auth re-entry lands back on the claim page with a session that matches.

`$token/decline.tsx` uses the same loader branches, then POSTs through [[apps/wodsmith-start/src/server-fns/competition-invite-fns.ts#declineInviteFn]] on confirmation. The server fn re-runs resolve + identity-match (server is the authority — a forged POST can't bypass email-lock) before calling [[apps/wodsmith-start/src/server/competition-invites/decline.ts#declineInvite]], which transitions `pending → declined` and nulls `activeMarker` + `claimTokenHash` so the link dies immediately. Declines are idempotent at the DB level: a zero-affected-rows outcome re-reads to tell "already terminal" apart from "row missing".

`invite-pending.tsx` is the landing that wrong-account visitors bounce to after signing out and back in — it tells them to re-open the email rather than guessing a URL. The claim route's wrong-account page also links here via `/sign-in?redirect=/compete/$slug/invite-pending&email=<invite.email>`.

## Email delivery

Invite emails ride the existing broadcast queue binding (`BROADCAST_EMAIL_QUEUE`) with a discriminator.

[[apps/wodsmith-start/src/server/broadcast-queue-consumer.ts]] exports a union `QueueEmailMessage = BroadcastEmailMessage | InviteEmailMessage` and dispatches per-message on the `kind` field. Broadcast messages without `kind` stay backward-compatible.

[[apps/wodsmith-start/src/server/broadcast-queue-consumer.ts#InviteEmailMessage]] carries one invite per message (HTML is pre-rendered per-recipient because each claim URL is unique). The consumer calls Resend with `Idempotency-Key: invite-<inviteId>-<sendAttempt>` so re-sends after an extend/reissue actually dispatch — the suffix rotates on each attempt, preventing Resend from silently deduplicating. Delivery outcome flips `competition_invites.emailDeliveryStatus` to `sent` / `failed` (with `emailLastError` captured). The message is acked on failure to avoid duplicate sends on transient 5xx retries — organizers see the failure state on the roster and choose to re-send.

In dev (no `RESEND_API_KEY`) the consumer logs the preview and marks delivery as `skipped` so seeded + test flows don't block on external HTTP.

[[apps/wodsmith-start/src/react-email/competition-invites/invite-email.tsx]] renders the branded email: hero/headline, division + source + deadline card, primary claim CTA, and a secondary decline link. The subject + body text are organizer-supplied at send time (Phase 2 uses a single default; Phase 4 introduces templates).

## Send pipeline

[[apps/wodsmith-start/src/server-fns/competition-invite-fns.ts#issueInvitesFn]] is the organizer's send button. Permission: `MANAGE_COMPETITIONS` on the championship's organizing team. Steps:

1. Resolves the championship, division, and organizing team display data.
2. Calls [[apps/wodsmith-start/src/server/competition-invites/issue.ts#issueInvitesForRecipients]] to insert new rows and detect `alreadyActive` overlaps. Free divisions are rejected here (ADR-0011 "Capacity Math").
3. For each `alreadyActive` row flagged `isDraft: true` (bespoke drafts with no token yet) calls [[apps/wodsmith-start/src/server/competition-invites/issue.ts#reissueInvite]] to activate — rotates in a fresh token, sets `expiresAt`, bumps `sendAttempt` from 0 to 1.
4. Renders email HTML per invite via [[apps/wodsmith-start/src/server-fns/competition-invite-fns.ts]]'s `renderInviteEmailHtml` — claim URL embeds the plaintext token (the only place it escapes process memory) and the decline URL is `<claim>/decline`.
5. Enqueues `InviteEmailMessage` per invite onto `BROADCAST_EMAIL_QUEUE`. In dev without the binding, logs instead of sending.
6. Returns `{ sentCount, skipped }` where `skipped` is non-draft `alreadyActive` rows the caller chose not to re-issue.

[[apps/wodsmith-start/src/server-fns/competition-invite-fns.ts#createBespokeInviteFn]] and [[apps/wodsmith-start/src/server-fns/competition-invite-fns.ts#createBespokeInvitesBulkFn]] wrap the helpers from [[apps/wodsmith-start/src/server/competition-invites/bespoke.ts]] with the standard permission gate and logging. Bulk returns `{ created, duplicates, invalid }` so the UI can surface row-level feedback.

## Registration hand-off + Stripe workflow

[[apps/wodsmith-start/src/server-fns/registration-fns.ts]]'s `initiateRegistrationPaymentFn` accepts an optional `inviteToken`. When supplied:

- The token is resolved + claimability-checked + email-matched against the session — any of these failing short-circuits with an error that the registration form can surface.
- The submitted `items` must be exactly the invited division — `items.length === 1 && items[0].divisionId === invite.championshipDivisionId`. Invites are pinned per division, so the server rejects both wrong-division submissions and "invited division plus extras". The registration form locks the UI to match (single read-only division, no multi-select) when `inviteToken` is present.
- The registration-window check is skipped for invite-holders (invites often precede public-open or survive past close). The form mirrors this — the `!registrationOpen` disable is bypassed for both the submit button and the form inputs (division select, affiliate, team fields, waiver toggles, question fields) when the invite lock is active. Otherwise the submit unlocks but the required fields stay frozen, and the invitee can't actually fill anything in.
- The single item's purchase metadata gets `inviteId` tagged so the Stripe workflow can flip the invite on payment success.

[[apps/wodsmith-start/src/workflows/stripe-checkout-workflow.ts]] reads `inviteId` from the purchase metadata inside `create-registration`, threads it through `RegistrationStepResult`, and runs a new `update-competition-invite-status` step after registration creation. The step flips the invite to `accepted_paid`, sets `paidAt`, sets `claimedRegistrationId`, and nulls `claimTokenHash` so a replay of the original email link short-circuits. Idempotent via the `status = "pending"` guard on the update predicate so a workflow retry doesn't double-flip. `processCheckoutInline` (local-dev path) runs the same helper to keep behavior consistent without Cloudflare Workflows.

When a 100%-off coupon zeroes the total, the registration server fn takes the `allFree` branch and skips Stripe entirely — so it mirrors the workflow flip inline right after creating the registration row. Without this, an invite-locked free checkout would leave the invite stuck in `pending` even though the athlete is registered.

## Organizer send UX

Phase 2D makes the organizer invite buttons clickable. See [[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/invites/index.tsx]] for the shell.

Three dialogs sit in [[apps/wodsmith-start/src/components/organizer/invites/add-bespoke-invitee-dialog.tsx]], [[apps/wodsmith-start/src/components/organizer/invites/bulk-add-invitees-dialog.tsx]], and [[apps/wodsmith-start/src/components/organizer/invites/send-invites-dialog.tsx]]. Add/Bulk dialogs wrap the bespoke staging server fns; Send wraps `issueInvitesFn`. The route header carries the three buttons (Add invitee / Bulk add / Send invites N); Send is disabled when no recipients are selected.

[[apps/wodsmith-start/src/components/organizer/invites/championship-roster-table.tsx]] now accepts optional `selectedKeys` / `onToggleSelection` / `onToggleAll` props. When the parent supplies them a checkbox column appears; rows with no `athleteEmail` are disabled with a "No email on file" tooltip so the organizer can't try to invite an athlete without a resolvable address. The table also takes an optional `isRowAlreadyInvited(row)` callback — when it returns true the row's status pill renders "Invited" instead of "Not invited", the checkbox is disabled with an "Already invited" tooltip, and the row is excluded from select-all so the "Send invites (N)" chip can't silently disagree with the visible checked-box count. [[apps/wodsmith-start/src/server/competition-invites/roster.ts#RosterRow]] now carries `athleteEmail` — hydrated at the end of `getChampionshipRoster` via a single bulk `userTable` lookup so the Send dialog has an email to put on each recipient.

[[apps/wodsmith-start/src/server-fns/competition-invite-fns.ts#listActiveInvitesFn]] returns a minimal `ActiveInviteSummary` projection rather than full table rows — the organizer client only needs identity + classification info, so we never serialize `claimTokenHash` / `claimTokenLast4` to the browser. A `hasClaimToken` boolean carries forward the "draft vs already-sent" distinction the bespoke section needs.

The draft-bespoke section renders inline below the roster table, pulling from `listActiveInvitesFn`. Checked draft rows flow into the recipient list alongside selected source rows; the Send dialog shows a union of both with a recipient-count chip. After a successful send the route invalidates so the just-activated bespoke rows fall off the draft list (they now have tokens).

## Registration hand-off from claim

The claim route's "Continue to registration" CTA now links to `/compete/$slug/register?invite=<token>&divisionId=<id>`.

The register route's `validateSearch` accepts both `invite` (the plaintext token) and `divisionId` (the invited division — invites are locked to one division at issue time). The route forwards both into `RegistrationForm` as the `inviteToken` and `inviteDivisionId` props. When both are present and the division resolves against the competition's scaling group, the form treats the registration as invite-locked: it pre-seeds `selectedDivisionIds = [inviteDivisionId]`, seeds the team-entry map for team divisions, and replaces the multi-select dropdown with a read-only "Invited Division" display. The closed-window banner and submit-button "Registration Closed" copy are also bypassed in this mode so the registration-window-skip from the server fn isn't visually contradicted. Combined with the purchase-metadata + Stripe-workflow wiring from sub-arc C, this closes the Organizer Send → athlete claim → Stripe → `accepted_paid` loop end-to-end.

## Invite expiry sweep

[[apps/wodsmith-start/src/server/competition-invites/expiry.ts#sweepExpiredInvites]] paginates expired pending invites and flips them to `expired` in batches.

On each row it nulls `activeMarker` + `claimTokenHash` so the link dies immediately and the unique-active index unblocks a future re-invite.

Idempotent: the update predicate re-asserts `status = "pending"` so a status change that happened between the candidate SELECT and the UPDATE doesn't get stomped. The `transitioned` count returned to the cron handler reads `rowsAffected` / `affectedRows` off the driver result rather than `ids.length` — when the re-check predicate filters out a candidate the actual transitioned count is what we want to log/alert on, not the optimistic SELECT size. Intended for hourly Cloudflare Cron Trigger wiring — Phase 2D ships the helper; the alchemy cron configuration lands with the round-builder in Phase 3 (when expiry semantics broaden to per-round deadlines).

## Auth route extensions for invites

Sign-in and sign-up accept `?email=<email>&invite=<token>` in addition to their existing search params. See [[apps/wodsmith-start/src/routes/_auth/sign-in.tsx]] and [[apps/wodsmith-start/src/routes/_auth/sign-up.tsx]].

When `invite` is present the email field is pre-filled from `email` and locked (disabled) so the user can't accidentally sign in / sign up with a different address — the whole point of the email-lock is that only this address can claim the invite.

We deliberately use `invite` rather than the existing `claim` param. `claim` is reserved for the KV-backed placeholder-user flow (see `/sign-up` + `validateClaimTokenFn` in [[apps/wodsmith-start/src/server-fns/auth-fns.ts]]), where the token is a plaintext KV entry pointing at an existing `users` row. Invite tokens are hashed at DB and the user account may not exist yet, so the lookup mechanism and post-auth behavior differ enough that collapsing both into one param would muddy both flows. Post-signup the user lands at the `redirect` param — always the original `/compete/$slug/claim/$token` URL — so the claim loader re-runs with the new session cookie and resolves to `identityMatch → ok`.

## Seed data

Running `pnpm db:seed` populates `competition_invite_sources` with a ready-to-demo scenario so the organizer `/invites` route renders non-empty. Phase 1 has no source-creation UI, so seeding is the only path to exercise the live tabs.

Scenario defined by [[apps/wodsmith-start/scripts/seed/seeders/20-competition-invites.ts]]: a championship competition "2026 WODsmith Invitational" (`comp_inv_championship`) receiving invites from three sources — a Regional Qualifier (`comp_inv_qualifier`) with 5 scored Men's RX athletes + allocation 3 that triggers the roster cutoff divider, Boise Throwdown (`comp_mwfc_a`) reusing MWFC series fixtures, and the MWFC series itself to demo the Series card + sub-tabs. The seeder sits after `19-broadcasts` and its tables are cleaned ahead of competitions in [[apps/wodsmith-start/scripts/seed/cleanup.ts]] (`competition_invites` then `competition_invite_sources`).

The same seeder adds six Phase-2 `competition_invites` rows, one per lifecycle state, so the invite-row shapes are inspectable in Drizzle Studio without manual editing: a pending source-derived invite for Mike, an `accepted_paid` invite for Ryan (activeMarker still "active", claim token nulled), an `expired` invite for Alex (activeMarker NULL), a `declined` invite for Sarah, a draft bespoke invite ("active but no token" shape), and a sent bespoke invite. Tokens use deterministic plaintexts (`seed-invite-mike-pending-men-rx-phase2` / `seed-invite-ryan-expired-men-rx-phase2`) that the seeder logs on run — SHA-256 of those strings reproduces the `claim_token_hash` column so a dev can recover a working claim URL without re-running the seed.
