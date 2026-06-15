# M0 — Competition-Type Capability Registry (Refactor Spec)

> **Status:** Refactor proposal for review. No code written yet.
> **Standalone:** This refactor **ships on its own and is valuable independent of any new competition type.** It de-clutters the existing in-person/online products by replacing scattered `competitionType === "online"` / `=== "in-person"` checks with one declarative source of truth. It is the foundation that makes future types (benchmark boards, leagues, ladders, hybrid formats) cheap — but it earns its keep on the current two types alone.
> **Companion:** Phase **M0** of `hillerfit-benchmark-leaderboard-guide.md`. That guide consumes this registry to add a `"benchmark"` type later (M1); **this spec does not add `"benchmark"`** — it only refactors the two types that exist today. Adding a new type afterward is a few lines (see §9).
> **Migration:** None. `competitionType` stays a TS-only `varchar` discriminator; the registry is a pure function of it.

---

## 1. Problem

`competitionType` (`"in-person" | "online"`, `db/schemas/competitions.ts:118`) is a plain `varchar(15)` with a TS-only `$type`. Feature decisions that hang off it are **scattered as inline string comparisons** across the codebase:

- **~121 comparison sites across 44 files** branch on `competitionType === "online"`, `!== "online"`, `=== "in-person"`, or a locally-computed `isOnline` / `isInPerson` boolean. (Verified: `rg 'competitionType\s*[!=]==|isOnline\b|isInPerson\b'`.)
- The same boolean (`isOnline`) is recomputed in loader after loader and threaded through UI to gate **unrelated concerns** — video submission, submission windows, heat scheduling, check-in, physical-venue display, volunteer scheduling, results-entry mode, leaderboard table choice, sidebar labels.
- **`"online"` is overloaded across two axes.** It is BOTH a `competitionType` AND a `scoringAlgorithm` (`tiebreakers.ts:78`, `scoring-config-form.tsx:62/654`, `competition-leaderboard-table.tsx:132`, `online-competition-leaderboard-table.tsx:174`). Reading `=== "online"` at a glance does not tell you which axis you're on.

**Consequences:** adding or changing a type means hunting 44 files; the "what does online actually enable?" answer lives nowhere; and a new type silently falls into whichever branch the `else` happens to be (usually the in-person path), breaking features by omission.

## 2. Goal & non-goals

**Goal:** one declarative registry mapping each competition type → the **capabilities** it supports, plus tiny accessors (`competitionCan`, `leaderboardVariant`). Refactor the ~121 sites to capability lookups. **Behavior must be byte-for-byte identical** for `"in-person"` and `"online"`.

**Non-goals (explicitly out of scope for M0):**
- Adding a `"benchmark"` (or any new) competition type — that's M1 of the benchmark guide; M0 only proves the pattern on existing types.
- Touching the `scoringAlgorithm === "online"` axis (the 5 sites in §6) — different concern, left alone.
- Any DB migration, schema change, or data backfill.
- Behavior changes, UI redesign, or "while we're here" cleanups beyond the mechanical swap.

## 3. Design

`competitionType` remains the stored discriminator. The registry is a **pure function of it** — no new column, no migration.

