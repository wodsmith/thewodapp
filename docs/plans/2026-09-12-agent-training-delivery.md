# Agent training delivery

This plan records the implementation authorized on September 12, 2026, following the [agent-first training research](../research/agent-first-training.md). It describes intended delivery and review gates, not deployed capabilities.

## Product boundary

An athlete connects an agent through authenticated remote MCP, reads accessible programming and owned training, builds a portable weekly proposal, reviews the exact changes, commits it, and records or corrects results. A separate grant governs publisher actions.

One personal day belongs to the athlete across teams. Team selection supplies programming context; it cannot select a different personal day or become a substitute for source authorization. Preserve current records behind an adapter until the coordinated personal-day migration is ready. Never expose a destination team as permanent personal-day identity.

## Workstream ownership

Three isolated tasks implement distinct boundaries, with coordinator review before merging their PRs.

| Task | Ownership | Dependency |
| --- | --- | --- |
| Build agent training services and CRUD | Cookie-independent actor services, canonical workout/result mutations, transaction-aware personal save | Existing training access and personal-session services |
| Build portable weekly training plans | Versioned blueprint, durable proposals/questions, preview digest, atomic commit and receipts | Actor services and canonical transaction-aware save |
| Build WodSmith MCP and OAuth gateway | New Worker, named tools, consent/grants/revocation, private service binding and infrastructure | Typed service and planning operations |

The existing Simplify training UX task owns its UI work and personal-day migration coordination. The tasks agree on schema migrations and shared exports before editing overlapping files. Existing unrelated competition/code-mode MCP PRs are references, not dependencies to merge wholesale.

## Shared contracts

Domain services receive an explicit authenticated actor and database dependency. Browser cookies are resolved at web adapters; OAuth tokens are resolved at the gateway boundary. Both paths enforce current domain ownership, membership, and entitlement.

The private binding revalidates authoritative live grants. A client cannot manufacture user identity, widen scopes or allowed source teams, or retain authorization after grant revocation. The gateway has no independent database mutation path. Source entitlement alone does not override a narrower connected-agent grant.

Plans have owner, explicit ID, revision, seven-day range, proposed days, source identities, constraints, and unresolved questions. Training, rest, and leave-open intent remain distinct. Draft creation and reads do not write personal sessions. Preview includes exact changes and a digest bound to proposal and relevant source/session revisions.

Commit performs all affected day writes and the durable receipt in one bounded database transaction. Retry returns the original receipt; reuse of a key with different input fails. Concurrent web/agent changes and changed source access invalidate stale previews. A rest choice cannot silently remove performed items or unrelated existing work.

Preserve full workout scoring definitions, occurrence identities, snapshots, notes, rounds, caps, scaling, units, and tiebreaks. A source adaptation becomes a personal prescription; it does not edit or publish the original. Removing a planned item, deleting a workout definition, and deleting a result are distinct operations with explicit consequences.

## Review and merge gates

The coordinator reviews code and integration behavior in addition to task reports, then merges dependency PRs in order only after their checks pass.

- Inspect the actual dependency versions and APIs shipped by the chosen SDKs. Keep HTTP discovery, resource audience, PKCE, consent, token validation, and revocation coherent across the gateway and login origin.
- Exercise actor isolation, private sources, expired membership, restricted source-team grants, forged IDs, and revoked grants. Own history must not leak other members' results or notes.
- Test draft portability, rich source/personal/library items, explicit rest versus unavailable programming, deterministic preview, stale revisions, same-key recovery, conflicting retries, and all-or-nothing multi-day writes against disposable MySQL.
- Verify workload limits and error responses. Only register tools with real implementations and correct read/write/destructive annotations.
- Run focused regression tests for existing web training and result paths, package type checks, Worker builds, schema ownership validation, required repository checks, GitNexus change/impact review, and `lat check`.
- Review the integrated branch after dependencies merge; an isolated passing task is insufficient evidence that the gateway-to-database flow works.

Production deployment, live data migration, public client support claims, and real-account ChatGPT/Claude connection verification remain rollout work. The authorized PR merges do not substitute for those checks.
