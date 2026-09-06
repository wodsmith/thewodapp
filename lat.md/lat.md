This directory defines the high-level concepts, business logic, and architecture of this project using markdown. It is managed by [lat.md](https://www.npmjs.com/package/lat.md) — a tool that anchors source code to these definitions. Install the `lat` command with `npm i -g lat.md` and run `lat --help`.

- [[architecture]] — Monorepo structure, tech stack, route groups, and deployment
- [[domain]] — Core domain model: teams, competitions, workouts, scoring, volunteers
- [[submission-integrity]] — Atomic online submissions, review resets, and division-scoped verification tests
- [[auth]] — Authentication, sessions, authorization, and placeholder users
- [[commerce]] — Stripe payments, registration checkout, coupons, entitlements
- [[registration]] — Registration flow, payment, capacity, team formation, workflows
- [[organizer-dashboard]] — Competition organizer dashboard pages and features
- [[competition-type-capabilities]] — Competition-type capability registry and PR-1 truth-table tests
- [[route-docs]] — In-app documentation drawer and CMS for organizer pages
- [[series-event-templates]] — Series event templates: define once, sync to all competitions
- [[competition-invites]] — Qualification sources, roster, and email-locked invite rounds (ADR-0011)
- [[crew]] — Crew concierge event setup, imports, and assignment confirmations
- [[crm-crossfit-metadata]] — CRM gym CrossFit profile URLs and derived affiliate metadata
- [[crm-campaigns]] — CRM marketing campaigns, audience selection, and campaign-linked Outreach interactions
- [[research]] — Product, market, and workflow research notes
- [[tests]] — Executable characterization and regression specifications
- [[gameday]] — Native iOS athlete schedules, spectator browsing, secure sessions, and heat reminders.
- [[training]] — Implemented gym training, versioned results, draft publication, permissions, and interface tests
- [[workout-import-integration]] — Workout import acceptance, current-access checks, and reviewed save boundaries
- [[workout-import-contract]] — Browser-safe import schemas and scoring boundary tests

- [[workout-import]] — Reviewed AI import contracts, current destination authorization, and atomic persistence
- [[workout-import-runtime]] — Private source transport, bounded TanStack inference, authorization, and runtime verification

- [[workout-import-ux]] — Shared reviewed import workspace, destinations, access and recovery
- [[workout-import-ux-tests]] — Draft, access, source, cancellation and destination interaction tests
- [[crossfit-import]] — Daily CrossFit.com source ingestion, scoring conversion, atomic publication, and dated track display

- [[training-personal]] — Athlete-owned composition, durable defaults, source snapshots, and private results.