```ts
// NEW FILE: src/lib/competitions/capabilities.ts

export type CompetitionCapability =
  | "videoSubmissions"        // athletes submit video + score; review / judge / submissions pipeline
  | "submissionWindows"       // per-event open/close windows
  | "optInResultPublishing"   // division results hidden until explicitly published
  | "heatScheduling"          // heats, venues, lanes, judge & athlete scheduling
  | "dayOfCheckIn"            // day-of check-in kiosk
  | "physicalVenue"           // physical location / address display
  | "volunteerScheduling"     // volunteer schedule tab
  | "organizerEntersResults"  // organizer-entered scores (vs athlete-submitted)

export interface CompetitionTypeDef {
  id: string
  label: string
  capabilities: ReadonlySet<CompetitionCapability>
  leaderboardVariant: "standard" | "online"
  /** Shown in the generic create/type picker. */
  selectableOnCreate: boolean
}

export const COMPETITION_TYPE_REGISTRY: Record<string, CompetitionTypeDef> = {
  "in-person": {
    id: "in-person",
    label: "In-Person",
    leaderboardVariant: "standard",
    selectableOnCreate: true,
    capabilities: new Set([
      "heatScheduling",
      "dayOfCheckIn",
      "physicalVenue",
      "volunteerScheduling",
      "organizerEntersResults",
      // NOTE: in-person does NOT carry optInResultPublishing — confirmed at leaderboard:440-443
      // (online → {} hide-until-published; in-person → undefined show-all). See §3 callout.
    ]),
  },
  "online": {
    id: "online",
    label: "Online",
    leaderboardVariant: "online",
    selectableOnCreate: true,
    capabilities: new Set([
      "videoSubmissions",
      "submissionWindows",
      "optInResultPublishing",
    ]),
  },
}

const EMPTY = new Set<CompetitionCapability>()

export function competitionCan(type: string, cap: CompetitionCapability): boolean {
  return (COMPETITION_TYPE_REGISTRY[type]?.capabilities ?? EMPTY).has(cap)
}

export function leaderboardVariant(type: string): "standard" | "online" {
  return COMPETITION_TYPE_REGISTRY[type]?.leaderboardVariant ?? "standard"
}

export function isSelectableType(type: string): boolean {
  return COMPETITION_TYPE_REGISTRY[type]?.selectableOnCreate ?? false
}
```

> **`optInResultPublishing` — verified online-only (was the one site to confirm; now confirmed).** `competition-leaderboard.ts:440-443` resolves `divisionResults = bypassPublicationFilter ? undefined : (settings?.divisionResults ?? (competitionType === "online" ? {} : undefined))`. So absent an explicit setting, **online** defaults to `{}` (hide every division until published — opt-in) while **in-person** defaults to `undefined` (show all — backwards compat). Therefore `optInResultPublishing` is declared by `"online"` **only**; in-person does NOT carry it. The refactored call site is `... ?? (competitionCan(type, "optInResultPublishing") ? {} : undefined)` — behavior-identical for both existing types, and a future opt-in type (e.g. benchmark) gets `{}` by declaring the capability. The snapshot test (§7) pins it.

**Client helper (optional, for components that need several flags):**

```ts
// returns a plain object so JSX reads `caps.videoSubmissions` instead of recomputing isOnline
export function competitionCapabilities(type: string) {
  return {
    videoSubmissions: competitionCan(type, "videoSubmissions"),
    submissionWindows: competitionCan(type, "submissionWindows"),
    heatScheduling: competitionCan(type, "heatScheduling"),
    dayOfCheckIn: competitionCan(type, "dayOfCheckIn"),
    physicalVenue: competitionCan(type, "physicalVenue"),
    volunteerScheduling: competitionCan(type, "volunteerScheduling"),
    organizerEntersResults: competitionCan(type, "organizerEntersResults"),
    leaderboardVariant: leaderboardVariant(type),
  }
}
```

## 4. Capability truth table (the hypothesis the snapshot test pins)

| Capability | in-person | online | Derived from |
|------------|:---------:|:------:|--------------|
| `videoSubmissions` | ✗ | ✓ | submit/review/judge gates `=== "online"` |
| `submissionWindows` | ✗ | ✓ | submission-window pages `!== "online"` |
| `optInResultPublishing` | ✗ (confirmed) | ✓ | `competition-leaderboard.ts:440-443` |
| `heatScheduling` | ✓ | ✗ | judge/athlete schedule `!isOnline` |
| `dayOfCheckIn` | ✓ | ✗ | check-in routes/fn |
| `physicalVenue` | ✓ | ✗ | location card / address |
| `volunteerScheduling` | ✓ | ✗ | volunteer `isInPerson` |
| `organizerEntersResults` | ✓ | ✗ | results-entry + sidebar |
| `leaderboardVariant` | `standard` | `online` | `leaderboard-page-content.tsx:664` |

## 5. Refactor inventory (the ~121 sites, by capability)

