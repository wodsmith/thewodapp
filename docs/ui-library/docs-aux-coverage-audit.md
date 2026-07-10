# Docs and Auxiliary App Coverage Audit

This audit records fresh, anonymous browser evidence for WODsmith Docs, CRM, and Ledger, and records why Gameday could not be exercised without inventing a runtime or authentication fixture.

## Scope and provenance

The slice assigns 101 scenarios to 51 visual records: 34 public Docs records, 12 CRM records, two Ledger records, and three Gameday records. Eighty-four scenarios are verified and 17 are blocked. Together with the prior public-entry slice, the plan now contains 109 verified, 24 blocked, and 174 pending scenarios.

All verified observations were captured on 2026-07-10 with `agent-browser 0.26.0`. The deployed Git revision was not exposed and is recorded as `unknown`; this evidence describes the deployed output at capture time, not PR-head equivalence. The capture manifest contains 86 browser runs and hash-pins every accessibility snapshot, DOM summary, screenshot, console log, and redirect trace.

## WODsmith Docs

All 34 public Docusaurus category and content routes were exercised in desktop/light at 1440 by 900 and mobile/dark at 390 by 844. Every route produced an accessibility snapshot and deterministic DOM summary. Twelve screenshots cover six representative shells in both variants rather than duplicating screenshots for content-only differences.

The 68 Docs scenarios rendered the requested effective theme. None of the captured DOM summaries reported horizontal overflow, and no route-level blocker was observed. These pages remain `route-specific`: their shared navigation, prose, table, and code presentation comes from the Docusaurus site rather than the React product-app primitive boundary.

## CRM and Ledger

The deployed CRM and Ledger roots both rendered a centered password entry form anonymously on desktop and mobile. Their DOM summaries reported no horizontal overflow. Both applications hard-code `html.dark`; explicit light requests remained dark and are blocked with `THEME_NOT_IMPLEMENTED` rather than being mislabeled as light evidence.

The ten CRM protected visual routes and two Ledger protected visual routes were each probed anonymously. Every probe redirected to the corresponding `/` password gate before protected content loaded. Those redirect observations are verified, but authenticated page rendering remains blocked with `AUTH_FIXTURE_UNAVAILABLE`: no disposable password session and seeded application data were available, and no password was submitted.

The duplicated CRM and Ledger password roots are `library-candidate` records for an `AuthEntryShell` composition. Shared theme tokens are another clear candidate. Page headers, app navigation, search/list patterns, data tables, empty states, metric cards, metadata, status badges, and copy/not-found treatments remain hypotheses until authenticated evidence exists.

## Gameday

The Gameday index, login, and competitions records are blocked with `RUNTIME_TARGET_UNAVAILABLE`. Neither a deployed DNS target nor an exact-revision local Vite/API runtime was available, so this slice claims no Gameday browser output. Competitions would additionally require an authenticated bearer token and registrations API data once a runtime exists.

The three Gameday records remain `unassessed`. Source-level redirects or component inspection are useful for planning, but they are not substitutes for browser evidence under this contract.

## Extraction decisions

This evidence supports extracting the shared CRM/Ledger authentication-entry composition next. Docs should retain its Docusaurus-owned route presentation, and authenticated CRM/Ledger plus all Gameday component decisions should wait for reproducible fixtures and runnable targets.
