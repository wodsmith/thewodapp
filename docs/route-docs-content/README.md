# Route Docs Content Pack

Source content for the in-app docs drawer (PR #505), authored per the rollout plan in `docs/plans/route-docs-rollout-strategy.md`. Each file here is one CMS entry, ready to load at `/admin/docs` once the drawer ships.

## File format

Frontmatter maps 1:1 to CMS fields:

```yaml
---
title: Publish division results   # route_docs.title
description: One-line summary     # route_docs.description (shown in CMS list/drawer)
type: markdown                    # route_docs.type (markdown | video | link)
routes:                           # route_doc_routes — one mapping per route ID
  - /compete/organizer/$competitionId/results
sortOrder: 0                      # route_docs.sortOrder (lower = higher on the page)
---
```

The body below the frontmatter is the markdown content. To load: create an entry in `/admin/docs`, paste the body, set title/routes/sort order from the frontmatter, then publish.

**Route IDs are exact-match against `router.routesById`** (verified against `routeTree.gen.ts`): index routes end with a trailing slash (the athletes and events *list* pages are `.../athletes/` and `.../events/` — the no-slash form doesn't exist and would never render), and pathless layout segments appear in IDs (competition creation is `/compete/organizer/_dashboard/new`). When in doubt, pick from the CMS route dropdown — it lists the live route tree.

## Phase 0 — link docs (no files needed, pure CMS entries)

Create these as `type: link` entries pointing at the existing Docusaurus site:

| Title | linkUrl | Route ID(s) |
|---|---|---|
| Guide: Schedule heats | `https://docs.wodsmith.com/how-to/organizers/schedule-heats` | `/compete/organizer/$competitionId/schedule` |
| Concept: How heat scheduling works | `https://docs.wodsmith.com/concepts/heat-scheduling` | `/compete/organizer/$competitionId/schedule` |
| Guide: Manage registrations | `https://docs.wodsmith.com/how-to/organizers/manage-registrations` | `/compete/organizer/$competitionId/athletes/` |
| Guide: Registration questions | `https://docs.wodsmith.com/how-to/organizers/registration-questions` | `/compete/organizer/$competitionId/athletes/` |
| Guide: Edit your competition | `https://docs.wodsmith.com/how-to/organizers/edit-competition` | `/compete/organizer/$competitionId/edit` |
| Guide: Send broadcasts | `https://docs.wodsmith.com/how-to/organizers/send-broadcasts` | `/compete/organizer/$competitionId/broadcasts` |
| Reference: Broadcast audiences | `https://docs.wodsmith.com/reference/broadcasts` | `/compete/organizer/$competitionId/broadcasts` |
| Guide: Multi-workout events | `https://docs.wodsmith.com/how-to/organizers/multi-workout-events` | `/compete/organizer/$competitionId/events/` |
| Guide: Event day operations | `https://docs.wodsmith.com/how-to/organizers/event-day` | `/compete/organizer/$competitionId/check-in` |
| Concept: How scoring works | `https://docs.wodsmith.com/concepts/scoring-system` | `/compete/organizer/$competitionId/scoring`, `/compete/organizer/$competitionId/results` |
| Concept: How divisions work | `https://docs.wodsmith.com/concepts/division-system` | `/compete/organizer/$competitionId/divisions`, `/compete/organizer/$competitionId/event-divisions` |
| Reference: Competition settings | `https://docs.wodsmith.com/reference/competition-settings` | `/compete/organizer/$competitionId/settings` |

Give link docs `sortOrder: 10` so page-specific markdown how-tos (sortOrder 0) appear above them.

**Overlap warning:** PR #505's dev seeder (`apps/wodsmith-start/scripts/seed/seeders/22-route-docs.ts`) already creates a subset of these in **dev environments only** — a layout-level setup guide plus link docs for schedule, athletes, broadcasts, and edit, and a first-competition tutorial on the dashboard index (`/compete/organizer/_dashboard/`). Production gets nothing from seeds, so the full manifest above still needs CMS entry there — but in dev, check `/admin/docs` before creating duplicates. The seeder is also the reference data shape if anyone builds a production importer for this pack.

## Phase 1 — markdown how-tos (files in this directory)

| File | Route ID |
|---|---|
| `00-organizer-dashboard-overview.md` | `/compete/organizer/$competitionId` (layout — inherits everywhere) |
| `01-publish-division-results.md` | `/compete/organizer/$competitionId/results` |
| `02-event-division-mappings.md` | `/compete/organizer/$competitionId/event-divisions` |
| `03-review-video-submissions.md` | `/compete/organizer/$competitionId/events/$eventId/submissions` |
| `04-refunds-and-transfers.md` | `/compete/organizer/$competitionId/athletes/` |
| `05-edit-a-registration.md` | `/compete/organizer/$competitionId/athletes/$registrationId` |
| `06-connect-stripe-set-fees.md` | `/compete/organizer/$competitionId/pricing` |
| `07-group-multi-part-events.md` | `/compete/organizer/$competitionId/events/` |
| `08-preview-vs-public-leaderboard.md` | `/compete/organizer/$competitionId/leaderboard-preview` |

## Phase 2 — quick-win checklists (files in this directory)

| File | Route ID |
|---|---|
| `09-create-a-competition.md` | `/compete/organizer/_dashboard/new` |
| `10-divisions-and-capacity.md` | `/compete/organizer/$competitionId/divisions` |
| `11-set-up-waivers.md` | `/compete/organizer/$competitionId/waivers` |
| `12-submission-windows.md` | `/compete/organizer/$competitionId/submission-windows` |
| `13-day-of-check-in.md` | `/compete/organizer/$competitionId/check-in` |

## Phase 2 — video scripts (`video-scripts/`)

The two videos need a human screen recording, but the narration scripts and shot lists are ready:

| File | Route ID | Length |
|---|---|---|
| `video-scripts/judge-rotations.md` | `/compete/organizer/$competitionId/volunteers` | ~3 min |
| `video-scripts/series-template-sync.md` | `/compete/organizer/series/$groupId/events` | ~3 min |

Record against a seeded dev environment, upload via `/admin/docs` (≤100MB R2) or paste an unlisted YouTube URL, then create the CMS entry from each script's frontmatter.

Keep edits to these files in sync with the CMS — the CMS is the runtime source of truth; this directory is the reviewed draft of record (the `22-route-docs` seeder shows the data shape if a production importer gets built).
