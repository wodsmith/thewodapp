# Plan 004: Preserve session navigation and addition intent

This bounded follow-up resolves verified navigation and preview fidelity findings from the second review of PR #699 without changing its database or dependency stack.

## Status and baseline

DONE. Plan 003 is DONE. The coordinator authorized this follow-up after all 18 CI contexts passed at 9d43c56a1303f2f9cb8a2f384495cad3fe9d5c89. That exact head was the clean baseline in /private/tmp/wodsmith-session-ux on zac/training-session-ux. The advisor reviewed the full source/test diff and independently passed the gates recorded in 004-session-navigation-verification.md. Migration integration remains held.

## Scope and constraints

Scope is AthletePersonalSession, log/new navigation and its handoff, existing session occurrence helpers if needed, their component/route tests, training personal/provider database regressions, training preview fixtures/spec/config/README, and lat/plans documentation. Do not change canonical schema, migrations, snapshots, journal, public base, security ownership policy or other owners' branches. No merge or deployment. Prefer no server implementation change where its conflict contract already behaves correctly.

The advisor never edits source. The existing executor implements the plan in this isolated worktree, while the advisor reads the entire final diff and reruns the relevant gates. The user authorized publishing reviewed fixes to the existing PR. Executor does not push, and waits for final advisor approval before committing. Parent owns plans/README.md.

## Findings and implementation

1. Preserve selected track and return surface in My session edit and new-log links, and through import handoffs. Navigation context must remain separate from the actual source occurrence of a newly imported workout: do not copy the old source date/track into its provenance. Use a clearly named return-context field if necessary. Reproduce missing non-default track after My session log/edit and track-origin import return before fixing, then assert full date/workspace/track/surface after completion. Retain notes only under the existing recognized import handoff contract.

2. Correct Add-all request identity. The current additionId cache is keyed by library workout only, so a changed source occurrence can reuse an incompatible item ID. Keys must distinguish destination workspace/date and source track/date/workout, with stable identity for retries of the same intent. Preserve explicit repeats as separate items and repeated submissions of the same repeat as idempotent retries. The existing server already rejects same-ID/different-payload appends; do not weaken that rejection. Add real-server regressions for switch/back, retry and explicit-repeat behavior, plus client assertions that emitted identities match that contract.

3. Align preview fidelity: persist private block results and explicit default track alongside session/library result persistence across native navigation and reload; update the README to describe reset behavior accurately. Match server occurrence deduplication, repeat retry semantics and same-ID/different-payload rejection. Clone returned fixture session values where needed to prevent caller mutation of fixture storage. The existing browser planned-score test must actually switch away and back before checking its result. Format touched new test/fixture blocks without broad unrelated cleanup.

4. Maintain exact dispositions for new comments 3953564083, 3953564087, 3953564088, 3953564090, 3953564095, 3953564098, 3953564100 and 3953564103. Reject 3953564095 as written: baseline track insertion omits isPublic and canonical default is 0, so bot suggestion isPublic:1 changes the baseline. Record proof rather than applying it.

## Verification and delivery

Run GitNexus impact before editing symbols and report high/critical impact; fall back to the working CLI when MCP transport is unavailable. Reproduce substantive findings with failing focused tests before fixes. Update lat behavior/specs and run lat check. Run focused production component/route tests, non-skipped serial disposable MySQL regressions, complete desktop/mobile session journeys, app types/lint and build as warranted by route changes. Parent reruns relevant focused/DB/browser/type/lint gates and reviews every new assertion. One final full app suite is justified by these route/identity changes; do not repeat broad gates absent further changes or failures. Shared DB/Crew gates need not repeat while their scope is untouched.

Prepare a receipt separating before/after evidence, limitations and rejected suggestions. Verify packages/wodsmith-db is unchanged from the baseline. Advisor marks this plan DONE only after review and gates pass. Executor performs required GitNexus change detection immediately before the approved source/test/docs commit; parent pushes and checks actual latest-head CI/review output. Migration integration remains held under option C throughout.
