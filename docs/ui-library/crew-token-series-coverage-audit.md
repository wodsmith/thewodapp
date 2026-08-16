# Crew Token and Series Coverage Audit

This audit records exact-revision browser evidence for Crew's public volunteer token workflow, volunteer signup, and authenticated series crew pool.

## Scope and provenance

The slice verifies 10 scenarios across five visual records. Every record has a desktop 1440×900 light scenario and a mobile 390×844 light scenario:

- `/e/e2e-throwdown/confirm/:token`
- `/e/e2e-throwdown/consent/:token`
- `/e/e2e-throwdown/schedule/:token`
- `/e/e2e-throwdown/volunteer`
- `/series/cgrp_coverage_series/crew`

All observations were captured on 2026-07-10 MDT (UTC-06:00; July 11 UTC in the manifest) from commit `b241ddfc4c3a023669c1604147e3bda3ce8343a5` with `agent-browser 0.26.0`. The app ran locally with `VITE_E2E=true`, isolated local KV and R2 bindings, and Hyperdrive pointed at a fresh loopback-bound MySQL database.

The database received the normal Crew base seed followed by `apps/crew/scripts/seed-e2e.ts`. A disposable `cgrp_coverage_series` group associates the populated Crew demo event with the organizer team, and three overlapping generic volunteer memberships were removed so the series pool represents the 18 unique Crew demo volunteers.

The confirmation, consent, and schedule routes use the deterministic E2E volunteer token already declared in `apps/crew/scripts/seed/crew-demo-event.ts`; it is disposable test data, not a production credential. The series route uses `/api/e2e/session` for `e2e_test_user`. The other four routes are public and require no authenticated session.

## Evidence contract

The capture manifest contains 10 browser runs and 50 hash-pinned artifacts. Every scenario has an accessibility snapshot, scrubbed DOM and overflow summary, scrubbed console log, scrubbed network log, and screenshot.

Captures serialize no cookies, headers, session values, form values, database URLs, local repository paths, network query values, or production tokens. Text evidence replaces the deterministic fixture token and synthetic account emails with explicit placeholders. The manifest retains the deterministic fixture path so the coverage validator can prove the requested route and scenario parameters match.

Every final URL, viewport, and effective theme matched its scenario. All runs had zero uncaught page errors, zero console errors, zero network responses with status 400 or higher, and no document-level horizontal overflow.

The browser navigated directly to each route. It did not confirm or decline an assignment, change consent, update contact information, submit the volunteer form, download a calendar file, print, change the selected series competition, or log out.

## Workflow observations

Confirmation presents the pending North Lane 2 Judge assignment and its confirm, change-request, and decline controls. Consent exposes communication-history and regional-discovery scopes without changing either state. Schedule combines the volunteer's published assignment, response controls, calendar links, consent entry point, and contact-information form.

Volunteer signup exposes contact, role, credential, availability, question, and waiver fields from the populated public event. The exact PR636 revision renders Preferred roles through the shared non-RHF field-group primitive while leaving its form schema and submission behavior route-owned.

The authenticated series view shows one selected Crew competition, 18 unique pool members, and per-volunteer roster and shift destinations. The evidence uses the default single-selection state and does not alter its route query.

## Responsive result

All five routes remain contained at 390×844. Header navigation and account actions remain visible, response and consent actions wrap without widening the document, signup fields stay within the form card, and the long series pool remains vertically scrollable without horizontal overflow.

## Reusable-pattern inventory

All five records remain `route-specific`: token validation, response and consent mutations, signup semantics, series permissions, and roster identity belong to Crew. The observed repetition supports narrower presentation-only boundaries:

| Pattern | Disposition | Evidence and boundary |
| --- | --- | --- |
| Public workflow headers | Library candidate | Confirmation, consent, schedule, and signup repeat eyebrow, title, description, identity, and action placement. Token state and route actions remain app-owned. |
| Metric panels | Library candidate | Series pool repeats the label, icon, and numeric-value pattern already observed in organizer and admin routes. Pool calculations and vocabulary remain Crew-owned. |
| Fact rows and status badges | Library candidate | Assignment, consent, schedule, and series cards repeat label/value and compact status presentation. Values, status vocabularies, and eligibility rules stay with their routes. |
| Action groups | Library candidate | Response, consent, calendar, and series navigation actions need consistent wrapping and spacing. Button semantics, pending state, links, and mutations remain app-owned. |
| `FieldGroup` | Shared library | Volunteer signup's Preferred roles aggregate uses `@repo/ui/field` at the exact PR636 revision. Its role choices, RHF controller, validation, and payload remain in Crew. |
| `CrewVolunteerPublicResponseControls` | App-owned composition | Confirmation and schedule share response-note state and assignment-specific mutation semantics; the composition should remain reusable inside Crew rather than move into the presentation library. |
| Token route shell | App-owned composition | Confirmation, consent, and schedule share a public volunteer context, but token lookup, privacy guarantees, and invalid-link behavior are domain-specific. |

## Coverage result

After this slice, the plan contains 350 scenarios: 188 verified, 26 blocked, and 136 pending. This is exact-revision local evidence and does not claim equivalence with a deployed Crew environment.
