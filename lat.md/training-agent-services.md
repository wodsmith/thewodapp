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

### Partial grants fail closed

Every nonempty incomplete combination of grant fields is rejected by identity, scope, and team checks. Plain web actors remain valid, and complete grants with empty restrictions deny access.

### Library occurrence edits retain identity

Changing a saved provider occurrence under the same case-insensitive ID is rejected without changing its revision or snapshot. ID casing cannot reassign existing result identity to a different workout.
