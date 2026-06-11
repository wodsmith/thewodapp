# Route Docs Rollout Strategy

A documentation strategy for the in-app docs drawer landing in [PR #505](https://github.com/wodsmith/thewodapp/pull/505), based on a complexity × business-importance matrix of the system's features. The goal: maximum support-ticket deflection and organizer activation per word written, sequenced so coverage is broad on day one and deep where it matters within a month.

## What the feature gives us (and its v1 constraints)

PR #505 adds a PostHog-style contextual docs drawer plus an admin CMS (`/admin/docs`):

- Docs are mapped to **TanStack route IDs** (e.g. `/compete/organizer/$competitionId/schedule`) — static patterns where dynamic segments stay as `$param`, so one mapping covers every competition.
- Docs mapped to a **layout route inherit to all child pages**; page-specific docs sort above inherited ones (leaf-first ordering).
- Three content types per doc: **markdown** (rendered inline), **video** (R2 upload ≤100MB native playback, or YouTube/Vimeo embed), **external link** (e.g. docs.wodsmith.com).
- Publish toggle gates drawer visibility; content-changing saves create restorable version snapshots; stale route mappings are flagged after route renames.

**v1 scope constraint:** the drawer only mounts in the `/compete/organizer` layout, and the CMS route picker filters `router.routesById` to that prefix. Cohost, athlete, and workout-tracking pages get no in-app docs until (a) the drawer is mounted in their layouts and (b) the picker filter is widened. The `route_doc_routes` mapping table is already many-to-many and route-agnostic, so no schema change is needed to expand.

## Business context behind the importance axis

Revenue is a **platform fee (2.5% + $2.00) on every paid registration** via Stripe Connect, plus entitlement upsells (coupons, AI judge scheduling, hosting limits). Importance therefore concentrates in:

1. **Organizer activation** — create competition → connect Stripe → open registration is the funnel that creates revenue.
2. **The money path** — registrations, refunds, transfers; errors here are financially sensitive and generate the costliest support.
3. **Event-day trust** — scoring/leaderboard correctness is public and immediate; it decides whether an organizer returns.

Athletes are high-volume free users whose confusion mostly lands as *organizer* support tickets.

## The matrix

Complexity is **user-facing operational complexity** (how much explanation a feature needs to operate correctly), evidenced by the depth of caveats in the `lat.md/` knowledge graph and route/concept counts — not code size.

### Organizer surface (in drawer scope today)

| Feature area (route IDs) | Complexity | Importance | Quadrant |
|---|---|---|---|
| Results entry + video submission review (`/results`, `/events/$eventId/submissions/*`) | Very high — division-scoped scores, multi-round time caps, penalties, statuses, partner slots | Critical — event-day trust, public mistakes | Q1: document deeply |
| Scoring config + leaderboard preview + division publish gate (`/scoring`, `/leaderboard-preview`) | High — algorithms, tiebreaks; asymmetric default (online comps hide results until published, in-person show everything) | Critical — "why isn't my leaderboard showing?" is a guaranteed ticket | Q1 |
| Event management + event-division mappings (`/events`, `/event-divisions`) | High — parent/sub-event grouping rules, "no mappings = all divisions" semantics, publish cascades | Critical — misconfig leaks workouts across divisions | Q1 |
| Registration management (`/athletes`, `/athletes/$registrationId`) | High — division transfers, purchase transfers, partial refunds (refund reduces organizer net; platform fee isn't returned), rosters, placeholder vs claimed athletes | Critical — the money path | Q1 |
| Heat scheduling + venues (`/schedule`, `/locations`) | High — heats × lanes × divisions × venues | High — in-person day-of run sheet | Q1 |
| Competition create/edit/settings, onboarding (`new`, `/edit`, `/settings`, `onboard`) | Low–Med | Critical — activation funnel | Q2: quick wins |
| Pricing + Stripe Connect (`/pricing`, `/revenue`) | Medium — fee breakdown, Connect onboarding stall point | Critical — no Stripe = no paid registrations | Q2 |
| Divisions + capacity (`/divisions`) | Medium | High — registration depends on it; errors cascade into scoring | Q2 |
| Waivers (`/waivers`) | Medium — athlete vs volunteer flags, pre-signed invites | High — legal liability | Q2 |
| Check-in kiosk (`/check-in`) | Low–Med | Medium — used under day-of stress | Q2 |
| Submission windows (`/submission-windows`) | Medium — parent/sub-event inheritance | High for online comps | Q2 |
| Judge scheduling + AI judges (`/volunteers` judges tab, `/judges-ai`) | Very high — rotation patterns, versions, publish, AI proposals | Medium — larger in-person comps; AI is entitlement-gated | Q3: video, on demand |
| Series + event templates (`series/$groupId/*`) | High — template sync, auto-matching, cross-comp publishing | Medium–High — small audience but they're the pro/retained organizers | Q3 (borderline Q1) |
| Broadcasts (`/broadcasts`) | Medium — audience + question filters | Medium | Q3 |
| Co-hosts (`/co-hosts`) | Medium — 15-key permission matrix | Low–Med | Q3 |
| Competition invites (`/invites/*`) | Very high | Low today — feature-flag gated | Defer until GA |
| Coupons, sponsors, danger zone | Low | Low | Q4: skip; layout-level doc covers them |

### Rest of the system (out of drawer scope today)

| Surface | Complexity | Importance | Recommendation |
|---|---|---|---|
| Athlete compete pages (register, video submission, leaderboard, my-schedule) | Video submission is high (captain-only, per-division, score-required rules) | High — athlete confusion becomes organizer tickets | Phase 3 expansion; Docusaurus covers it meanwhile |
| Cohost dashboard | Mirrors organizer | Medium | Cheapest expansion: same docs, two small code changes |
| Workout tracking app (`_protected`: log, programming, movements) | Medium | Low — access-gated, secondary to compete | Don't invest |
| Platform admin (`/admin`) | Medium | Internal | Never — admins are the doc authors |

## Strategy

### Core principle: split by Diataxis, don't duplicate

The drawer carries **how-to guides** (short, task-shaped — the user is mid-task) and quick reference. The existing Docusaurus site (`apps/docs`, already Diataxis-organized with 30+ pages) keeps **tutorials and explanations**, reached via the drawer's `link` type. Long-form canonical content stays in git/Docusaurus where it gets PR review; the CMS has version history but no review workflow. Drawer markdown should be ≤~300 words and link out for depth.

### Phase 0 — day one (~half a day of CMS data entry, zero writing)

1. **One layout-level orientation doc** mapped to `/compete/organizer/$competitionId` ("Dashboard overview: setup → run → business"). Via inheritance this puts the Docs button on *every* organizer page immediately — which also makes drawer-open events a per-page **demand signal** in PostHog. The button only renders when docs exist, so without a universal doc there is no way to measure where help is wanted.
2. **Link-type docs reusing existing Docusaurus pages:**

| Docusaurus page | Map to route ID(s) |
|---|---|
| `how-to/organizers/schedule-heats` | `/compete/organizer/$competitionId/schedule` |
| `how-to/organizers/manage-registrations`, `registration-questions` | `/compete/organizer/$competitionId/athletes` |
| `how-to/organizers/edit-competition` | `/compete/organizer/$competitionId/edit` |
| `how-to/organizers/send-broadcasts`, `reference/broadcasts` | `/compete/organizer/$competitionId/broadcasts` |
| `how-to/organizers/multi-workout-events` | `/compete/organizer/$competitionId/events` |
| `how-to/organizers/event-day` | `/compete/organizer/$competitionId/check-in` |
| `concepts/scoring-system`, `reference/scoring` | `/compete/organizer/$competitionId/scoring`, `/results` |
| `concepts/division-system`, `reference/divisions` | `/compete/organizer/$competitionId/divisions`, `/event-divisions` |
| `concepts/heat-scheduling` | `/compete/organizer/$competitionId/schedule` |
| `reference/competition-settings` | `/compete/organizer/$competitionId/settings` |

### Phase 1 — weeks 1–2: Q1 markdown how-tos (highest deflection per word)

| Priority | Doc | Route ID | Why first |
|---|---|---|---|
| 1 | "Publish division results" — incl. the online-hidden vs in-person-visible defaults | `/compete/organizer/$competitionId/results` | The publish-gate asymmetry is a guaranteed support generator |
| 2 | "How event–division mappings work" — no-mappings/partial-mapping semantics, sub-event inheritance | `/compete/organizer/$competitionId/event-divisions` | Most confusing semantics in the product |
| 3 | "Review a video submission: verify, adjust, penalize, mark invalid" | `/compete/organizer/$competitionId/events/$eventId/submissions` (layout — inherits to detail page) | Very high complexity, online-comp critical |
| 4 | "Refunds and transfers" — refund reduces organizer net; platform fee isn't returned | `/compete/organizer/$competitionId/athletes` | Money path; financially sensitive |
| 5 | "Editing a registration" — placeholder vs claimed athletes, roster slots | `/compete/organizer/$competitionId/athletes/$registrationId` | Dense page, high traffic |
| 6 | "Connect Stripe and understand the fee breakdown" | `/compete/organizer/$competitionId/pricing` | Activation stall point |
| 7 | "Group multi-part events under a parent" — heat/99-event constraints, publish cascade | `/compete/organizer/$competitionId/events` | Non-obvious constraints |
| 8 | "Preview vs public leaderboard" — what the bypass shows | `/compete/organizer/$competitionId/leaderboard-preview` | Prevents "athletes can see my drafts?" panic |

### Phase 2 — weeks 3–4: Q2 quick wins + Q3 videos

- Short markdown checklists (3–6 steps) for competition creation, divisions + capacity, waivers, submission windows, check-in. The check-in organizer landing page already hand-embeds instructions because there was nowhere else to put them — that's the pattern this feature generalizes; fold those instructions into a drawer doc.
- **Video** for the complex-but-niche heavyweights: a 2–3 minute screen recording each for judge rotations (patterns, versions, publish) and series template sync. The 100MB R2 cap means keep recordings short, or use unlisted YouTube embeds for longer cuts.

### Phase 3 — after measuring: expand the surface

1. **Cohost first** (cheapest, highest overlap): mount `RouteDocsDrawer` in the cohost layout and widen the route-picker filter, then add cohost route IDs to the *same* docs — mappings are many-to-many, so one doc serves both dashboards.
2. **Athlete video-submission flow** next — the highest-value athlete page (captain-only submission, per-division scoping, score-required rules generate organizer tickets today).
3. Skip the workout-tracking app entirely.

### Operational practices

- Author with the publish toggle as a draft workflow; rely on version history for safe edits.
- Add "check `/admin/docs` for stale-route flags" to the release checklist after any route rename.
- Use `sortOrder` to keep the task-shaped doc above link-outs on the same page (leaf-first ordering already handles page-specific vs inherited).
- Keep titles task-shaped ("Publish division results", not "Results").
- Prioritize the ongoing backlog by PostHog drawer-open rate per page crossed with support-ticket topics — not by feature size.

## Summary

Ship day-one coverage by linking the Docusaurus pages that already exist, spend the writing budget on the five Q1 areas (results/publish gates, event-division mappings, submission review, refunds/transfers, scoring), use video only for judge rotations and series templates, and skip sponsors/coupons/danger-zone — the layout-level overview doc covers them for free.
