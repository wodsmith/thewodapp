---
title: "Video: Schedule judges with rotations"
description: Build, check, and publish judge rotations across heats
type: video
videoUrl: TBD — fill in after recording (R2 upload via /admin/docs, or unlisted YouTube)
routes:
  - /compete/organizer/$competitionId/volunteers
sortOrder: 5
---

# Recording script — Judge rotations (~3 min)

**Audience:** organizer with heats scheduled and judge volunteers on the roster.
**Recording setup:** seeded dev environment; a competition with 2 events, heats with 4+ lanes, and 5+ volunteers with the judge role (the demo-competition seeder provides this). 1080p, browser only, cursor highlights on.

| # | On screen | Narration |
|---|---|---|
| 1 | Volunteers page, Judges tab | "Once your heats are scheduled and judges have signed up, the Judges tab is where you assign who judges which lane, in which heat." |
| 2 | Event defaults editor | "Start with the event's defaults — how many judges you need per heat and any default rotation behavior. Each event is scheduled separately." |
| 3 | Open rotation editor, pick judges | "Create a rotation: pick the judges working this block. A rotation is a group of judges plus a movement pattern." |
| 4 | Pattern selector | "Three patterns: **stay** keeps each judge on their lane; **shift right** moves everyone one lane per heat — the standard way to spread judging variance; **random** shuffles." |
| 5 | Rotation timeline (heats × lanes grid) | "The timeline shows every heat and lane, color-coded. Gaps are uncovered lanes — fix them by extending a rotation or adding another one." |
| 6 | "Adjust for occupied lanes" action | "If some heats aren't full, this splits rotations to skip empty lanes, so judges aren't assigned to nobody." |
| 7 | Publish button, version history | "Publishing snapshots a version and makes the schedule visible to your judges on their own schedule page. Need to rework it? Edit and republish — previous versions stay restorable." |
| 8 | Judges-AI page (brief) | "If your team has AI scheduling enabled, the AI page proposes rotations for your review — same rules, you accept or reject each one, and still publish from this timeline." |
| 9 | End card | "Judges see assignments on their My Schedule page the moment you publish." |

**Post-production:** trim dead time between clicks; captions on; keep under 100MB for R2 (or use an unlisted YouTube embed and paste the URL instead).
