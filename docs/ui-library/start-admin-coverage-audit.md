# Start Admin Coverage Audit

This audit records exact-revision browser evidence for Start's private platform-admin shell across dashboard, competition, documentation, entitlement, organizer-request, and team operations.

## Scope and provenance

The slice verifies 16 scenarios across eight visual records. Every record has a desktop 1440×900 light scenario and a mobile 390×844 light scenario:

- `/admin`
- `/admin/competitions`
- `/admin/demo-competitions`
- `/admin/docs`
- `/admin/docs/new`
- `/admin/entitlements`
- `/admin/organizer-requests`
- `/admin/teams`

All observations were captured on 2026-07-11 from commit `739ca5370f292aac9f20a1ae7389c6e6e07e9e4c` with `agent-browser 0.26.0`. The app ran locally with `VITE_E2E=true`, isolated local KV and R2 bindings, and Hyperdrive pointed at a fresh loopback-bound MySQL database.

The database received Start's normal base seed followed by `apps/wodsmith-start/scripts/seed-e2e.ts`. Authentication used the disposable global-admin account `e2e_admin_user`; its global `admin` role satisfies the route shell and loader guards.

## Evidence contract

The capture manifest contains 16 browser runs and 80 hash-pinned artifacts. Every scenario has an accessibility snapshot, scrubbed DOM and overflow summary, scrubbed console log, scrubbed network log, and screenshot.

Captures serialize no cookies, headers, credentials, form values, database URLs, local repository paths, or network query values. Synthetic email addresses are scrubbed from text evidence. Every final URL, viewport, and effective theme matched its scenario.

All runs had zero uncaught page errors, zero console errors, zero network responses with status 400 or higher, and zero horizontal overflow. The browser did not submit admin forms, generate or delete demos, grant entitlements, mutate organizer requests, edit teams, create documentation, or log out.

## Platform workflow observations

The dashboard exposes truthful placeholder metrics, quick actions, and recent-activity state. Its primary and section headings remain semantic after the heading fix, and the admin sidebar direct-load state hydrates without errors after the active-link fix.

Competitions and teams render populated base-seed collections. Organizer requests renders the empty pending state plus one historical request. Entitlements renders the selected feature, team counts, and existing access rows without granting or revoking access.

Documentation renders the six seeded route-document groups and the complete create form without submission. Demo competitions renders the truthful empty existing-demo state and generation form; the corrected hierarchy is `h1` → two `h2` section titles → `h3` supporting detail, and both lists contain only `li` children.

## Reusable-pattern inventory

All eight records remain `route-specific`: global-admin authorization, loaders, identifiers, mutations, and platform vocabulary belong to Start.

| Pattern | Disposition | Evidence and boundary |
| --- | --- | --- |
| Page headers | Library candidate | All eight pages repeat title and description placement beneath breadcrumbs. Route labels and actions remain app-owned. |
| Metric cards | Library candidate | Dashboard and Teams repeat compact label/value cards. Counts and loading semantics remain route-owned. |
| Collection summaries | Library candidate | Competitions, Teams, and Entitlements repeat count summaries above responsive collections. Filters and domain columns remain app-owned. |
| Status badges | Library candidate | Competitions, organizer requests, teams, and entitlements repeat compact status treatment. Status vocabulary remains domain-owned. |
| Empty states | Shared primitive consumer | Demo competitions and organizer requests use bounded empty presentations; recovery and creation actions remain route-owned. |
| Form sections | App-owned composition | Demo generation and documentation creation compose existing field, card, and button primitives around domain schemas and mutations. |
| Responsive collections | Library candidate | Desktop tables become contained narrow-screen presentations without document overflow. Columns and action rules remain app-owned. |
| Admin shell | App-owned composition | Global-admin permission, navigation destinations, active-route behavior, theme control, and logout are Start-specific. |

## Coverage result

After this slice, the plan contains 358 scenarios: 204 verified, 26 blocked, and 128 pending. This is exact-revision local evidence and does not claim equivalence with a deployed Start environment.
