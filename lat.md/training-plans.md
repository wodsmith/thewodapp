# Weekly Training Plans

Athlete-owned weekly proposals persist across clients without creating live sessions. A versioned flexible blueprint carries unresolved decisions until an explicit revision-bound commit.

## Durable Drafts

Drafts belong to a user, never to a second athlete identity scoped by team. Creation, reads, updates, previews, and deletion of a draft do not write canonical personal sessions.

[[packages/wodsmith-training/src/plans/service.ts#createTrainingPlanService]] receives the database and authenticated actor explicitly. Its composition root supplies current authorization and canonical preparation, validation, and save operations. There is no model, arbitrary-code executor, or mandatory MCP conversation state.

Every read returns the plan ID, revision, status, document, missing inputs, questions, warnings, suggested next actions, and summary. Updates replace the bounded document with an expected revision. Row locks serialize changes; another athlete receives not-found rather than proposal contents. Only uncommitted drafts can be deleted. Committed proposals remain available with their durable receipt.

Owner-only listing returns compact IDs, titles, week starts, status, and revision in descending ID order. Optional status filtering and an opaque cursor bound pages to fifty rows, defaulting to twenty. Listing rechecks authorization even for an empty owner and checks every returned draft's contexts.

The owner-and-ID index follows the listing cursor so pages can seek within an athlete's drafts without sorting that owner's entire collection.

## Blueprint and Intent

The general-functional-fitness@1 blueprint organizes optional roles without choosing scoring rules. Its item schema comes from canonical training validation rather than a parallel workout definition.

The recommended order is warm-up, optional strength or skill, optional conditioning, then cooldown or mobility. No role is required for every session. A compact question catalogue supplies availability, duration, equipment, source, and substitution examples; hosts ask only when missing information changes the proposal.

[[packages/wodsmith-training/src/plans/blueprint.ts#createTrainingPlanSchema]] bounds documents to seven calendar days, forty items per day, fifty questions, fifty constraints, and 256 KB at the service boundary. Each date occurs once regardless of source context. Week start is explicit and need not be Monday.

Each day declares `accessTeamId` as an access context and chooses `train`, `rest`, or `leave_open`. Train replaces the reviewed personal composition, rest explicitly saves an empty composition, and leave-open performs no canonical write. A rest proposal is personal intent, not a claim that a provider published a rest day. Omitted dates remain unchanged.

Roles and duration estimates are optional metadata. Source, personal-remix, and library references retain canonical identity and complete scoring definitions. Questions and day-specific constraints persist in the draft; required unanswered questions and unresolved constraints block commit. Resolving or waiving a constraint requires an explanation. Nothing automatically saves permanent athlete preferences.

Omitting role or duration preserves saved metadata. An explicit null clears the selected field. Organizational metadata can change after a score is recorded without changing the performed prescription or result snapshot.

## Preview and Commit

A deterministic SHA-256 digest binds the draft ID, revision, document, and server-prepared review. Commit must match the supplied preview and revalidate canonical state while holding transaction locks.

Preview is read-only. It resolves current access, affected personal-session revisions, sources, and proposed changes through the canonical service. The digest is review identity, not evidence of human approval. Array order remains significant; object-key order does not.

Commit locks the draft, rechecks current authorization and revision, locks and validates the prepared canonical batch, saves through the shared transaction-aware writer, records a receipt, and marks the proposal committed in one database transaction. No independent per-day transactions are permitted. Failure rolls back every attempted day and the receipt. Performed snapshots remain the canonical writer's responsibility.

The weekly commit explicitly uses READ COMMITTED isolation. Authorization can read before waiting for an athlete lock; after that wait, canonical validation must observe the winning transaction rather than an older REPEATABLE READ snapshot. The canonical writer also locks and validates its current inputs.

Idempotency keys are hashed and scoped by authenticated owner and operation. The durable payload hash binds the plan, revision, and preview digest. An identical retry returns the original result; another payload with the same key fails. Authorization is checked again even for retries. Concurrent updates invalidate earlier previews rather than overwriting a newer proposal.

Receipt JSON records a trusted origin: web, or agent with the authenticated client and grant IDs. Tool inputs cannot set this attribution. A successful retry from another currently authorized client retains the original origin rather than claiming the retrying client performed the write.

## Migration and Deployment

Migration 0010 adds draft and receipt tables without changing existing sessions, results, or ownership. It follows 0009 composition state and precedes 0011 agent grants.

Apply `packages/wodsmith-db/mysql-migrations/0010_training_plans.sql` with the repository migration workflow before enabling planning operations. The generated snapshot and journal include both tables. No live database migration or deployment is performed by this change. The future athlete/day identity consolidation is separate from these tables.

## Canonical Adapter

The Start adapter passes plan replacements to the shared personal-session batch writer. It never opens independent per-day transactions or copies canonical mutation logic into planning.

[[apps/wodsmith-start/src/server/training-plans.ts#createTrainingPlanningService]] reuses the production item schema, transfers role and duration metadata, and supplies current session baselines. Every access context requires current membership and tracking entitlement. Agent calls additionally require a live-grant callback, including inside the commit transaction.

The initial adapter explicitly supports an unambiguous existing workspace day. Another owned composition on the same date in a different workspace fails with a generic conflict, including when that other workspace is outside the grant. It does not claim that the underlying team/day storage has been migrated. Source-team context remains explicit through the day's access team.

## Verification

Pure validation and disposable MySQL integration tests exercise the planning boundary. Canonical adapter tests separately establish integration with the existing session writer.

The suite lives under Start's integration glob and creates a random database, applies the actual 0010 SQL, and drops only that database. It accepts the existing loopback/socket test configuration and never application credentials. Start's database CI requires MySQL and runs on changes to the training package. Local proof uses MySQL 9.2; CI uses MySQL 8.0. Neither alone proves deployed Vitess transaction limits.

### Blueprint and Validation

Validation preserves complete capped multi-round workout definitions and rejects impossible dates, dates outside the week, duplicate days, ambiguous rest items, and unexplained constraint resolutions.

### Draft Isolation and Resumption

Draft questions survive a new client read while other athletes cannot retrieve or delete the proposal. Reads and draft creation leave live sessions empty.

### Draft Concurrency and Deletion

Concurrent updates at the same revision allow only one winner. Stale deletion fails, and deleting a current uncommitted draft changes no live session.

### Atomic Commit and Retry

A failure after the first day rolls back the full week and its receipt. Successful retry creates the bounded week once; concurrent identical retries return the same outcome and changed payloads cannot reuse the key.

### Stale Review and Revocation

Source changes, live-day revisions, and revoked access invalidate a previously previewed proposal before the canonical save. Open days remain untouched and unresolved constraints prevent commit.

### Canonical Mixed Week

Real canonical saves preserve source occurrence and moved date, optional role and duration, complete capped library scoring, and durable duplicate-retry receipts. Preview and draft creation leave canonical session tables empty.

### Cross Draft Idempotency

Two different drafts racing for one owner/key produce one canonical outcome. The losing transaction rolls back and reports a stable key-reuse conflict instead of a raw uniqueness error.

### Portable Draft Discovery

A second client can find an athlete's proposals with bounded cursor pages without holding the original create response. Pages exclude other owners and reject revoked access even when no drafts exist.

### Canonical Rollback and History

A later performed-item conflict rolls back an earlier attempted day. Explicit rest lists removed items in preview while retaining the performed prescription and private result notes.

### Canonical Source and Access Conflicts

Source republication, revoked membership, revoked grants, and ambiguous cross-workspace days reject canonical planning writes. Another athlete cannot read the plan or reuse its successful receipt.

### Scored Item Metadata Changes

Role and duration changes, including explicit-null clearing, preserve saved source/library definitions and the scored personal item's result. Organizational metadata does not count as changing its performed prescription.

### Concurrent Canonical Contexts

Two drafts for the same athlete/date in different workspaces cannot both commit after concurrent authorization. The regression reproduced two successes under REPEATABLE READ; explicit READ COMMITTED permits only one receipt and day.

### Preserved Library Preview

When a library workout changes after being saved in a personal composition, preview describes the stored definition that commit will preserve. Current access is still required; changing the library does not silently rewrite the saved prescription.
