---
title: "Video: Sync series event templates"
description: Define events once and push them to every competition in a series
type: video
videoUrl: TBD — fill in after recording (R2 upload via /admin/docs, or unlisted YouTube)
routes:
  - /compete/organizer/series/$groupId/events
sortOrder: 5
---

# Recording script — Series event template sync (~3 min)

**Audience:** organizer running a series (e.g. a 3-stop throwdown) who wants identical workouts across stops.
**Recording setup:** seeded dev environment; a series group with 2+ child competitions, one of which already has events. 1080p, browser only, cursor highlights on.

| # | On screen | Narration |
|---|---|---|
| 1 | Series events page, empty template | "A series template lets you define your workouts once and push them to every competition in the series." |
| 2 | Create template: "Copy from competition" | "Two ways to start: copy events from a competition that already has them — sub-event structure comes along — or start from scratch." |
| 3 | Edit a template event | "Template events use the same editor as competition events: scheme, time caps, movements, per-division descriptions, resources, judging sheets." |
| 4 | Selection toolbar, pick 2 parent events | "To sync, select the events to push. Parents only — their sub-events travel with them." |
| 5 | Competition picker with status badges | "Each competition shows its status: **in sync**, **behind** the template, **unmapped**, or **custom**. 'Select Visible with Changes' grabs everything that needs an update." |
| 6 | Preview dialog | "Always preview first: you get a field-level diff per competition — what gets renamed, which movements change, what's created new." |
| 7 | Apply sync | "Apply. Workout fields and movements are **overwritten** to match the template; resources and judging sheets are only ever **added**, never removed." |
| 8 | Event Match tab, auto-match | "The Event Match tab ties each competition's events to the template for series scoring — auto-match handles name variations like 'Event 1:' prefixes; review anything it couldn't claim." |
| 9 | Publish-workouts page | "Syncing doesn't make events public. The Publish Workouts page is where you bulk-publish across the series when you're ready for athletes to see them." |
| 10 | Series leaderboard glance | "With mappings in place, the series leaderboard aggregates every stop automatically." |

**Post-production:** trim dead time; captions on; keep under 100MB for R2 (or use an unlisted YouTube embed and paste the URL instead).
