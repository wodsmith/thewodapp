# Crew Admin Coverage Audit

This audit records exact-revision browser evidence for Crew's private operator shell across the control room, event diagnostics, billing, conversion, and readiness surfaces.

## Scope and provenance

The slice verifies 12 scenarios across six visual records. Every record has a desktop 1440×900 light scenario and a mobile 390×844 light scenario:

- `/admin/crew`
- `/admin/crew/events`
- `/admin/crew/events/e2e_competition`
- `/admin/crew/events/e2e_competition/billing`
- `/admin/crew/events/e2e_competition/convert`
- `/admin/crew/events/e2e_competition/readiness`

All observations were captured on 2026-07-10 from commit `ef67f18a62d4d89ecff47d7b033dcb22b35e0be4` with `agent-browser 0.26.0`. The app ran locally with `VITE_E2E=true`, isolated local KV and R2 bindings, and Hyperdrive pointed at a fresh loopback-bound MySQL database.

The database received the normal Crew base seed followed by `apps/crew/scripts/seed-e2e.ts` and its populated `crew-demo-event` fixture.

Authentication used `/api/e2e/session` for the separately seeded `e2e_admin_user`. The organizer fixture user cannot access these routes because its global role is `user`; the admin route guard and server loaders require the global `admin` role.

## Evidence contract

The capture manifest contains 12 browser runs and 60 hash-pinned artifacts. Every scenario has an accessibility snapshot, scrubbed DOM and overflow summary, scrubbed console log, scrubbed network log, and screenshot.

Captures serialize no cookies, headers, credentials, form values, database URLs, local repository paths, or network query values. Every final URL, viewport, and effective theme matched its scenario. All runs had zero uncaught page errors, zero console errors, and zero network responses with status 400 or higher.

The browser navigated directly to each route. It did not submit forms; click New event, billing, checkout, conversion, or readiness actions; follow external links; or log out. Page loads and server functions remained read-only apart from the disposable session bootstrap.

## Operator workflow observations

The control room summarizes the single Crew event, incomplete setup, and paid state before linking into the populated event list. The event overview combines lifecycle, billing, setup, roster, assignment, confirmation, raw-ID, source, and operator-note diagnostics.

Billing truthfully exposes the comped fixture, disabled payment actions, and empty billing audit. Conversion stays read-only while separating missing full-platform setup from preserved Crew data. Readiness reports seeded venues, workouts, heats, volunteers, shifts, judge versions, and confirmations without invoking any recovery action.

## Responsive result

The PR632 validation pass confirms the shared public-header fix on both affected admin routes:

- `/admin/crew` measures 390 px of content in the 390 px viewport.
- `/admin/crew/events` measures 390 px of content in the 390 px viewport.

Both routes keep the public navigation and account action visible without widening the document. All 12 scenarios report no horizontal overflow, and the pass found no new responsive, console, network, or route findings.

## Reusable-pattern inventory

All six records remain `route-specific`: their loaders, global-admin permission, event identifiers, billing state, conversion semantics, readiness vocabulary, and operator actions belong to Crew.

| Pattern | Disposition | Evidence and boundary |
| --- | --- | --- |
| Page headers | Library candidate | The control room, event list, readiness, billing, and conversion repeat eyebrow, title, description, and action placement. Navigation and action behavior remain route-owned. |
| Metric and status panels | Library candidate | Control room, overview, billing, readiness, and conversion repeat label/value/status cards. Calculations and status vocabulary remain Crew-owned. |
| Fact rows | Library candidate | Overview and billing duplicate label/value, mono-ID, and definition-list presentation. Raw values and safe-link decisions remain route-owned. |
| Empty states | Library candidate | The event list and billing audit use bounded empty presentations. Recovery actions remain with their routes. |
| Progress presentation | Library candidate | Event setup and readiness repeat clamped progress bars and count summaries. Progress calculations stay app-owned. |
| Checklist cards | Library candidate | Readiness and conversion repeat icon, badge, detail, and action placement. Domain states and destinations stay app-owned. |
| Responsive tables | Library candidate | Billing audit joins the organizer roster and print surfaces as evidence for shared scroll containment. Columns and print behavior remain domain-specific. |
| Operator actions | Library candidate | Billing and conversion repeat available-link and disabled-action presentation. Availability rules, external navigation, and side effects remain Crew-owned. |
| `CrewEventSidebarShell` | App-owned composition | Event identity, global-admin navigation, responsive sidebar state, and print behavior are Crew-specific even though all four detail routes share the component. |

## Coverage result

After this slice, the plan contains 345 scenarios: 178 verified, 26 blocked, and 141 pending. This is exact-revision local evidence and does not claim equivalence with a deployed Crew environment.