Each cluster below maps `competitionType`/`isOnline`/`isInPerson` checks to the capability matching the site's **real intent** (not a blind `"online"`→helper swap). Line numbers are anchors; confirm at edit time.

### videoSubmissions (~20 sites)
`competitionCan(type, "videoSubmissions")` (replaces `=== "online"` that gates submitting/reviewing/judging video+score):
- `routes/api/compete/scores/submit.ts:70`, `routes/api/compete/video/submit.ts:71`, `routes/api/compete/scores/window-status.ts:35`, `routes/api/compete/scores/judge.ts:173`
- `server-fns/athlete-score-fns.ts:152`, `server-fns/competition-score-fns.ts:188`, `server-fns/video-submission-fns.ts:139` (the `checkSubmissionWindow` type gate)
- `server/competition-leaderboard.ts:847` (fetch video submissions for the board)
- `routes/compete/$slug/workouts/$eventId.tsx:184/213/222/665/692/712`, `routes/compete/$slug/workouts/index.tsx:128/151`
- `routes/compete/$slug/review/$eventId/index.tsx:101`
- `routes/compete/{organizer,cohost}/$competitionId/events/$eventId/submissions/index.tsx:104/101`
- `routes/compete/organizer/$competitionId/athletes/$registrationId.tsx:801/806/812`

### submissionWindows (~3 sites)
`competitionCan(type, "submissionWindows")`:
- `routes/compete/organizer/$competitionId/submission-windows.tsx:27`, `routes/compete/cohost/$competitionId/submission-windows.tsx:35`
- (`window-status.ts:35` can read this OR `videoSubmissions` — pick by intent: "is a window active" → `submissionWindows`.)

### optInResultPublishing (1 site)
`competitionCan(type, "optInResultPublishing")` — **calibrate registry to match §3**:
- `server/competition-leaderboard.ts:443`

### leaderboardVariant (~2 sites)
`leaderboardVariant(type) === "online"`:
- `components/leaderboard-page-content.tsx:629/664`

### heatScheduling (~14 sites)
`competitionCan(type, "heatScheduling")` (today `!isOnline` / `=== "in-person"`):
- `routes/compete/organizer/$competitionId/-components/judges/judge-scheduling-container.tsx:189/589/767`
- `routes/compete/$slug/schedule.tsx:24/29/32/47/65/77/88`, `routes/compete/$slug/my-schedule.tsx:35/156`
- in-person section of `organizer-competition-edit-form.tsx:365` (may split across `heatScheduling` + `physicalVenue`)

### dayOfCheckIn (~3 sites)
`competitionCan(type, "dayOfCheckIn")`:
- `routes/compete/$slug/check-in.tsx:27`, `routes/compete/organizer/$competitionId/check-in.tsx:23`, `server-fns/check-in-fns.ts:77` (`!== "in-person"`)

### physicalVenue (~4 sites)
`competitionCan(type, "physicalVenue")`:
- `components/competition-location-card.tsx:17/24/38`, `utils/address.ts:372`

### volunteerScheduling (~12 sites)
`competitionCan(type, "volunteerScheduling")` (today `isInPerson`):
- `routes/compete/organizer/$competitionId/volunteers.tsx:275/278/282/289/310/322/382`
- `routes/compete/cohost/$competitionId/volunteers.tsx:339/342/346/353/468/480/612`

### organizerEntersResults + nav labels (~25 sites)
`competitionCan(type, "organizerEntersResults")` (inverse of athlete-submitted) and a nav-label helper for "Submissions vs Results":
- `components/competition-sidebar.tsx:96/119/130/145`, `components/cohost-sidebar.tsx:95/147/168` (sidebars touch several capabilities — gate each tab by its own capability, not one `isOnline`)
- `routes/compete/{organizer,cohost}/$competitionId/results.tsx` (organizer:77/102/126/215/235/272/605; cohost:85/107/131/268/287/302/460)
- `routes/compete/{organizer,cohost}/$competitionId/index.tsx` (dashboard summaries)
- `routes/compete/{organizer,cohost}/$competitionId/events/$eventId.tsx` + `/events/$eventId/index.tsx` (online = submission-window editor vs results editor)
- `routes/compete/organizer/$competitionId/athletes/index.tsx:833/864/1652/1777/2066` (`=== "in-person"` check-in columns)
- `routes/compete/organizer/$competitionId.tsx:113` (results-route redirect for online)

