# Weekly Training Plans

Athlete-owned weekly proposals persist across clients without creating live sessions. A versioned flexible blueprint carries unresolved decisions until an explicit revision-bound commit.

## Durable Drafts

Drafts belong to a user, never to a second athlete identity scoped by team. Creation, reads, updates, previews, and deletion of a draft do not write canonical personal sessions.

[[packages/wodsmith-training/src/plans/service.ts#createTrainingPlanService]] receives the database and authenticated actor explicitly. Its composition root supplies current authorization and canonical preparation, validation, and save operations. There is no model, arbitrary-code executor, or mandatory MCP conversation state.

Every read returns the plan ID, revision, status, document, missing inputs, questions, warnings, suggested next actions, and summary. Updates replace the bounded document with an expected revision. Row locks serialize changes; another athlete receives not-found rather than proposal contents. Only uncommitted drafts can be deleted. Committed proposals remain available with their durable receipt.

## Blueprint and Intent

The general-functional-fitness@1 blueprint organizes optional roles without choosing scoring rules. Its item schema comes from canonical training validation rather than a parallel workout definition.

[[packages/wodsmith-training/src/plans/blueprint.ts#createTrainingPlanSchema]] bounds documents to seven calendar days, forty items per day, fifty questions, fifty constraints, and 256 KB at the service boundary. Each date occurs once regardless of source context. Week start is explicit and need not be Monday.

Each day declares `accessTeamId` as an access context and chooses `train`, `rest`, or `leave_open`. Train replaces the reviewed personal composition, rest explicitly saves an empty composition, and leave-open performs no canonical write. A rest proposal is personal intent, not a claim that a provider published a rest day. Omitted dates remain unchanged.

Roles and duration estimates are optional metadata. Source, personal-remix, and library references retain canonical identity and complete scoring definitions. Questions and day-specific constraints persist in the draft; required unanswered questions and unresolved constraints block commit. Resolving or waiving a constraint requires an explanation. Nothing automatically saves permanent athlete preferences.

## Preview and Commit

A deterministic SHA-256 digest binds the draft ID, revision, document, and server-prepared review. Commit must match the supplied preview and revalidate canonical state while holding transaction locks.

Preview is read-only. It resolves current access, affected personal-session revisions, sources, and proposed changes through the canonical service. The digest is review identity, not evidence of human approval. Array order remains significant; object-key order does not.

Commit locks the draft, rechecks current authorization and revision, locks and validates the prepared canonical batch, saves through the shared transaction-aware writer, records a receipt, and marks the proposal committed in one database transaction. No independent per-day transactions are permitted. Failure rolls back every attempted day and the receipt. Performed snapshots remain the canonical writer's responsibility.

Idempotency keys are hashed and scoped by authenticated owner and operation. The durable payload hash binds the plan, revision, and preview digest. An identical retry returns the original result; another payload with the same key fails. Authorization is checked again even for retries. Concurrent updates invalidate earlier previews rather than overwriting a newer proposal.

## Migration and Deployment

Migration 0010 adds draft and receipt tables without changing existing sessions, results, or ownership. It follows 0009 composition state and precedes 0011 agent grants.

Apply `packages/wodsmith-db/mysql-migrations/0010_training_plans.sql` with the repository migration workflow before enabling planning operations. The generated snapshot and journal include both tables. No live database migration or deployment is performed by this change. The future athlete/day identity consolidation is separate from these tables.

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
