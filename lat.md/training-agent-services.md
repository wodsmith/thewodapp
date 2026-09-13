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

A saved library item's identity cannot be reused for a different workout, source track, or programmed date. Changing an occurrence requires a new item ID so stored prescriptions and performed results cannot silently attach to a different occurrence. Callers must retain the exact casing of saved item IDs; case-only variants fail before append, replace, or undo behavior.

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

### Prepared library snapshots

Batch review shows the saved library definition for preserved items, matching the canonical writer after a library edit. Ordinary library items still require current workout access before they can be prepared.

Batch inputs must preserve the exact casing of saved item IDs.

### Scored item organization metadata

Source, personal and library items can set, edit or explicitly clear role and duration after scoring. Omission preserves existing metadata; null removes it. Performed definitions and result records remain unchanged.

Scored-content comparisons ignore organization metadata and normalize JSON key order, so MySQL storage ordering cannot turn an unchanged prescription into a conflict. Prescription changes still require a new item.

### Explicit loopback test addressing

The database runner preserves IPv6 loopback addresses, ports and encoded credentials when building its disposable database URL. The canonical suites accept the bracketed IPv6 URL hostname.
### Owned workout mutations

Owned library CRUD preserves the canonical scoring definition and validates references. Concurrent retries create one row; intervening web edits conflict; archival cannot erase programming or legacy history.

### Mutation authority and provenance

Mutation retries recheck grant, scope, workspace, membership and domain authority. The receipt retains the first trusted web or agent origin even when a different authorized client retries the same request.

### Atomic mutation receipts

A mutation and its retry receipt commit in one SQL transaction. A receipt insertion failure rolls back the domain write, making a subsequent retry safe.

### Owned published results

Agents can read, create, update and delete only their own published-block results. Content versions detect intervening web edits; deleting a result also removes its cheers and never changes source programming.

### Owned library round lifecycle

Library attempt edits retain canonical score rounds and values even after the library definition is archived.

Deleting a private attempt removes its score association and rounds together, while preserving the day composition and revision. Result-only rows remain projections in the week read.

### Private day and programmer mutations

Personal composition, programmer draft and publish mutations use separate scopes, expected revisions and retry receipts. Publishing requires current programmer authority even when replaying a prior success.

### Discoverable mutation contracts

The operation catalogue exposes executable canonical schemas and read or destructive annotations only for the actor's granted scopes. Incomplete grant identities fail closed before discovery.

### Archive preserves concurrent references

Archiving removes a workout from actual web and agent library selection while retaining its definition for a scheduler that read it before archival. A new scheduling request after archival is denied.

The search API also excludes archived definitions, and the ordinary workout editor locks and rejects an archived row before changing it.

### Archived composition snapshots

Archiving a library definition preserves existing personal compositions and historical attempts. Their saved definitions remain editable through the canonical history path, while new library selection is denied.

### Archived owned log correction

The legacy log editor resolves archived definitions through the athlete's owned score ID and current workout visibility.

Other users cannot use that history lookup to read the archived workout, and stale workout editors cannot rewrite the archived definition.

A forged legacy owned score pointing at an inaccessible private definition grants no read access. Only the archive filter is relaxed; membership and public/private visibility still apply.

The existing workout update unit fixture models the parent-row locking read and preserves the established missing-workout error.

### Programming receipt authority

Reading a draft or publication receipt requires programming-read scope and current programmer authority for its stored track. Knowing a receipt ID cannot expose an unpublished draft to a narrowed connection or former programmer.

## Prepared weekly writes

The planning adapter prepares bounded unique dates without writing live sessions, locks the complete source and day dependency set, and revalidates the review before using the canonical day writer in one supplied transaction.

Preparation captures prior revision and items, resolved library definitions, source publication, removed items and history retention. Rest is an explicit empty replacement; removed items retain performed history. Role and estimated duration are optional item metadata, independent of scoring.

## Database regression gate

The database integration command creates a uniquely named local schema with real indexes and generated columns, then runs the canonical and integration suites without skips.

It uses only the explicit local test connection and never application credentials. Canonical standalone suites also retain their existing opt-in disposable database URL for manual runs.

The canonical gate verifies current application behavior, not migration replay. Earlier migrations do not include the current score scaling-key column; migration lineage requires separate validation.

Weekly transactions use READ COMMITTED. Identity and source baselines use locking reads as well, so an earlier REPEATABLE READ snapshot cannot hide a newly committed alternate workspace day. This does not add a database-wide athlete/date uniqueness constraint.

## Read history scope

Agent history returns up to 100 own published results for the selected track and up to 100 personal results for the workspace. Each collection declares its scope so callers cannot mistake personal work for track-filtered history.

Stored personal snapshot metadata and input metadata share the database package type. The database package type-check command also validates the current-schema test exporter through its script-specific TypeScript configuration.
## Owned mutations and receipts

Agent mutations share canonical domain validation and SQL transactions with web writes. Personal library ownership, result ownership and programmer permissions remain separate authorization boundaries.

[[apps/wodsmith-start/src/server/training-mutations.ts#runTrainingMutation]] locks the athlete row, revalidates the live grant through the trusted adapter, rechecks current domain authority and commits the mutation with its durable receipt under READ COMMITTED. Receipt IDs hash owner, operation and idempotency key; payload hashes reject key reuse for a different normalized request. The original response and trusted client/grant origin persist together. Retrying after a grant or membership revocation fails before returning the receipt.

[[apps/wodsmith-start/src/server/training-workout-mutations.ts#createOwnedWorkout]] and its update/delete peers restrict mutations to the actor's personal library. Definition versions include stored scoring fields, ownership, update counter and movement associations. Deletion archives the definition from current library selection while retaining the row for track programming, schedules, legacy scores, remixes, provider imports and in-flight reference writers. Saved personal snapshots are not rewritten by library edits.

[[apps/wodsmith-start/src/server/training-result-mutations.ts#saveOwnedResult]] supports published blocks, personal items, planned library items and direct library attempts through existing scoring writers. Reads return only the actor's result plus rich round details and a content version. Create rejects existing occurrences; update and delete require the read version. Scheduled and competition legacy scores cannot be deleted through this surface. Explicit source-result audience controls gym sharing; personal results remain private.

The registry also exposes single-day replace, programming draft and explicit publish operations. These call the canonical services within the receipt transaction rather than nesting independently committed writes. Migration `0012_training_mutation_receipts.sql` adds receipt storage and the nullable workout archival timestamp; 0010 and 0011 belong to the planning and gateway workstreams.

The nullable `workouts.archived_at` column is required before any app deployment containing this code, even when the agent resource is disabled. Apply the additive 0012 schema change through the production schema promotion workflow before deploying the application; this task does not run production migrations.

Legacy log correction uses [[apps/wodsmith-start/src/server-fns/log-fns.ts#getOwnedLogWorkoutFn]] with the owned score ID to resolve an archived definition. It does not accept a general include-archived request flag. Planning and CRUD adapters share the same live-grant callback type; planning still requests only its own read/write scopes.
