# Crew Organizer Coverage Audit

This audit records exact-revision browser evidence for the authenticated Crew organizer workflow from event discovery and creation through staffing, confirmations, event-day operations, and exports.

## Scope and provenance

The slice verifies 24 scenarios across 12 visual records. Every record has a desktop 1440×900 light scenario and a mobile 390×844 light scenario:

- `/events`
- `/events/new`
- `/events/e2e_competition`
- `/events/e2e_competition/setup`
- `/events/e2e_competition/heats`
- `/events/e2e_competition/staffing`
- `/events/e2e_competition/volunteers`
- `/events/e2e_competition/shifts`
- `/events/e2e_competition/judges`
- `/events/e2e_competition/messages`
- `/events/e2e_competition/day-of`
- `/events/e2e_competition/exports`

All observations were captured on 2026-07-10 from commit `e7ba19fa32e0c95b49793e4afbfcf2cbe302fdd7` with `agent-browser 0.26.0`. The app ran locally with `VITE_E2E=true`, local KV/R2 bindings, and Hyperdrive pointed at a fresh disposable loopback-bound MySQL database.

The database received the normal Crew base seed followed by `apps/crew/scripts/seed-e2e.ts`, whose `crew-demo-event` fixture provides the event, workouts, heats, volunteers, shifts, confirmations, judge assignments, and event-day state used here. Authentication used `/api/e2e/session` for `e2e_test_user`. No form was submitted and no mutating action was clicked.

## Evidence contract

The capture manifest contains 24 exact-head captures and 108 hash-pinned live artifacts. Every scenario has an accessibility snapshot, scrubbed DOM/overflow snapshot, scrubbed console log, and scrubbed network log. Twelve representative screenshots cover both viewports for Events, New event, Overview, Day-of operations, and Volunteers, plus desktop Setup and Print packet.

The complete evidence directory contains 109 files including its manifest. Captures serialize no cookies, headers, credentials, form values, database URLs, local repository paths, or network query values. Every final URL, viewport, and effective theme matched its scenario. The exports route intentionally normalized the requested URL to `?tab=schedule`, its route-validated default tab.

All 24 scenarios had zero uncaught page errors, zero console errors, and zero network responses with status 400 or higher.

## Workflow observations

The seeded event list and event overview provide a coherent path into the sidebar workflow. Setup truthfully shows the event details, three workout shells, and two locations. Heats groups the published schedule by workout, while Staffing Plan summarizes two remaining staffing gaps.

Volunteers, Volunteer Shifts, Judge Assignments, and Confirmations all expose the populated fixture without requiring a mutation. Day-of operations combines current blocks, response and no-show queues, staffing gaps, and active judge coverage. Print packet defaults to its master schedule and exposes the Judges and Shifts packet tabs without invoking downloads or print.

## Responsive findings

Three real mobile overflow issues remain non-blocking findings because the underlying routes loaded successfully and the evidence records the observed output:

- `/events` measures 442 px of content in a 390 px viewport. The public Crew header's account/logout control begins at x=402, so the navigation row extends 52 px beyond the viewport.
- `/events/new` shares the same 442 px public-header width and overflow.
- `/events/e2e_competition/exports?tab=schedule` measures 500 px in a 390 px viewport. The outer packet table grows to 484 px; its inner schedule table has an `overflow-x-auto` wrapper, but the print-packet structure itself still widens the page.

The other nine audited routes reported no horizontal overflow in either viewport. The findings should be handled in responsive implementation PRs rather than changing the truthfulness of this evidence slice.

## Reusable-pattern inventory

All 12 route records remain `route-specific`: their loaders, permissions, event identifiers, mutation controls, scheduling state, and operator workflows belong to Crew. Repetition inside those routes supports narrower presentational boundaries:

| Pattern | Disposition | Evidence and boundary |
| --- | --- | --- |
| `CrewEventSidebarShell` | App-owned composition | Ten event routes share event identity, role-aware navigation, responsive sidebar state, and print hiding. Its information architecture is Crew-specific even though it should remain one reusable app component. |
| Page headers | Library candidate | Events, New event, event overview, and every sidebar page repeat heading, description/eyebrow, and action placement. A shared primitive may own presentation only; route links, event state, and actions stay app-owned. |
| Metric and status panels | Library candidate | Staffing, Judges, Confirmations, and Day-of use repeated count/status cards. A primitive may own label/value/status presentation while calculations and status vocabulary remain Crew-owned. |
| Empty and zero states | Library candidate | Event discovery, operation queues, staffing gaps, and assignment sections repeat bounded empty or zero presentations. Generalize through children rather than domain booleans; recovery actions stay with routes. |
| Responsive tables | Library candidate | Volunteers and Print packet need consistent scroll containment and compact-cell treatment. A wrapper may own responsive mechanics, but columns, print semantics, downloads, and row actions remain domain-specific. |
| Field wrappers | Shared library | New event and Setup can adopt `@repo/ui/field` for manually controlled or display fields. RHF-owned controls must continue using `FormField` and `useFormField`; the shared primitive must not absorb validation state or route forms. |

## Coverage result

After this slice, the plan contains 339 scenarios: 166 verified, 26 blocked, and 147 pending. This is exact-revision local evidence and does not claim equivalence with a deployed Crew environment.