### Type identity — picker / filter / create-update (~10 sites; NOT capability gates)
These read/write the type itself; leave the enum, but route the **generic create picker** through `isSelectableType`:
- `components/organizer-competition-form.tsx:464` (+ surrounding), `…/-components/organizer-competition-edit-form.tsx:355`
- `server-fns/competition-server-logic.ts:411` (update `competitionType`)
- `routes/index.tsx:89/296/530`, `routes/compete/index.tsx:28` (public filter by type)

## 6. Leave alone — the `scoringAlgorithm` axis (5 sites)

These are `scoringAlgorithm === "online"` (place-based "golf" scoring), **not** `competitionType`. Out of scope; do not touch:
- `lib/scoring/tiebreakers.ts:78`, `components/compete/scoring-config-form.tsx:62/654`, `components/competition-leaderboard-table.tsx:132`, `components/online-competition-leaderboard-table.tsx:174`

> Add a one-line comment at each (`// scoringAlgorithm axis — not competitionType; see capabilities.ts`) so future readers don't conflate the two `"online"`s.

## 7. Behavior-preservation strategy

1. **Snapshot truth-table test (the safety net).** Before refactoring, hand-author the expected matrix (§4) and assert `competitionCan(type, cap)` reproduces it for `"in-person"` and `"online"` across every capability and `leaderboardVariant`. This is what guarantees the swap changes nothing.

```ts
// capabilities.test.ts
const EXPECTED = {
  "in-person": { videoSubmissions:false, submissionWindows:false, optInResultPublishing:false,
                 heatScheduling:true, dayOfCheckIn:true, physicalVenue:true, volunteerScheduling:true,
                 organizerEntersResults:true, leaderboardVariant:"standard" },
  "online":    { videoSubmissions:true, submissionWindows:true, optInResultPublishing:true,
                 heatScheduling:false, dayOfCheckIn:false, physicalVenue:false, volunteerScheduling:false,
                 organizerEntersResults:false, leaderboardVariant:"online" },
}
// assert competitionCan(type, cap) === EXPECTED[type][cap] for all type×cap
```

2. **Per-site intent mapping, not find-and-replace.** A given `isOnline` may gate two unrelated things; replace each *usage* with the capability for that usage. Where a loader computes one `isOnline` and threads it down, replace the source with a small `capabilities` object (or specific flags) and update each consumer.

3. **Default fallback = `false`.** Unknown type → no capabilities (`EMPTY` set) and `leaderboardVariant "standard"`. For the two existing types this never triggers; it just means a future misconfigured type degrades safely instead of impersonating in-person.

4. **Keep the existing test suite green** at every PR.

## 8. Rollout — staged, independently-mergeable PRs

126 sites is too much for one PR. Split so each lands behavior-preserving and reviewable:

1. **PR-1 — Registry + tests, zero call-site changes.** Add `capabilities.ts` + the §7 snapshot test. Nothing consumes it yet. Mergeable instantly.
2. **PR-2 — Server submission axis.** `videoSubmissions` + `submissionWindows`: the API routes + `server-fns` + `competition-leaderboard.ts:847`. Highest-value, well-isolated, server-side.
3. **PR-3 — Leaderboard + publish gate.** `leaderboardVariant` (`leaderboard-page-content.tsx`) + `optInResultPublishing` (`:443`, calibrated per §3).
4. **PR-4 — Scheduling/check-in.** `heatScheduling` + `dayOfCheckIn` (judge container, schedule routes, check-in).
5. **PR-5 — Venue/volunteers.** `physicalVenue` (location card, address) + `volunteerScheduling`.
6. **PR-6 — Results-entry + sidebars.** `organizerEntersResults` + the nav-label helper (the largest cluster; do it last when the pattern is settled).
7. **PR-7 — Type-identity cleanup.** Route the create picker through `isSelectableType`; add the §6 "scoringAlgorithm axis" comments.

