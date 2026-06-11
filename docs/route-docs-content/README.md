# Route Docs Content Pack

Source content for the in-app docs drawer (PR #505), authored per the rollout plan in `docs/plans/route-docs-rollout-strategy.md`. Each file here is one CMS entry, ready to load at `/admin/docs` once the drawer ships.

## File format

Frontmatter maps 1:1 to CMS fields:

```yaml
---
title: Publish division results   # route_docs.title
type: markdown                    # route_docs.type (markdown | video | link)
routes:                           # route_doc_routes — one mapping per route ID
  - /compete/organizer/$competitionId/results
sortOrder: 0                      # route_docs.sortOrder (lower = higher on the page)
---
```

The body below the frontmatter is the markdown content. To load: create an entry in `/admin/docs`, paste the body, set title/routes/sort order from the frontmatter, then publish.

## Phase 0 — link docs (no files needed, pure CMS entries)

Create these as `type: link` entries pointing at the existing Docusaurus site:

| Title | linkUrl | Route ID(s) |
|---|---|---|
| Guide: Schedule heats | `https://docs.wodsmith.com/how-to/organizers/schedule-heats` | `/compete/organizer/$competitionId/schedule` |
| Concept: How heat scheduling works | `https://docs.wodsmith.com/concepts/heat-scheduling` | `/compete/organizer/$competitionId/schedule` |
| Guide: Manage registrations | `https://docs.wodsmith.com/how-to/organizers/manage-registrations` | `/compete/organizer/$competitionId/athletes` |
| Guide: Registration questions | `https://docs.wodsmith.com/how-to/organizers/registration-questions` | `/compete/organizer/$competitionId/athletes` |
| Guide: Edit your competition | `https://docs.wodsmith.com/how-to/organizers/edit-competition` | `/compete/organizer/$competitionId/edit` |
| Guide: Send broadcasts | `https://docs.wodsmith.com/how-to/organizers/send-broadcasts` | `/compete/organizer/$competitionId/broadcasts` |
| Reference: Broadcast audiences | `https://docs.wodsmith.com/reference/broadcasts` | `/compete/organizer/$competitionId/broadcasts` |
| Guide: Multi-workout events | `https://docs.wodsmith.com/how-to/organizers/multi-workout-events` | `/compete/organizer/$competitionId/events` |
| Guide: Event day operations | `https://docs.wodsmith.com/how-to/organizers/event-day` | `/compete/organizer/$competitionId/check-in` |
| Concept: How scoring works | `https://docs.wodsmith.com/concepts/scoring-system` | `/compete/organizer/$competitionId/scoring`, `/compete/organizer/$competitionId/results` |
| Concept: How divisions work | `https://docs.wodsmith.com/concepts/division-system` | `/compete/organizer/$competitionId/divisions`, `/compete/organizer/$competitionId/event-divisions` |
| Reference: Competition settings | `https://docs.wodsmith.com/reference/competition-settings` | `/compete/organizer/$competitionId/settings` |

Give link docs `sortOrder: 10` so page-specific markdown how-tos (sortOrder 0) appear above them.

## Phase 1 — markdown how-tos (files in this directory)

| File | Route ID |
|---|---|
| `00-organizer-dashboard-overview.md` | `/compete/organizer/$competitionId` (layout — inherits everywhere) |
| `01-publish-division-results.md` | `/compete/organizer/$competitionId/results` |
| `02-event-division-mappings.md` | `/compete/organizer/$competitionId/event-divisions` |
| `03-review-video-submissions.md` | `/compete/organizer/$competitionId/events/$eventId/submissions` |
| `04-refunds-and-transfers.md` | `/compete/organizer/$competitionId/athletes` |
| `05-edit-a-registration.md` | `/compete/organizer/$competitionId/athletes/$registrationId` |
| `06-connect-stripe-set-fees.md` | `/compete/organizer/$competitionId/pricing` |
| `07-group-multi-part-events.md` | `/compete/organizer/$competitionId/events` |
| `08-preview-vs-public-leaderboard.md` | `/compete/organizer/$competitionId/leaderboard-preview` |

Keep edits to these files in sync with the CMS until a future importer exists — the CMS is the runtime source of truth; this directory is the reviewed draft of record.
