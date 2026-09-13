# Training application services

Training services accept a verified actor and database explicitly, allowing web requests and private agent calls to share ownership, access and scoring behavior.

## Authentication boundary

Cookie adapters retain the existing web exports. The service factories receive server-authenticated identity and canonical entitlement checks; public tool arguments cannot supply either dependency.

The actor contract lives in `@repo/wodsmith-training`. Grant actors carry client and grant identifiers, scopes and allowed team IDs. Every service operation checks its scope and current domain access. Context and private library reads respect allowed teams. Grant validation and immediate revocation belong to the private authentication adapter.

Any supplied grant field requires the complete grant shape, including both identifiers and both restriction arrays. A partial grant cannot fall back to unrestricted browser authority. Empty restrictions remain valid and deny the corresponding actions.

[[apps/wodsmith-start/src/server/training.ts#getTrainingContext]] and [[apps/wodsmith-start/src/server/training-personal.ts#getPersonalTrainingDay]] remain cookie adapters. [[apps/wodsmith-start/src/server/training-service.ts#createTrainingService]] and [[apps/wodsmith-start/src/server/training-personal-service.ts#createPersonalTrainingService]] contain the shared behavior.

## Compatibility and storage

The extraction retains existing source publication, append and undo, private results, scoring normalization, historical snapshots and optimistic composition revision behavior.

Personal storage still uses athlete, team and date. A team is an access context, not a separate athlete identity; this extraction does not claim cross-team personal-day support or add a migration. Source occurrence identity and performed dates remain distinct. Durable mutation receipts and result revisions are separate follow-on behavior.

A saved library item's identity cannot be reused for a different workout, source track, or programmed date. Changing an occurrence requires a new item ID so stored prescriptions and performed results cannot silently attach to a different occurrence.

## Verification

Existing disposable MySQL suites exercise the web adapters. Additional explicit-actor cases prove identity does not come from cookies and grant restrictions do not replace fresh membership checks.

### Cookie independent authority

An explicit actor can read training without a cookie, while a read-only grant cannot publish drafts or read outside its allowed teams. Membership revocation prevents the next read.

### Personal actor isolation

A personal service saves and reads composition without a cookie; another athlete cannot save its results and a grant without the workspace cannot read the private library.

### Atomic prepared days

Read-only preparation records the reviewed baseline and source definitions. Saving uses the caller's single transaction, preserves role and duration metadata, and rolls back every day if a later canonical write fails.

### Prepared source and identity conflicts

Source publication or composition changes invalidate a prepared batch. Alternate owned workspace days trigger a generic conflict before grant filtering, preventing hidden compositions from being overwritten or duplicated.

### Agent week privacy

The agent week response includes published programming, seven saved-or-projected personal days and only its authenticated athlete's results. It omits the web leaderboard field and other athletes' result notes.

### Partial grants fail closed

Every nonempty incomplete combination of grant fields is rejected by identity, scope, and team checks. Plain web actors remain valid, and complete grants with empty restrictions deny access.

### Library occurrence edits retain identity

Changing a saved provider occurrence under the same case-insensitive ID is rejected without changing its revision or snapshot. ID casing cannot reassign existing result identity to a different workout.

### Current identity under repeatable read

A transaction with an earlier consistent-read snapshot still observes a newly committed alternate workspace day through locking identity reads and rejects the prepared write.

## Prepared weekly writes

The planning adapter prepares bounded unique dates without writing live sessions, locks the complete source and day dependency set, and revalidates the review before using the canonical day writer in one supplied transaction.

Preparation captures prior revision and items, resolved library definitions, source publication, removed items and history retention. Rest is an explicit empty replacement; removed items retain performed history. Role and estimated duration are optional item metadata, independent of scoring.

## Database regression gate

The database integration command creates a uniquely named local schema with real indexes and generated columns, then runs the canonical and integration suites without skips.

It uses only the explicit local test connection and never application credentials. Canonical standalone suites also retain their existing opt-in disposable database URL for manual runs.

The canonical gate verifies current application behavior, not migration replay. Earlier migrations do not include the current score scaling-key column; migration lineage requires separate validation.

Weekly transactions use READ COMMITTED. Identity and source baselines use locking reads as well, so an earlier REPEATABLE READ snapshot cannot hide a newly committed alternate workspace day. This does not add a database-wide athlete/date uniqueness constraint.