Each PR after PR-1 is a mechanical swap guarded by the unchanged test suite + the snapshot test.

## 9. The payoff — adding a future type (illustration, NOT part of M0)

After M0, a new type is a registry entry + (if needed) one new capability — **no `=== "online"` site is touched again**:

```ts
// later (e.g. benchmark M1) — additive, no refactor:
"benchmark": {
  id: "benchmark", label: "Benchmark", leaderboardVariant: "online", selectableOnCreate: false,
  capabilities: new Set(["videoSubmissions", "optInResultPublishing", "perpetual"]),
}
// "perpetual" added to CompetitionCapability; the ~3 sites that should respect it read competitionCan(type,"perpetual").
```

It inherits video submission, opt-in publishing, the online leaderboard table, and (by omission) no heats/check-in/venue/windows — automatically, everywhere.

## 10. Risks & gotchas

1. **`optInResultPublishing` (§3) — resolved.** Verified online-only at `:440-443`; in-person does not carry it. Kept on this list only because it's the one site where the in-person/online asymmetry is non-obvious — the snapshot test guards it.
2. **Multi-purpose `isOnline` loader booleans.** `results.tsx`, `index.tsx`, `events/$eventId.tsx` compute one `isOnline` used for several decisions. Don't blind-rename to one capability — map each downstream use; thread a `capabilities` object if several are needed.
3. **Sidebars gate multiple tabs.** `competition-sidebar.tsx` / `cohost-sidebar.tsx` hide schedule, check-in, results-vs-submissions off one `isOnline`. Gate each tab by its own capability so a future type can mix-and-match.
4. **The two `"online"`s.** Don't accidentally convert a `scoringAlgorithm === "online"` site (§6). Grep distinguishes by the left-hand operand (`algorithm`/`scoringAlgorithm` vs `competitionType`).
5. **`!== "online"` ≠ "in-person-only" semantically.** Most `!== "online"` means "the non-athlete-submitted path." Convert to the **positive** capability the branch actually wants (e.g. `!competitionCan(type,"videoSubmissions")`), not `competitionCan(type, someInPersonCap)`, so a third type lands correctly.
6. **`competitionType` default stays `"in-person"`** (`competitions.ts:118`); the registry must define `"in-person"` fully so the default keeps working.

## 11. Acceptance criteria

- [ ] `src/lib/competitions/capabilities.ts` exists with the registry + `competitionCan` / `leaderboardVariant` / `isSelectableType` (+ optional `competitionCapabilities`).
- [ ] Snapshot truth-table test passes for `"in-person"` and `"online"` across all capabilities (§7).
- [ ] All ~121 `competitionType`-axis sites (44 files) converted to capability lookups; the 5 `scoringAlgorithm` sites untouched (and commented).
- [ ] `rg 'competitionType\s*===\s*"online"|competitionType\s*!==\s*"online"|isOnline\b|isInPerson\b'` over `src` returns only the registry file + intentional type-identity reads (picker/filter/update).
- [ ] Full existing test suite green; `pnpm type-check`, `pnpm check` pass.
- [ ] No DB migration in the diff (`pnpm db:generate` produces nothing).
- [ ] Manual smoke: an in-person and an online competition render identically to `main` (sidebars, leaderboard, submission/results flows, check-in, schedule, location).

## 12. lat.md documentation

- **NEW** `lat.md/competition-types.md` — the capability registry as the source of truth for type-gated features; the capability vocabulary; the two-axis `"online"` caveat (competitionType vs scoringAlgorithm); how to add a type. Source refs `[[src/lib/competitions/capabilities.ts#competitionCan]]`, `[[src/db/schemas/competitions.ts]]`.
- **Update** `lat.md/domain.md` (Competitions) + `lat.md/architecture.md` — point type-gating to the registry instead of inline checks.
- Run `lat check` — links/code refs must pass (project post-task requirement).

---

*End of M0 spec. Consumed by `hillerfit-benchmark-leaderboard-guide.md` (the `"benchmark"` type is added in that guide's M1, on top of this registry).*
