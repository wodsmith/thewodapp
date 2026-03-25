This directory defines the high-level concepts, business logic, and architecture of this project using markdown. It is managed by [lat.md](https://www.npmjs.com/package/lat.md) — a tool that anchors source code to these definitions. Install the `lat` command with `npm i -g lat.md` and run `lat --help`.

- [[architecture]] — Monorepo structure, tech stack, route groups, and deployment
- [[domain]] — Core domain model: teams, competitions, workouts, scoring, volunteers
- [[auth]] — Authentication, sessions, authorization, and placeholder users
- [[commerce]] — Stripe payments, registration checkout, coupons, entitlements
- [[registration]] — Registration flow, payment, capacity, team formation, workflows
- [[organizer-dashboard]] — Competition organizer dashboard pages and features
- [[series-event-templates]] — Series event templates: define once, sync to all competitions
