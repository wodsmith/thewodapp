# Generic Benchmark Leaderboard — HillerFit Training PDF Seed

> **Status:** Implementation contract maintained during the phased benchmark build (**revision 4** — updated after M0a/M1/M2/M3/M4 landed on `feat/hillerfit-plan`). This is the document Zac reviews before changing product scope or reopening fixed decisions.
> **Scope:** A generic, reusable "benchmark battery" feature, with the local `HillerFit_Training_Guide.pdf` as the first benchmark data source, plus a degenerate "post your bench" single-test case. **The PDF is source data only. We are not building any HillerFit-branded page, route, navigation item, marketing surface, logo, theme treatment, or customer-facing product area.** The user-facing product remains WODsmith's generic benchmark experience.
> **Phasing (revised):** **v1 starts with an M0a competition-type capability registry** (chokepoint refactor only; the ~100-site M0b cleanup is deferred post-demo) (so `"online"` stays a clean standalone product), then ships a training-guide-derived benchmark — the absolute-tier engine + a public **best-to-date** Overall/100 board + per-athlete stat line on a **distinct `competitionType:"benchmark"`**. **The generic authoring UI, retest-history windowing, and the hybrid Open-test class are explicitly v2** (additive, no rewrites — the data model is generic from day one). See §10.
> **Grounding:** Every architectural claim below is tied to a real file:line in `apps/wodsmith-start/src/`, re-verified against the codebase in this revision. Key decisions called out inline: the **capability-registry refactor of the ~129 `competitionType` sites (M0a chokepoints first, M0b cleanup deferred)** (owner steer — distinct `"benchmark"` type, NOT reuse `"online"`), the v1 `EventScoreInput.variant` addition plus v2 `secondaryValue` plumbing, the `scoreType`-driven direction with no `direction` column, `int`-not-`bigint` thresholds, the DB-`dq`→engine-`dnf` status mapping, and the leaner phasing.
> **Implementation packet:** the build-ready requirements, technical design, task list with acceptance criteria, test strategy, and reviewer alignment live in `ai/research/hillerfit-benchmark-leaderboard/`. Treat this guide as the narrative source and the packet as the implementation contract. Current checkout note: M4 has landed on the feature base; `"benchmark"` is registered with `videoSubmissions` and `perpetual`, the PDF-derived seed exists, absolute-tier scoring and best-to-date submission are implemented, and the generic leaderboard/stat-line demo is in place.
>
> **Revision 2 — what the second adversarial critique (verified against the codebase) changed.** Each was confirmed against real `file:line` before editing:
> 1. **Overall/100 was double-scaled** (would have produced 700/1000, not 0–100). Fixed in §6.4; renamed the ambiguous `categoryScale`/`overallMax` to `maxTier`/`scoreMax`.
> 2. **v1 was overclaiming "all-time."** With overwrite-in-place it was only "latest." Now v1 is **best-to-date** via a **keep-best-on-write** guard (§8.1, §10 M3); true windowed all-time history stays v2.
> 3. **Sex variant was conflated with the division key.** `scalingLevelId` is dual-used as `divisionId` across grouping/dedupe/publish/upsert — encoding M/F there would drop or split the board. Variant now snapshots onto a new **`scores.benchmarkVariant`** column; `scalingLevelId` stays the single "Open" division (§5.1, §8.1, §13).
> 4. **The `?? "male"` fallback** (silent mis-tiering) is removed — missing variant now **fails closed** (§6.2).
> 5. **Live-gender re-tiering** fixed: variant is read from the snapshot, not live `user.gender`, so a profile change never re-tiers prior scores (§8.1, §13).
> 6. **The `absolute_tier` dispatch seam** is now concrete: `calculateEventPoints` gains a preloaded `ctx:{scoreType, tableByEventId}`; thresholds + a score-variant lookup from `scores.benchmarkVariant` are loaded **once** (no N+1) (§6.2, §3.2).
> 7. **Countback was field-relative** (wrong for absolute tiers). Replaced with a **tier-histogram tiebreaker** (§6.5).
> 8. **Benchmark results would have been invisible** (the `optInResultPublishing` capability hides every event until published). Benchmark now **auto-publishes** valid scores — capability dropped (§5.2, §7.4).
> 9. **Training-guide denominator pinned**: v1 is a 55-test Lite benchmark with the deferred tests *excluded from the denominator* via an `includedInScoring` flag; the denominator is **derived from active tests**, not a hand-maintained JSON count (§2.1, §6.4, §13).
> 10. Plus: `ScoringConfig.superRefine` (§5.2), `UNIQUE(ownerKey, slug)` null-safe key (§5.3), score-time `BenchmarkConfigError` for missing thresholds (§6.1, §13.2), `isOpenJoin` abuse guards (§8.1), per-battery `videoPolicy` + verification badge (§8.1/§8.3), M0 split into **M0a (chokepoints) / M0b (deferred cleanup)** with characterization tests (§10), Weighted C2B **recommended deferred** to v2 (§2.5), per-encoding-family fixtures (§11), and the §2.7 `ASC/DESC` seed-poison labels removed.

---

## 0. Decision sheet — confirm before M1

**Implementation decisions are split into fixed assumptions and source-data checks.** D-A, D-B, D-C, D-D, and D-E are treated as accepted for implementation because the guide already depends on them throughout. D-D means the first seed is derived from the supplied training PDF, not from branded page design. "HillerFit" is provenance for the local source artifact, not a WODsmith customer-facing brand or page family.

| # | Decision | Recommended | One-line why |
|---|----------|-------------|--------------|
| **D-A** (§12.2) ✅ fixed | Competition type | **Distinct `competitionType:"benchmark"` behind a capability registry** (not reuse `"online"`), **split into M0a chokepoints + M0b deferred cleanup** | Keeps the standalone online product clean; a mechanical, behavior-preserving refactor of the **~129** `=== "online"`/`"in-person"` checks (verified: `competitionType` 60 / `isOnline` 55 / `isInPerson` 14 across **61 files**) → capability lookups. v1 refactors **only the chokepoints benchmark needs (M0a)**; the rest is deferred (M0b). *(Reversed per owner steer; scoped down per critique #6.)* |
| **D-B** (§12.1) ✅ fixed | Sex axis | **Per-athlete `variant` → one unified Overall/100 board** (not Men/Women divisions) | The single unified scale *is* the product — but it's the biggest engine change (`EventScoreInput.variant`, gender threading), not a free win. |
| **D-C** (§12.5) ✅ fixed | Windowing + retest history | **Defer windowing + per-attempt history to v2; v1 is _best-to-date_ only** (live `scores` row, kept monotonic via **keep-best-on-write**, §8.1) | `score_attempts`/`promoteBest` is the riskiest piece (sortKey needs round-level data). v1 is honestly "best-to-date," **not** "all-time": a keep-best guard makes the single live row monotonic, but without history an `invalid` action can't restore a prior best (that's v2). |
| **D-D** (§12.12) ✅ fixed | Source-data-only branding boundary | **Use `/Users/zacjones/Downloads/HillerFit_Training_Guide.pdf` as the benchmark data source only; do not build any HillerFit-branded page or product surface** | The full chart is sized around 58×2×10, while v1 scores 55 included tests. The build extracts benchmark tests/thresholds from the PDF into generic WODsmith benchmark data; any branded page, route, nav entry, logo, CTA, marketing copy, or theme is out of scope. |
| **D-E** ✅ **resolved** | Gender source | **`user.gender` (strict Male/Female) from the athlete profile; required for benchmark participation** | Platform is Male/Female only (`GENDER_ENUM`, `users.ts:23`) — already an enum + profile-capture flow (`athlete-profile-fns.ts:148`). Variant = profile gender; no submit-time picker, no non-binary case. |

**v1 critical path:** M0a capability registry + chokepoint refactor → M1 schema + training-PDF-derived seed → M2 `absolute_tier` algo → M3 submission → M4 generic benchmark leaderboard + `/stats` (the demo), then validate with a real gym before any v2 (and the M0b cleanup). (§10.)

---

## How to read this doc

- **Skim:** Sections 1 (Executive summary), 4 (Gap analysis table), 12 (Open decisions). That's the decision surface.
- **Deep:** Sections 5–8 are the build. Section 10 is the phased plan.
- **Reference:** Section 2 is the HillerFit spec systematized; Section 3 is the as-is architecture map.

---

## 1. Executive summary

We are building a **generic, reusable "benchmark battery" product** — a self-paced, always-open fitness-rating system where an athlete tests themselves across a set of benchmarks, each test yields an absolute **tier (0 / 0.5 / 1–10)** from a fixed per-sex lookup table, and the tiers collapse to per-category attribute scores and an **Overall out of 100** ("a video-game stat line for your fitness"). The local HillerFit training guide PDF supplies the first benchmark data set (4 categories, 58 designed tests), but the shipped UI is WODsmith's generic benchmark board and stat-line experience. No HillerFit-branded page, route, nav item, logo, CTA, marketing copy, or visual theme ships in v1. A single-test "post your bench" board is the same machinery with one category and one test.

**Headline decisions (decided, not open):**

1. **Reuse the online-competition runtime via a capability registry — don't fork it, don't overload `"online"`.** A battery *is* a competition (one `competitions` row, `trackWorkouts` as the tests, one Open division, `scores.benchmarkVariant` as the sex/variant snapshot, and video submissions reused verbatim). We reuse the submission, verification, and live-read leaderboard stack through a new **competition-type capability registry** (§5.2) that benchmark *opts into*, leaving the standalone online product untouched.
2. **Add an `absolute_tier` scoring algorithm**, not a parallel computor. It slots into the existing `calculateEventPoints` dispatch switch (`src/lib/scoring/algorithms/index.ts:159`). It is the *first* algorithm whose points are computed per-athlete-independently (a table lookup) rather than from field-relative ranking.
3. **Tier tables live in real DB tables, not JSON.** 58 tests × 2 sexes × 10 thresholds = 1,160 numbers that are joined and read on every leaderboard render and edited per-cell by organizers. They belong in queryable, indexable, editable tables (`benchmark_*`), not in a `settings` JSON blob.
4. **Sex is a *variant* sourced from `user.gender`**, threaded into the scoring engine as a new optional `EventScoreInput.variant` field — *not* modeled as a difficulty division. Men and women rank on one unified Overall/100 board. (This is the most consequential open decision; see §12.1. **Note:** this is *not* a free win — it is the single largest source of new engine surface; see §12.1 for the companion costs.)
5. **Perpetual via no-window; windowing is a deferred (post-v1) layer.** Submission windows are simply never seeded (the window check already allows-all when no window rows exist). The live `scores` row carries `recordedAt` (`scores.ts:87`, `NOT NULL`, indexed `idx_scores_user`), which records the athlete's **current value** for free; a **keep-best-on-write** guard (§8.1, M3) keeps that single live row monotonic so v1 is honestly **best-to-date** — **not** "all-time" (the live row holds the latest write unless the guard suppresses a worse retest). The `score_attempts` history table + `promoteBest` + 12/24-month windows + **invalidation-restore** are a **v2 layer** pulled OFF the v1 critical path (see §10) — they exist only to serve windowed/retest/audit views, which v1 does not need to validate the concept.
6. **The migration boundary:** `competitionType` and `scoringAlgorithm` widenings are **migration-free** (both are TS-only `varchar`s with no DB enum). The new `benchmark_*` tables and the two `trackWorkouts` columns **do require a real MySQL migration** (`pnpm db:generate`). `score_attempts` is a real table too but is deferred with windowing. Don't conflate the two.
7. **Benchmark is a distinct `competitionType: "benchmark"` behind a capability registry.** Today `checkSubmissionWindow` (`video-submission-fns.ts:114`) hard-rejects any `competitionType !== "online"` at `:139`, and **~129 comparison sites** across **61 files** branch on `competitionType`/`isOnline`/`isInPerson` (verified counts: 60 / 55 / 14). Rather than overload `"online"`, **M0a** introduces `competitionCan(type, capability)` (§5.2) and refactors the **chokepoint** sites benchmark v1 actually needs to capability lookups — **behavior-preserving for online/in-person** — deferring the remaining cleanup (**M0b**, §10). Benchmark then declares `{videoSubmissions, perpetual}` (**NOT** `optInResultPublishing` — that capability hides every event until the organizer publishes it, which would render a 55-test board empty; §5.2/§7.4) and works at the chokepoints without touching those sites again. See §12.2.

**Conflict 1 — sex axis (decided here):** Pillar 4 (experience) initially proposed modeling sex as **divisions** (zero engine change); Pillars 1 & 2 proposed modeling sex as a **variant** threaded into the engine. **We adopt the variant model** (one unified Overall/100 board, the entire HillerFit mental model). The division-based approach is recorded as the rejected alternative in §12.1. This is the costliest engine change, not a free win — it forces `EventScoreInput.variant`, `user.gender` threading, the nullable-`scalingLevelId` tier-0 trap (§13.5), and requiring gender (M/F) on the athlete profile, all as **mandatory companions** (§12.1).

**Conflict 2 — competition type (resolved per owner steer):** an intermediate draft proposed reusing `competitionType: "online"` to avoid touching the `=== "online"` sites. **Reversed.** Online competitions are a crucial standalone product and must not be muddied with benchmark behavior. We adopt a **distinct `competitionType: "benchmark"` behind a capability registry** (§5.2): the **~129** scattered `competitionType`/`isOnline`/`isInPerson` checks (across 61 files) are refactored into `competitionCan(type, capability)` lookups — behavior-preserving for `"online"`/`"in-person"` (each declares exactly what it already does) — and benchmark opts into only `{videoSubmissions, perpetual}`. To bound the blast radius, the refactor is **split**: **M0a** does only the chokepoints benchmark v1 needs (submission gate, publish-gate default, leaderboard variant, route/tab visibility); **M0b** does the remaining heats/check-in/venue/volunteer/results-entry/sidebar sites later, opportunistically. The refactor is mechanical, independently valuable (it also de-clutters the online product), and makes every *future* competition type cheap. This is the foundational **M0a** milestone (§10).

---

## 2. The HillerFit system, systematized

An **absolute** rating system. Numbers come from the past 12–24 months; the chart is meant to refresh every 2–3 years. Sex (M/W) is **required** because it selects the tier table.

### 2.1 Categories and aggregation

| Code | Category | Tests (design) | Tests (v1 incl.) | Category score formula | Weight |
|------|----------|----------------|------------------|------------------------|--------|
| `STR` | Strength | 15 | 15 | `Σtier ÷ count ÷ maxTier × scoreMax` | equal |
| `GYM` | Gymnastics | 14 | 13 ¹ | `Σtier ÷ count ÷ maxTier × scoreMax` | equal |
| `ENG` | Engine | 14 | 14 | `Σtier ÷ count ÷ maxTier × scoreMax` | equal |
| `WORKOUT` | Benchmark Workouts | 15 | 13 ² | `Σtier ÷ count ÷ maxTier × scoreMax` | equal |
| | **Total** | **58** | **55** | | |

> ¹ Weighted C2B Pull Up recommended **deferred** to v2 (the representative-bodyweight test, §2.5/#14). If shipped in v1 with the baked constant, GYM = 14 / total = 56. ² Open 16.2 + Open 18.4 (hybrid reps-or-time) deferred to v2 (§2.5, §6.3). The `includedInScoring` flag (§5.3) drives the real count either way.

- **Overall (out of `scoreMax` = 100)** = the **(weighted) mean of the category scores**. HillerFit weights are all equal, so this is `(STR + GYM + ENG + WORKOUT) ÷ 4`. With `maxTier = 10` and `scoreMax = 100`, each category score `Σtier ÷ count ÷ maxTier × scoreMax` lands on 0..100, and Overall is their mean on 0..100 — **there is no second rescale** (the earlier draft's `÷ categoryScale × overallMax` double-scaled to 1000; fixed in §6.4).
- The denominator `count` is the **count of active `includedInScoring` tests in the category**, **derived from the seeded `benchmark_tests` rows** (not a hand-maintained JSON number — §6.4/§9), and **not** the count of *submitted* tests. Untested-but-included tests contribute tier `0` to the numerator, dragging Overall down. **v1 Lite excludes the deferred tests from the denominator** so athletes are never penalized for tests they cannot take; the full-58 chart is **v1.1** once the hybrids (and Weighted C2B) ship. **`scoreMax` requires Tier 10 on every included test** — essentially unachievable.

### 2.2 Rating bands

| Overall | Band |
|---------|------|
| 90–100 | Elite |
| 75–89 | Regional caliber |
| 60–74 | Seriously trained |
| 45–59 | Intermediate |
| 30–44 | Trained beginner |
| < 30 | Early |

### 2.3 Tier rule (per test — a STEP/LOOKUP, never interpolated)

| Tier | Meaning |
|------|---------|
| `0` | Can't perform the movement **or** hasn't tested it yet |
| `0.5` | Completed the test but came in **below the Tier 1 minimum** |
| `1`–`10` | The **highest** tier whose threshold you met (per the sex table) |

"You're a 7 or you're not." Each test has its own **M** and **W** table of 10 thresholds (T1..T10).

### 2.4 Units & direction (critical — each test needs a unit + a direction)

> **Direction terminology in this table is "better-direction" (which way is a *better tier*), NOT the engine's sort direction.** In the engine, `getSortDirection` (`sort/direction.ts:23`) returns `"asc"` (lower value better, e.g. time) or `"desc"` (higher value better, e.g. load/reps). For a tier table, "higher value = better tier" ⇒ engine `desc`; "lower value = better tier" ⇒ engine `asc`. **There is no `watts` scheme** in `WORKOUT_SCHEME_VALUES` (the 11 are `time, time-with-cap, pass-fail, rounds-reps, reps, emom, load, calories, meters, feet, points` — `workouts.ts:36`). "Avg Watts" is modeled as **scheme `points` (raw int, `desc`)** or `reps`; the athlete enters the watt number directly. See §6.1 for how direction is resolved (the cleaner path is `scoreType`, not a separate column).

| Category | Typical unit | Better tier when | Engine encoding |
|----------|--------------|------------------|-----------------|
| STR | load (lb), 1RM | **higher** | scheme `load`, `scoreType max` → engine `desc`. Rep variants ("Max Reps Bench 225/155") = scheme `reps`/`scoreType max` → `desc`; load variants ("20 Rep Back Squat", "Gwen in 10:00") = `load`/`max` → `desc` |
| GYM | max consecutive reps | **higher** | scheme `reps`/`scoreType max` → `desc`. **Holds** ("L Sit Hold", "Dead Hang") are **time, longer = better** — model as scheme `time` with **`scoreType max`** so `getSortDirection("time","max") === "desc"` (the explicit `max` override flips time's default `asc` to `desc`). Inches → `feet`/`max`; feet ("HS Walk") → `feet`/`max`; count ("Pegboard") / reps ("3:00 AMRAP GHDSU") → `reps`/`max` |
| ENG | **time (HH:MM:SS)** | **lower** | scheme `time`/`scoreType min` → engine `asc`. **Higher-is-better exceptions** model with scheme + `scoreType max`, NOT as `time`: "BikeErg 20min Avg Watts" → `points`/`max` → `desc`; "Max Unbroken Double Unders" → `reps`/`max` → `desc` (these are *not* time tests, so they do not need a direction override at all) |
| WORKOUT | mostly **time** | **lower** | scheme `time`/`scoreType min` → `asc`. **Higher-is-better exceptions:** "Cindy (rounds)" → `rounds-reps`/`max` → `desc`; "Open 14.4 (reps)" → `reps`/`max` → `desc`; "7 min AMRAP Burpees (reps)" → `reps`/`max` → `desc` |

> **Key correction vs the earlier draft:** the BikeErg-watts and double-unders "exceptions" are NOT time tests living among time tests — they are count/points tests whose natural scheme is already `desc`. The only test class that genuinely needs the engine's default direction *reversed* for a given scheme is **time-based holds** (longer = better), and those are handled cleanly by setting **`scoreType: "max"`** on a `time` test (no per-test override column needed). See §6.1 — we resolve direction via `getSortDirection(scheme, scoreType)` and drop the `direction` column from the schema.

### 2.5 Special score shapes

- **Weighted C2B Pull Up (lb) — DEFERRED from v1 by default.** The complete encoding design is preserved for v1.1/v2 if the owner chooses to ship it later: T1 = `"BW"` (bodyweight), T2 = `"+5"`, then absolute added lb (25, 45, …). The simple option bakes a **representative bodyweight constant per variant** at seed time, so every threshold is a plain encoded load and the test stays inside the pre-encode-everything model:
  - **Representative bodyweight constants:** `M = 185 lb`, `W = 145 lb` (sourced as round CrossFit-population medians; recorded as a tunable constant in `hillerfit-battery.ts`, revisit if accuracy complaints arise).
  - **Threshold encoding:** `"BW"` → `bodyweight_lb × 453.592 g`; `"+N"` → `(bodyweight_lb + N) × 453.592 g`; bare `"25"` → `(bodyweight_lb + 25) × 453.592 g` (HillerFit's bare numbers are *added* weight, consistent with `"+5"`).
  - **Submit contract if enabled later (the athlete INPUT):** the athlete enters **added weight in lb** (e.g. `+25`, or `0`/`BW` for bodyweight). The submit path encodes `(representativeBodyweight_lb + addedWeight_lb) × 453.592` and writes it as a normal `load` score. No new `parseScore`/`encodeScore` rule is needed at the engine level — the representative-bodyweight add happens in the benchmark submit wrapper before calling `encodeScore("<total lb>", "load")`. The unit hint on this test is a dedicated `inputUnit: "lbs_added"` so the form knows to add the constant.
  - **Accepted inaccuracy (state it explicitly):** a 220 lb athlete doing strict BW C2B is **under-credited** (scored as if 185 lb), and a 150 lb athlete is over-credited. This is the one test that breaks pre-encode purity; true per-athlete bodyweight (capturing weight at submit) is the v2 upgrade (§12.8 Option B).
  - **⭐ Recommendation (revised) — DEFER Weighted C2B to v2 rather than ship the baked-constant version on a public board.** This is the single GYM test (1 of 14) whose scored value is *knowingly wrong by design*; capturing a visibly-unfair number on a public benchmark leaderboard is a trust cost the inaccuracy note above admits, and deferring one test (GYM → 13 included, §2.1) is as cheap as deferring the 2 hybrids. **If the owner chooses to ship it in v1**, the submit wrapper must still **capture `bodyweightLbAtAttempt` + `addedWeightLb` on the score row** even while scoring off the representative constant, so the v2 per-athlete recompute is backfillable without re-collecting data. See §12.8 (Option C) and the §13 trust risk.
- **Hybrid reps-or-time (CrossFit-Open style) — DEFERRED out of v1 (see §10).** "Open 16.2 (time/reps)" and "Open 18.4 (reps/time)". Lower tiers are a **rep count** (didn't finish under cap); top tiers flip to a **finish time** (finished). Example — **Open 18.4 M:** T1..T6 = `62, 82, 103, 123, 144, 164` reps; T7..T10 = `8:30, 7:55, 6:50, 6:00` times. This is the single trickiest test class (2 of 58 tests) and is **omitted from the v1 seeded HillerFit battery** (marked "coming soon"); the schema columns that support it (`scoreModel`, `hybridFlipTier`, `hybridScale`) stay nullable so it can be added later without a migration. The full design is preserved in §6.3 for the v2 milestone, including the cap/finish status derivation and the non-monotonic best-attempt caveat.

### 2.6 The 58 tests

| Cat | Tests |
|-----|-------|
| **STR (15)** | Strict Press, Push Press, Bench Press, Deadlift, Power Snatch, Squat Snatch, Power Clean, Squat Clean, Clean & Jerk, Front Squat, Back Squat, Overhead Squat, Max Reps Bench (225/155), 20 Rep Back Squat (lb), Gwen in 10:00 (lb) |
| **GYM (14)** | Max Strict Pull Up, Max Chest to Bar Pull Up, Weighted C2B Pull Up (lb), Max Toes to Bar (unbroken), Max Strict HSPU, Max Kipping Ring Muscle Up, Max Bar Muscle Up, Max Strict Ring Dip, L Sit Hold, 3:00 AMRAP GHDSU (reps), Vertical Jump (in), Dead Hang, Unbroken Handstand Walk (ft), Unbroken Pegboard Ascents |
| **ENG (14)** | BikeErg 20 min Avg Watts, Echo Bike 50 cal, Ski Erg 2K, Max Unbroken Double Unders, Beat Bagent, Regional Triple 3, Acid Bath, 400m Sprint, 1 Mile Run, 5K Run, 10K Run, 500m Row, 2K Row, 5K Row |
| **WORKOUT (15)** | Fran, Diane, Helen, Grace, Isabel, Amanda, Elizabeth, Nancy, Murph (vest), Cindy (rounds in 20), 100 Wall Ball / 100 Cal Row, Open 14.4 (reps), Open 16.2 (time/reps), 7 min AMRAP Burpees (reps), Open 18.4 (reps/time) |

### 2.7 Example tier tables (data shape)

```
# Thresholds are listed T1..T10 ASCENDING BY TIER (T1 = easiest qualifying mark, T10 = hardest),
# and are PRE-ENCODED at seed time. Better-direction is resolved by scoreType (§6.1), NEVER by a
# label in the seed — do NOT write "ASC"/"DESC" in seed data (that conflates threshold ordering
# with engine sort direction and was the trap in the earlier draft).

Strict Press   scheme=load  scoreType=max  better=higher  (engine: desc)
  M: 115 130 150 170 185 195 210 220 235 245   # lb, T1..T10
  W:  75  90 100 110 125 135 140 150 155 165

1 Mile Run     scheme=time  scoreType=min  better=lower   (engine: asc)
  M: 8:00 7:30 7:00 6:30 6:00 5:48 5:36 5:24 5:12 5:00   # T1..T10
  W: 8:30 8:08 7:45 7:22 7:00 6:44 6:28 6:12 5:56 5:40

Open 18.4 (HYBRID reps-then-time, v2)   scheme=time-with-cap
  M reps  (scoreType=max, tiers 1..6):  62 82 103 123 144 164
  M time  (scoreType=min, tiers 7..10): 8:30 7:55 6:50 6:00
```

---

## 3. Current online-competition architecture (as-is — what we REUSE)

A concise map of the machinery a battery rides on. All paths under `apps/wodsmith-start/src/`.

### 3.1 Competition + scoring schema

| Concern | Location | Verified fact |
|---------|----------|---------------|
| `competitionType` | `db/schemas/competitions.ts:118` | Plain `varchar(15)` with TS-only `$type<"in-person"|"online">`, default `"in-person"`. **Adding a value needs NO SQL migration.** |
| `COMPETITION_TYPES` const | `db/schemas/competitions.ts:486` | Source of truth for the union: `{ IN_PERSON, ONLINE }`. |
| `competitions.settings` | `db/schemas/competitions.ts:92` | Nullable `text()` JSON, typed `CompetitionSettings`, parsed/serialized in TS (`types/competitions.ts:68/84`). Malformed JSON silently → `null`. |
| `CompetitionSettings` | `types/competitions.ts:33` | Holds `scoringConfig?`, `divisions?.scalingGroupId`, `divisionResults?` (publish gate keyed `[trackWorkoutId][divisionId].publishedAt`). |
| `ScoringConfig` (Zod) | `schemas/scoring.schema.ts:124` | **Flat** `z.object` with `algorithm` + optional siblings (`traditional?`, `pScore?`, `customTable?`, `tiebreaker`, `statusHandling`). **NOT** a discriminated union. |
| `ScoringAlgorithm` enum | `schemas/scoring.schema.ts:20` | Exactly 5: `traditional, p_score, winner_takes_more, online, custom`. |
| Types barrel | `types/scoring.ts:13` | Pure re-export of the Zod schema file. |

### 3.2 Scoring engine (`src/lib/scoring/`)

| Concern | Location | Verified fact |
|---------|----------|---------------|
| Dispatch entry | `lib/scoring/algorithms/index.ts:159` | `calculateEventPoints(eventId, scores, scheme, config)` → `Map<userId, {points, rank}>`. Switches on `config.algorithm` over 5 cases with a `never` exhaustiveness check at `:182`. **This signature is insufficient for `absolute_tier`** — it carries no `scoreType` and no per-event threshold tables. §6.2 widens it with an optional **preloaded** `ctx: { scoreType, tableByEventId }` (built once, not queried inside the dispatch) rather than overloading `config`. |
| `EventScoreInput` | `lib/scoring/algorithms/index.ts:40` | Exactly `{ userId, value (encoded int), status, sortKey? }`. `status` is `"scored" \| "cap" \| "dnf" \| "dns" \| "withdrawn"`. **No `variant` field and no `secondaryValue` field today** — `secondaryValue` lives only on `scoresTable` (`scores.ts:72`) and on `lib/scoring/types.ts` `timeCap.secondaryValue`, never on `EventScoreInput`. The `absolute_tier` work must add **both** `variant?: string` AND `secondaryValue?: number \| null` here (see §4). |
| DB vs engine status mismatch | `db/schemas/scores.ts:33` / `competition-leaderboard.ts:300` | DB `SCORE_STATUS_NEW_VALUES = ["scored","cap","dq","withdrawn"]` — has **`dq`, no `dns`/`dnf`**. `mapScoreStatus(s.status)` maps `scored→scored`, `cap→cap`, **`dq→dnf`**, `withdrawn→withdrawn`, anything else `→dns`. The `absolute_tier` tier-0 branch (§6.1) keys on the **engine** status (`dns`/`withdrawn`); a DB `dq` arrives as engine `dnf`, so the tier function must also treat `dnf` as tier 0. |
| `EventPointsResult` | `lib/scoring/algorithms/index.ts:57` | `{ userId, points, rank }`. `rank` is mandatory and intrinsically relative. |
| Place→points (missing scores) | `lib/scoring/algorithms/index.ts:628` | `calculatePointsForPlace` — second switch with its **own** `never` check. Returns `0` for `p_score`. |
| Encoding | `lib/scoring/encode/index.ts:55` | `encodeScore(input, scheme, opts)`. time→ms, load→grams (`lbs×453.592`), distance→mm, rounds-reps→`rounds×100000+reps`, reps/cal→raw int. |
| Sort direction | `lib/scoring/sort/direction.ts:23` | `getSortDirection(scheme, scoreType)`. `time`/`time-with-cap` = ascending (lower better); everything else descending. |
| Tiebreakers | `lib/scoring/tiebreakers.ts:69` | `applyTiebreakers` — higher points = better, except `online` (lower better). |

> **Critical:** sex/gender exists ONLY on `users.gender` (`db/schemas/users.ts`). Zero hits in `src/lib/scoring` or `schemas/scoring.schema.ts`. The leaderboard groups by **division** (`scalingLevelId`), never by sex.

### 3.3 Leaderboard pipeline (`src/server/competition-leaderboard.ts`)

| Concern | Location | Verified fact |
|---------|----------|---------------|
| Entry | `competition-leaderboard.ts:393` | `getCompetitionLeaderboard({competitionId, divisionId?, bypassPublicationFilter?})` → `{entries, scoringConfig, events}`. **No cache, fully recomputed per request.** |
| Server fn | `server-fns/leaderboard-fns.ts:86` | `getCompetitionLeaderboardFn` (GET). Input `{competitionId, divisionId?, preview?}`. |
| `fetchScores` | `competition-leaderboard.ts:212` | Param is `{ trackWorkoutIds, userIds, includeInvalid? }` (the org-preview flag is named **`includeInvalid`**, not `preview` — `preview` lives on the `getCompetitionLeaderboardFn` *input* at `leaderboard-fns.ts`, and `getCompetitionLeaderboard`'s own bypass is `bypassPublicationFilter?`). WHERE only on `competitionEventId IN (…)`, `userId IN (…)`, and (non-`includeInvalid`) `verificationStatus != 'invalid'`. **It selects `secondaryValue`, `status`, `sortKey`, etc. but NO user fields and NO date column** — `recordedAt` (scores.ts:87) is not in `fetchScores`'s select. (`recordedAt` *does* exist and is `NOT NULL` on the row; it is simply unused here. It is a partial all-time-window source; see §7.1.) |
| User gender is in scope — but is **not** the v1 variant source | `competition-leaderboard.ts:691` | The registrations query selects `user: userTable` (the **whole** user row), so `reg.user.gender` is available without a new join. **Two corrections vs the earlier draft:** (a) **don't read it live** — re-reading `user.gender` at render re-tiers every prior score when an athlete changes their profile (no server cache; §13/#24). v1 reads the variant from a **snapshot column `scores.benchmarkVariant`** written at submit (§8.1). (b) **don't `find()` per score** — `filteredRegistrations.find(r => r.user.id === score.userId)` inside the per-event loop is O(events × scores × regs); build a `Map` **once** before the loop (§6.2/§13). |
| Per-(event,division) scoring | `competition-leaderboard.ts:1147` | `eventScoreInputs: EventScoreInput[]` built at `:1102–:1144`, then `calculateEventPoints(...)` called once per group at `:1147`. **This is the call site where `variant` and `secondaryValue` must be populated onto each `EventScoreInput`.** |
| `pointsMultiplier` | `competition-leaderboard.ts:1153` | `const multiplier = (trackWorkout.pointsMultiplier ?? 100) / 100`; points later `Math.round`ed. |
| Entry shape | `competition-leaderboard.ts:71` | `CompetitionLeaderboardEntry` — load-bearing, re-exported at `leaderboard-fns.ts:45` and consumed client-side. |
| Final ranking | `competition-leaderboard.ts:1470–:1514` | `const leaderboard = Array.from(leaderboardMap.values())` at **`:1470`**; per-division `applyTiebreakers` loop comment at `:1480`, tiebreaker input `totalPoints: e.totalPoints` at **`:1486`**, `applyTiebreakers(...)` call at **`:1497`**; final sort (`divisionId.localeCompare` then `overallRank`) at **`:1508–:1514`**. **Not a raw `totalPoints` sort.** |
| Client cache | `routes/compete/$slug/leaderboard.tsx:18` | Only mitigation is router `staleTime: 10_000`. |

### 3.4 Submission + verification (online athlete write path)

| Concern | Location | Verified fact |
|---------|----------|---------------|
| Athlete submit | `server-fns/video-submission-fns.ts:870` | `submitVideoFn` writes **both** the video row and the claimed score. Captain-only for teams; score required only on `videoIndex 0` (:940). |
| Score upsert | `video-submission-fns.ts:1122` | `INSERT … ON DUPLICATE KEY UPDATE` on `idx_scores_competition_user_unique` (`scores.ts:126` — `(competitionEventId, userId, scalingLevelId)`). |
| Window check | `video-submission-fns.ts:114` | `checkSubmissionWindow` **first hard-gates on type at `:138–:144`: `if (competition.competitionType !== "online") return { allowed: false, reason: "Video submissions are only for online competitions" }`.** Only if the type is `"online"` does it reach the no-window allow-all at `:161–:169`. `submitVideoFn` calls it at `:899` and throws on `!allowed` (`:904`). **Consequence:** this is one of the **~129** `competitionType` sites the M0a capability registry centralizes — the gate becomes `competitionCan(type, "videoSubmissions")` (§5.2). Benchmark declares that capability (submission passes) but NOT `submissionWindows`, and seeds no window rows → always-open. |
| Organizer review | `server-fns/submission-verification-fns.ts:251` | `verifySubmissionScoreFn` — `verify|adjust|invalid`. Writes `scores.verificationStatus`, appends immutable `scoreVerificationLogsTable`, updates `video_submissions.reviewStatus`, all in one transaction. |
| Re-submit gap | `video-submission-fns.ts:949/1143` | Re-submit overwrites `scoreValue` but **does not reset** a prior `"verified"` status. Real correctness gap for retest-after-review. |

### 3.5 Creation, divisions, events, routes

| Concern | Location | Verified fact |
|---------|----------|---------------|
| Create competition | `server-fns/competition-server-logic.ts:184` | `createCompetition` inserts only the `competition_event` team + `competitions` row. Seeds **no** divisions/track/events. |
| An "event" | `db/schemas/programming.ts:87` | A `trackWorkoutsTable` row linking a `workouts` row to the competition's programming track. Carries `trackOrder` (decimal), `parentEventId`, `pointsMultiplier`, `eventStatus`. |
| Add event at runtime | `server-fns/competition-workouts-fns.ts:1229` | `createWorkoutAndAddToCompetitionFn` lazily creates the track + workout + trackWorkout. |
| Divisions | `db/schemas/scaling.ts:22/44` | `scalingLevelsTable` rows on a `scalingGroupsTable`; linked to the comp only via `settings.divisions.scalingGroupId`. `position 0 = hardest`, `teamSize 1 = individual`. |
| Seed divisions | `server-fns/competition-divisions-fns.ts:891` | `initializeCompetitionDivisionsFn` (default: "Open"/"Scaled"). |
| Full seed example | `server-fns/demo-competition-fns.ts:343` | End-to-end: createCompetition → scaling group/levels → competitionDivisions → settings → programming track → loop workouts + trackWorkouts + scaling descriptions. **This is the template for the training-PDF-derived benchmark seeder.** |
| Workout vocab | `db/schemas/workouts.ts:36/52/63` | `WORKOUT_SCHEME_VALUES` (11 schemes), `SCORE_TYPE_VALUES` (min/max/sum/average/first/last), `TIEBREAK_SCHEME_VALUES` (time/reps). |
| Public routes | `routes/compete/$slug/*` | `leaderboard`, `workouts/$eventId`, `scores`, `register`, etc. `/compete/` redirects to `/`. |

---

## 4. Gap analysis — absolute + perpetual + generic vs relative + fixed-window

| Requirement | Fits existing? | What's needed | v1? |
|-------------|----------------|---------------|-----|
| Each test scored **absolutely** (tier from a table), not by field rank | ❌ All 5 algorithms are relative (sort → assignRanks → points from place) | New `absolute_tier` algorithm branch in `calculateEventPoints` (`algorithms/index.ts:169`) | **v1** |
| Per-athlete **sex** selects the threshold column | ❌ `EventScoreInput` has no sex; engine groups by division not sex | Add optional `variant?: string` to `EventScoreInput` (`:40`); populate from the score's **snapshotted `scores.benchmarkVariant`** column (written at submit from `user.gender`, §8.1) resolved via a `Map` built **once** before the loop — **not** live `reg.user.gender` (re-tier risk, #24), **not** a per-score `find()` (O(n²), #13) | **v1** |
| **Hybrid `secondaryValue`** reaches the engine | ❌ `EventScoreInput` has **no** `secondaryValue` field (it lives only on `scoresTable`/`timeCap`) | Add `secondaryValue?: number \| null` to `EventScoreInput` (`:40`) AND populate it from the fetched score (already selected by `fetchScores`) at the same call site | v2 (only needed for hybrid) |
| **Test direction** (longer-hold = better, etc.) | ✅ `getSortDirection(scheme, scoreType)` already supports `scoreType: "max"` to flip `time` to `desc` (`direction.ts:32`) | **No `direction` column.** Carry the correct `scoreType` per test (`max`/`min`); the tier function resolves direction via `getSortDirection(scheme, scoreType)` | **v1** |
| **Per-sex tier tables** (58×2×10) joined on every read, editable per-cell | ⚠️ `settings` JSON exists but is unqueryable/uneditable at that scale | 3 new real tables: `benchmark_batteries`, `benchmark_tests`, `benchmark_tier_thresholds` | **v1** |
| Tag each event with a **category** (STR/GYM/ENG/WORKOUT) | ❌ No category concept on `trackWorkouts` | New nullable `benchmarkCategory` column on `trackWorkoutsTable` (`programming.ts:87`) — migration; **attach `trackWorkout.benchmarkCategory` onto each `eventResult`** in the per-event loop (~`:1150`) so the aggregation pass can read it | **v1** |
| **Category attribute scores + Overall/100** | ❌ Leaderboard only has cumulative `totalPoints`, ranks per division | New aggregation pass inserted **right before `const leaderboard = Array.from(leaderboardMap.values())` at `:1470`**; new `categoryScores`/`overallScore` fields on `CompetitionLeaderboardEntry` (`:71`) | **v1** |
| **Unified** Men+Women board by Overall/100 | ❌ Final sort is per-division (`divisionId.localeCompare` then rank) | Rank by `overallScore` desc; sex is a variant not a division, so one division ("Open") holds everyone | **v1** |
| **Always-open** submissions (no window) | ⚠️ `checkSubmissionWindow` allows-all when no window rows exist, but the gate is `competitionType === "online"` (rejects other types at `:139`) | M0a capability registry: gate → `competitionCan(type, "videoSubmissions")`; benchmark declares it but NOT `submissionWindows`, so no window rows are seeded; `perpetual` capability flags UI | **v1 (M0a)** |
| **12/24-month** windows | ❌ `fetchScores` has no date predicate (it does not even select a date column) | Window param on input schema; predicate in `fetchScores`; append-only `score_attempts` for best-in-window | **v2** |
| **best-to-date** board (honest naming; *not* all-time) | ⚠️ the live `scores` row holds the **latest** write, not the best-ever | Read straight from `scores`, but make the live row monotonic via **keep-best-on-write** (M3, §8.1): a retest overwrites only when the new tier/raw is better. True windowed all-time + invalidation-restore need `score_attempts` | **v1** (best-to-date); **v2** (true all-time) |
| **Retest history** (current vs all-time best) | ❌ Submit overwrites in place; no athlete-value history | New `score_attempts` table; snapshot at every write seam; `promoteBest` step (must reproduce the leaderboard's `:1093` sortKey recompute, which needs round-level data — see §7.1) | **v2** |
| **0.5 sub-tier** survives multiplier | ⚠️ `pointsMultiplier` `Math.round`s, can swallow 0.5 | Force multiplier = 1 for `absolute_tier` | **v1** |
| **Hybrid reps-or-time** tests | ⚠️ `time-with-cap` + `secondaryValue` exist on `scoresTable`, but not on `EventScoreInput` | Split threshold block (rep tiers + time tiers); branch on `status === 'cap'`; needs the `secondaryValue` engine addition above | **v2** (deferred — 2 of 58 tests; §6.3, §10) |
| **Generic** (any gym authors a battery) | ✅ Battery = competition; tables are just rows | **v1 ships a training-guide-derived benchmark as code-seeded data**; the generic tier-table **authoring UI** comes later (v2). Data model stays generic from day one | **v2** (UI); **v1** (data model) |
| **Single-test** "post your bench" | ✅ Single test = 1-category 1-test battery | `isOpenJoin` auto-register on first submit (lazy-register resolving variant `scalingLevelId` from `user.gender`; §8.1) | **v1** (data model permits it; ships once submit path lands) |

---

## 5. Proposed architecture

### 5.1 The generic model

```
benchmark_battery  (the source-derived generic benchmark battery; one row)
  ├── benchmark_category   (STR / GYM / ENG / WORKOUT; weight, position)
  │     └── benchmark_test (one of the 58; scheme, scoreType, direction, unit)
  │           └── benchmark_tier_threshold  (one row per (test, variant, tier) = 10 per sex)
  │
  └── competitions row     (the "perpetual instance" — competitionType "benchmark")
        └── programming track
              └── trackWorkout (event)  --benchmarkTestId-->  benchmark_test
                    └── workout (name, scheme, scoreType, timeCap)
                          └── scores / video_submissions  (REUSED verbatim)
                                └── score_attempts  (append-only retest history — V2)
```

- **Battery → competition is 1:1.** Publishing a battery instantiates exactly one competition (as `competitionType:"benchmark"` — §5.2). Each `benchmark_test` maps to one `trackWorkout` via a nullable `benchmarkTestId` FK on `trackWorkouts`.
- **Variant is decoupled from the division key (corrected).** Sex selects which threshold table to read, but it is **not** a division. Every benchmark score's `scalingLevelId` is the single **"Open" division** level — because leaderboard grouping, dedupe, the publish gate, the final sort, AND the upsert key all treat `scalingLevelId` as `divisionId` (`competition-leaderboard.ts:1036–:1088`, `scores.ts:126`), encoding M/F there would either **drop** scores (variant level ≠ registration's Open division) or **split** the board into per-sex groups. The **variant** is snapshotted onto a new nullable `scores.benchmarkVariant` (`"male"|"female"`) column at submit (from `user.gender`); the engine reads the variant from that snapshot — never from `scalingLevelId`, never from live `user.gender` (§8.1, §13/#3a/#24).
- **Single-test "post your bench"** = a battery with 1 category + 1 test. Zero special-casing; Overall == the one category score == `tier ÷ maxTier × scoreMax`.
- **`score_attempts` is the V2 history layer** — v1 ships best-to-date only off the live `scores` row, kept monotonic by keep-best-on-write (no `score_attempts`).

> **Decision (resolved between pillars):** Two pillars proposed slightly different table sets. We adopt the **leaner three-table** definition layer (`benchmark_batteries`, `benchmark_tests`, `benchmark_tier_thresholds`) + the `benchmarkCategory` column on `trackWorkouts`, rather than a separate `benchmark_categories` table. Categories are a small fixed enum carried as JSON on the battery (`categories: [{key, label, testCount, weight}]`) and as a column on each event. This avoids a fourth table and a join; categories are not independently queried. (Pillar 1's 4-table version is the rejected alternative — see §12.4.)
>
> **But the categories JSON is scoring-critical, not display config (fail-closed contract).** It drives the **denominator** and the **weights** (§6.4), so a malformed/stale blob corrupts scores exactly like a bad threshold table. `benchmark.schema.ts` MUST define a strict Zod `categoriesSchema` (key enum, non-empty `label`, integer `testCount ≥ 1`, `weight > 0`) validated **(a)** on every write, **(b)** at publish, **and (c) on read inside `loadBattery`** — if the blob is null or fails validation, `loadBattery` **throws** rather than returning `null`/empty, so a corrupt battery refuses to score instead of silently emitting a 0/garbage Overall (the malformed-JSON→`null` gotcha, §3.1). And `testCount` is a **validated cache** of `count(active includedInScoring benchmark_tests in the category)`, never the source of truth (§6.4/§9). Revisit the 4th table only if categories ever need independent querying.

### 5.2 Competition-type **capability registry** (the foundational refactor) + the `absolute_tier` algorithm

> **This is the pivot from the first draft (owner steer).** Online competitions are a crucial standalone product; we must not muddy them with benchmark behavior. Instead of overloading `competitionType:"online"`, we introduce a **capability registry** — one source of truth mapping each competition type to the features it supports. The scattered `competitionType === "online"` / `=== "in-person"` checks collapse to capability lookups. **Online and in-person behavior is preserved exactly** (each type declares precisely the capabilities its old inline checks already implied); **benchmark becomes a distinct type** declaring only the subset it reuses; **future types** (leagues, ladders, hybrid formats) slot in by declaration alone. This is the system the owner asked for: "assume there could be more competition types and let us utilize current competition features easily."

**Why distinct-type + registry, not reuse-`"online"`:** the earlier draft reused `"online"` to avoid touching ~40 sites. Rejected because (a) it pollutes the standalone online product with benchmark concerns, (b) `"online"` is **already overloaded** — it is BOTH a `competitionType` AND a `scoringAlgorithm` (`tiebreakers.ts:78`, `scoring-config-form.tsx:62`), so adding a third meaning compounds the confusion, and (c) the registry is a one-time, mechanical, **behavior-preserving** refactor that pays off for every future type. (§12.2.)

**The scatter (re-verified): ~129 `competitionType`/`isOnline`/`isInPerson` comparison sites across 61 files** (`competitionType` 60 / `isOnline` 55 / `isInPerson` 14). Heaviest: `scoring-config-form.tsx`, `competition-sidebar.tsx` / `cohost-sidebar.tsx`, `organizer-competition-form.tsx`, `competition-location-card.tsx`, the organizer/cohost `results.tsx` / `index.tsx` / `events/*`, the score/video API routes, `competition-leaderboard.ts`. **Axis-collision warning:** several `"online"` checks are `scoringAlgorithm === "online"` (place-based golf scoring) — a *different* axis from `competitionType`. The registry covers **only the `competitionType` axis**; leave scoring-algorithm checks alone (benchmark scores via `absolute_tier`, not `online`).

```ts
// NEW: src/lib/competitions/capabilities.ts — single source of truth
export type CompetitionCapability =
  | "videoSubmissions"        // athletes submit video + score; review / judge / submissions pipeline
  | "submissionWindows"       // per-event open/close windows
  | "optInResultPublishing"   // division results hidden until explicitly published
  | "heatScheduling"          // heats, venues, lanes, judge scheduling
  | "dayOfCheckIn"            // day-of check-in kiosk
  | "physicalVenue"           // location / address display
  | "volunteerScheduling"     // volunteer schedule tab
  | "organizerEntersResults"  // organizer-entered scores (vs athlete-submitted)
  | "perpetual"               // never-closing board (no end date)

interface CompetitionTypeDef {
  id: "in-person" | "online" | "benchmark"
  label: string
  capabilities: ReadonlySet<CompetitionCapability>
  leaderboardVariant: "standard" | "online"
  selectableOnCreate: boolean   // benchmark publishes via the battery flow, not the generic type picker
}

export const COMPETITION_TYPE_REGISTRY: Record<string, CompetitionTypeDef> = {
  "in-person": { id: "in-person", label: "In-Person", leaderboardVariant: "standard", selectableOnCreate: true,
    capabilities: new Set(["heatScheduling","dayOfCheckIn","physicalVenue","volunteerScheduling","organizerEntersResults"]) }, // optInResultPublishing is online-only (verified leaderboard:440-443)
  "online":    { id: "online", label: "Online", leaderboardVariant: "online", selectableOnCreate: true,
    capabilities: new Set(["videoSubmissions","submissionWindows","optInResultPublishing"]) },
  "benchmark": { id: "benchmark", label: "Benchmark", leaderboardVariant: "online", selectableOnCreate: false,
    capabilities: new Set(["videoSubmissions","perpetual"]) }, // NO optInResultPublishing — that hides every (event,division) until published (leaderboard:440-443/1082-1085); a 55-test v1 perpetual board must be public-on-valid-submission. Also NO submissionWindows / physical / heats / check-in
}

export function competitionCan(type: string, cap: CompetitionCapability): boolean {
  return COMPETITION_TYPE_REGISTRY[type]?.capabilities.has(cap) ?? false
}
export function leaderboardVariant(type: string): "standard" | "online" {
  return COMPETITION_TYPE_REGISTRY[type]?.leaderboardVariant ?? "standard"
}
```

**The refactor — each site maps to the capability matching its *real intent* (not a blind `"online"`→helper swap):**

| Old check (intent) | New check | Sites (≈) |
|--------------------|-----------|-----------|
| `=== "online"` gating video/score **submission, review, judge, submissions page, video fetch** | `competitionCan(type, "videoSubmissions")` | `api/compete/{scores/submit,video/submit,scores/judge,scores/window-status}`, `athlete-score-fns:152`, `competition-score-fns:188`, `video-submission-fns:139`, `competition-leaderboard:847`, review/submissions routes, `workouts/$eventId` video UI | ~20 |
| `=== "online"` gating the **submission-windows page** | `competitionCan(type, "submissionWindows")` | organizer/cohost `submission-windows.tsx`, `window-status.ts` | ~3 |
| `=== "online" ? {} : undefined` **publish-gate default** | `competitionCan(type, "optInResultPublishing")` | `competition-leaderboard.ts:443` | 1 |
| `=== "online"` choosing the **leaderboard table** | `leaderboardVariant(type) === "online"` | `leaderboard-page-content.tsx:664/629` | ~2 |
| `!isOnline` / `=== "in-person"` **heats, judge & athlete scheduling** | `competitionCan(type, "heatScheduling")` | `judge-scheduling-container`, `$slug/schedule`, `my-schedule`, organizer/cohost `events/$eventId` editors | ~14 |
| check-in | `competitionCan(type, "dayOfCheckIn")` | `check-in.tsx` (organizer & `$slug`), `check-in-fns:77` | ~3 |
| `isOnline` **location/address** | `competitionCan(type, "physicalVenue")` | `competition-location-card`, `address.ts:372` | ~4 |
| `isInPerson` **volunteer schedule tab** | `competitionCan(type, "volunteerScheduling")` | organizer/cohost `volunteers.tsx` | ~12 |
| `isOnline` **results-entry model** + sidebar **"Submissions vs Results"** | `competitionCan(type, "organizerEntersResults")` (+ a nav-label helper) | organizer/cohost `results.tsx`/`index.tsx`, `competition-sidebar`, `cohost-sidebar` | ~25 |
| type **picker / filter / create-update** | unchanged enum, but the generic picker reads `selectableOnCreate` (benchmark hidden) | `organizer-competition-form`, `*-edit-form`, `routes/index`, `compete/index` | ~10 |

> **Behavior-preservation guarantee + scoped rollout (M0a / M0b).** For `"online"` and `"in-person"`, `competitionCan` returns *exactly* what the old inline check returned at every refactored site — the refactor only **relocates** the decision, changing zero behavior for existing products. **To bound the blast radius (critique #6), only the chokepoints benchmark v1 needs are refactored in M0a:** the submission gate (`video-submission-fns.ts:139` + the score/video/window-status API routes), the publish-gate default (`competition-leaderboard.ts:443`), the leaderboard-variant selector (`leaderboard-page-content.tsx:664/629`), and route/tab visibility (Stats tab + `workouts/$eventId` video UI). **The remaining ~100 sites (heats, check-in, venue, volunteers, results-entry model, sidebar labels) are M0b — deferred** and refactored opportunistically after the demo; until then they keep their literal `=== "online"`/`isInPerson` checks, and benchmark (being neither type) correctly leaves those tabs/features hidden. Lock M0a with **two** test layers, not one: (1) a **registry snapshot test** reproducing the pre-refactor truth table for online/in-person; **and** (2) **characterization tests around the real chokepoint routes/server-fns** asserting benchmark submit passes the gate, benchmark results render without per-event publish, organizer-vs-cohost parity holds, and `scoringAlgorithm === "online"` sites stay untouched — the truth table alone cannot catch page-shows-but-API-rejects or publish-gate-vanish divergence. Benchmark then gets correct behavior **at the chokepoints** by declaring `{videoSubmissions, perpetual}` (and, by omission, no windows/heats/check-in/venue/**publish-gate**).

```ts
// db/schemas/competitions.ts:486 — add the value (migration-free varchar)
export const COMPETITION_TYPES = { IN_PERSON: "in-person", ONLINE: "online", BENCHMARK: "benchmark" } as const
// :118 — widen the $type union (TS-only; NO SQL migration)
competitionType: varchar({ length: 15 }).$type<"in-person" | "online" | "benchmark">().default("in-person").notNull()
```

**The `absolute_tier` scoring algorithm is orthogonal** (a `scoringAlgorithm`, not a `competitionType`) and unchanged:

```ts
// schemas/scoring.schema.ts:20 — add the algorithm (migration-free varchar)
export const scoringAlgorithmSchema = z.enum([
  "traditional", "p_score", "winner_takes_more", "online", "custom",
  "absolute_tier",                  // NEW
])
// new block + optional sibling at scoringConfigSchema (:124)
export const absoluteTierConfigSchema = z.object({
  batteryId: z.string(),
  subZeroRule: z.enum(["below_t1_is_half"]).default("below_t1_is_half"),
  untestedIsZero: z.boolean().default(true),
})

// scoringConfigSchema is a FLAT z.object (NOT a discriminated union, :152), so
// { algorithm: "absolute_tier" } with no absoluteTier sibling parses clean and then
// crashes at §6.4 `loadBattery(scoringConfig.absoluteTier.batteryId)`. Add a superRefine:
export const scoringConfigSchema = z.object({
  algorithm: scoringAlgorithmSchema,
  traditional: traditionalConfigSchema.optional(),
  pScore: pScoreConfigSchema.optional(),
  customTable: customTableConfigSchema.optional(),
  absoluteTier: absoluteTierConfigSchema.optional(),   // NEW
  tiebreaker: tiebreakerConfigSchema,
  statusHandling: statusHandlingConfigSchema,
}).superRefine((cfg, ctx) => {
  if (cfg.algorithm === "absolute_tier" && !cfg.absoluteTier?.batteryId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["absoluteTier", "batteryId"],
      message: "absoluteTier.batteryId is required when algorithm is 'absolute_tier'" })
  }
  if (cfg.algorithm !== "absolute_tier" && cfg.absoluteTier) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["absoluteTier"],
      message: "absoluteTier config must only be present when algorithm is 'absolute_tier'" })
  }
})
```

> This guard makes `scoringConfig.absoluteTier.batteryId` safe to dereference at §6.4 and prevents a stale `absoluteTier` block from silently riding on a non-benchmark config. It is a required M2 task (#11).

> **Migrations:** both `competitionType` (`"benchmark"`) and `scoringAlgorithm` (`"absolute_tier"`) are TS-only `varchar`s → **no SQL migration**. The registry is pure TS. Only the `benchmark_*` tables + the two `trackWorkouts` columns need a real migration (§5.3).

### 5.3 New tables — pseudo-DDL

All new tables go in a net-new `src/db/schemas/benchmarks.ts`, registered via `export * from "./schemas/benchmarks"` in `src/db/schema.ts`. IDs use ULID `$defaultFn` factories in `common.ts` (matching `scaling.ts` convention). All FKs `varchar(255)`.

> **v1 migration scope:** the **3** definition tables (`benchmark_batteries`, `benchmark_tests`, `benchmark_tier_thresholds`) + the **2** `trackWorkouts` columns + **1** new column on the shared `scores` table (`benchmarkVariant`, the variant snapshot — §5.1/#3a/#24). `score_attempts` is a **v2** table (shown last, deferred with windowing).

```sql
-- THE NAMED BENCHMARK DATA SET (training-guide-derived benchmark = one row; "post your bench" = one row)
benchmark_batteries (
  id              varchar PK,          -- bbat_<ulid>
  ...commonColumns,
  teamId          varchar NULL,        -- owning gym (NULL = system/global, like sgrp_global_default)
  ownerKey        varchar NOT NULL,    -- COALESCE(teamId,'__global__') — NON-NULL so the unique key works (see note)
  slug            varchar NOT NULL,    -- public URL segment
  name            varchar NOT NULL,    -- e.g. "Benchmark Training Guide"
  description     text,
  version         int NOT NULL DEFAULT 1,
  -- categories + weights + per-category test counts. SCORING-CRITICAL (drives the denominator + weights,
  -- §6.4): strict-Zod-validated + fail-closed on read (§5.1). testCount is a VALIDATED CACHE of
  -- count(active includedInScoring tests in the category), NOT the authority (§6.4/§9).
  categories      text NOT NULL,       -- JSON: [{key:"STR",label:"Strength",testCount:15,weight:1}, ...]
  ratingBands     text NOT NULL,       -- JSON: [{min:90,label:"Elite"}, ...]
  -- aggregation params (parameterizable; HillerFit defaults shown). RENAMED for clarity (#1):
  maxTier         int NOT NULL DEFAULT 10,   -- per-test tier ceiling (T10); was the ambiguous "categoryScale"
  scoreMax        int NOT NULL DEFAULT 100,  -- Overall is 0..scoreMax; was "overallMax"
  videoPolicy     varchar(20) NOT NULL DEFAULT 'never',  -- never | for_top_scores | always (#17)
  isOpenJoin      boolean NOT NULL DEFAULT false,  -- single-test "post your bench" auto-register
  variantScalingGroupId varchar NULL,  -- FK scaling_groups.id; levels = Men/Women variants
  competitionId   varchar NULL,        -- FK competitions.id (the perpetual instance; NULL until published)
  status          varchar(15) NOT NULL DEFAULT 'draft',   -- draft | published (TS union)
  UNIQUE(ownerKey, slug)               -- NOT UNIQUE(teamId,slug)
)
-- ⚠️ MySQL caveat (#21): a UNIQUE index treats every NULL as DISTINCT, so UNIQUE(teamId,slug) would
-- let multiple GLOBAL (teamId IS NULL) batteries share the public `slug`. Use the non-null `ownerKey`
-- sentinel (COALESCE(teamId,'__global__')) for the constraint AND validate slug uniqueness in the
-- seeder/publish flow (slug is a public URL segment).

-- TESTS (the 58). Carries engine-native scheme + scoreType + unit.
-- NO `direction` column: direction is resolved by getSortDirection(scheme, scoreType).
-- A test that needs the non-default direction sets scoreType accordingly
-- ("max" → desc, "min" → asc). Example: a time-based hold uses scheme `time`,
-- scoreType `max` → getSortDirection("time","max") === "desc" (longer = better).
benchmark_tests (
  id            varchar PK,            -- btst_<ulid>
  ...commonColumns,
  batteryId     varchar NOT NULL,      -- FK benchmark_batteries.id
  categoryKey   varchar(20) NOT NULL,  -- "STR" | "GYM" | "ENG" | "WORKOUT"
  name          varchar NOT NULL,      -- "Strict Press", "1 Mile Run", "Open 18.4 (reps/time)"
  position      int NOT NULL,
  scheme        varchar NOT NULL,      -- one of WORKOUT_SCHEME_VALUES (workouts.ts:36) — NO "watts"
  scoreType     varchar NOT NULL,      -- 'min' | 'max' for tier-scored tests; ENCODES direction (§6.1).
                                       -- MUST be min/max — sum/average/first/last fall through to the
                                       -- scheme default and silently mis-direct the tier (§6.1/#19).
  includedInScoring boolean NOT NULL DEFAULT true, -- false = deferred/"coming soon"; EXCLUDED from the
                                       -- category denominator (drives the 56-vs-58 stance, §2.1/#7)
  timeCap       int NULL,              -- seconds, for time-with-cap tests
  inputUnit     varchar(20) NULL,      -- lbs|kg|m|ft|mi|reps|seconds|lbs_added (encode/* hint). NO "watts" — avg-watts uses scheme `points`
  scoreModel    varchar(20) NOT NULL DEFAULT 'standard', -- standard | hybrid_reps_then_time (v2)
  hybridFlipTier int NULL,             -- v2: e.g. 7 => tiers 1..6 reps, 7..10 time (Open 18.4)
  description   text,                  -- free-text movement list (mirrors workouts.description)
  INDEX(batteryId), INDEX(categoryKey),
  UNIQUE(batteryId, name)
)

-- TIER TABLE: one row per (test, variant, tier). 10 rows per (test, sex) = 20 per test.
-- Thresholds are PRE-ENCODED in engine units so comparison is integer-vs-integer.
-- thresholdValue is `int` (signed 32-bit) to MATCH scores.scoreValue (int, scores.ts:63)
-- and score_attempts.scoreValue (int). Verified safe: across all 58 HillerFit tests the
-- largest encoded magnitude is a 10K run in mm (10,000,000) — and even a marathon in mm
-- (~42M) or a 600 lb deadlift in grams (272,155) or a 60-min erg in ms (3,600,000) all sit
-- far below INT_MAX (2,147,483,647). No bigint needed; no need to touch the shared scores table.
benchmark_tier_thresholds (
  id                    varchar PK,    -- btir_<ulid>
  ...commonColumns,
  testId                varchar NOT NULL,    -- FK benchmark_tests.id
  variant               varchar(10) NOT NULL,-- "male" | "female" (reuse GENDER_ENUM values, users.ts:23)
  tier                  int NOT NULL,        -- 1..10
  -- ENCODED threshold: time=ms, load=grams (lbs*453.592), distance=mm,
  -- rounds-reps=rounds*100000+reps, reps/cal/points(watts)=raw int
  thresholdValue        int NOT NULL,        -- matches scores.scoreValue width; NOT bigint
  -- raw human value preserved for re-edit & display ("8:00", "115", "BW", "+5")
  rawValue              varchar(40) NOT NULL,
  -- hybrid (v2): which sub-scale this tier uses ("reps" below flip, "time" at/above)
  hybridScale           varchar(10) NULL,    -- NULL for standard tests
  UNIQUE(testId, variant, tier)
)
```

```sql
-- BINDING: nullable column on the SHARED trackWorkouts table (one join hop, hot path)
ALTER TABLE track_workouts
  ADD benchmarkTestId  varchar(255) NULL;   -- FK benchmark_tests.id, NULL for normal comp events
ALTER TABLE track_workouts
  ADD benchmarkCategory varchar(10) NULL;   -- "STR"|"GYM"|"ENG"|"WORKOUT", NULL for normal events

-- VARIANT SNAPSHOT on the SHARED scores table (v1). Decoupled from the division key so the board
-- stays unified and a later profile gender change never re-tiers prior scores (§5.1/#3a/#24).
ALTER TABLE scores
  ADD benchmarkVariant varchar(10) NULL;    -- "male"|"female" captured at submit; NULL for normal scores
```

**`score_attempts` (DEFERRED to v2 with windowing — not part of the v1 migration).** v1 uses the live `scores` row kept monotonic by keep-best-on-write (best-to-date) and ships **no retest history**; a retest simply overwrites the single `scores` row via the existing upsert. The append-only history table below is the v2 layer that backs 12/24-month windows and current-vs-best. It is documented here so the v1 schema can leave room for it, but it is **not built in M1**.

```sql
-- v2 — RETEST HISTORY: append-only, never updated. Backs windowed + current-vs-best.
-- IMPORTANT v2 caveat: to reproduce the leaderboard's authoritative ordering for
-- rounds-reps/hybrid tests, promoteBest must recompute sortKey exactly like
-- competition-leaderboard.ts:1093 — which depends on cappedRoundCount and per-round
-- statuses (scoreRoundsTable). Those are NOT captured by a flat snapshot, so this table
-- must ALSO snapshot cappedRoundCount (and, for hybrid, the computed `tier`) or promoteBest
-- cannot order correctly. See §7.1.
score_attempts (
  id                varchar PK,          -- satt_<ulid>
  ...commonColumns,
  scoreId           varchar NULL,        -- FK scores.id (the live "current best" row)
  userId            varchar NOT NULL,
  workoutId         varchar NOT NULL,
  competitionEventId varchar NOT NULL,   -- the trackWorkout.id of the test
  scalingLevelId    varchar NULL,        -- the variant the attempt was scored under
  scheme            varchar NOT NULL,
  scoreValue        int NULL,            -- encoded, same units as scores.scoreValue
  status            varchar(20) NOT NULL,
  statusOrder       int NOT NULL DEFAULT 0,
  sortKey           varchar(255) NULL,
  cappedRoundCount  int NULL,            -- NEEDED so promoteBest can recompute sortKey (§7.1)
  secondaryValue    int NULL,            -- reps at cap (hybrid)
  tier              decimal(3,1) NULL,   -- 0/0.5/1..10 snapshot; for hybrid promote-by-tier (§7.1)
  variantAtAttempt  varchar(10) NULL,    -- "male"|"female" at submit time
  verificationStatus varchar(20) NULL,
  achievedAt        datetime NOT NULL,   -- client-supplied test date (default now); window predicate
  INDEX(userId, competitionEventId, achievedAt),
  INDEX(competitionEventId, achievedAt)
)
```

### 5.4 Config JSON (light pointer only)

Heavy threshold numbers live in tables; `competitions.settings` carries only the pointer + flags.

```jsonc
// competitions.settings (parsed via parseCompetitionSettings, types/competitions.ts:68)
{
  "benchmarkBattery": { "isOpenJoin": false, "boardMode": "perpetual", "chartRefreshedAt": 1730000000000 },
  "divisions": { "scalingGroupId": "sgrp_..." },     // the single "Open" division group
  "scoringConfig": {
    "algorithm": "absolute_tier",
    "absoluteTier": { "batteryId": "bbat_...", "subZeroRule": "below_t1_is_half", "untestedIsZero": true },
    "tiebreaker": { "primary": "countback" },
    "statusHandling": { "dnf": "zero", "dns": "zero", "withdrawn": "zero" }
  }
}
```

### 5.5 Reuse-vs-new

| Layer | Reuse (verbatim) | Net-new (v1) | Deferred (v2) |
|-------|------------------|--------------|---------------|
| **Submission** | `submitVideoFn` (`video-submission-fns.ts:870`); one-score upsert on `idx_scores_competition_user_unique`. **Submission gate becomes `competitionCan(type,"videoSubmissions")`** (M0a registry, §5.2); benchmark declares it | capability registry (M0a) + `"benchmark"` type; **guarded** `isOpenJoin` lazy-register (Open division + `benchmarkVariant` snapshot from `user.gender`, NOT a sex `scalingLevelId`, §8.1); **keep-best-on-write** guard (best-to-date); `verificationStatus` reset on changed re-submit; (optional) BW-pullup wrapper if not deferred | `score_attempts` snapshot + `promoteBest` + invalidation-restore |
| **Scoring** | `calculateEventPoints` dispatch, `EventPointsResult`, `assignRanks`, `encode/*`, `getSortDirection` (incl. `scoreType:"max"` direction flip), `tiebreakers` | `algorithms/absolute-tier.ts` (standard tier, **fail-closed on missing variant/table**); `category-aggregation.ts`; **`EventScoreInput.variant`**; **widen `calculateEventPoints` with preloaded `ctx:{scoreType, tableByEventId}`**; **benchmark tier-histogram tiebreaker** (NOT field-relative countback); `scoringConfigSchema.superRefine`; `calculatePointsForPlace` case + label-fn case | hybrid branch + **`EventScoreInput.secondaryValue`** (only needed for hybrid) |
| **Leaderboard** | `getCompetitionLeaderboard` pipeline (fetch/dedupe/group/publish-gate/tiebreaker); `reg.user` joined (`:691`) | variant from `scores.benchmarkVariant` snapshot via a **preloaded `Map`** + `loadAllBenchmarkThresholds` (no N+1) at `:1102–:1144`; multiplier=1 **and skip `Math.round`** at `:1153`/`:1327` (integer-points audit, §6.5); category-aggregation pass before `:1470`; rank-by-Overall at `:1486`; tier-histogram tiebreaker; `categoryScores`/`overallScore`/`ratingBand` fields; attach `benchmarkCategory` onto each `eventResult` | window predicate in `fetchScores`; `benchmark-leaderboard.ts` windowed best-attempt selection |
| **Schema** | `competitionsTable`, `trackWorkoutsTable`, `workouts`, `programmingTracksTable`, `scoresTable`, `scalingGroups/Levels`, `video_submissions` | `benchmark_batteries`, `benchmark_tests`, `benchmark_tier_thresholds` (3 tables), 2 columns on `trackWorkouts` | `score_attempts` table |
| **Config** | `settings` JSON parse/stringify, `getEffectiveScoringConfig` | `absolute_tier` enum value + `absoluteTier` config block; `benchmark.schema.ts` validation (**no** new `competitionType`) | — |
| **Routes/UI** | online leaderboard table, `VideoSubmissionForm`, review pages, organizer create/divisions/events flow | `/compete/$slug/stats`, `<BenchmarkStatLine>`, Stats tab | tier-table authoring editor; window/mode toggles |
| **Seed** | `demo-competition-fns.ts:343` flow as template | training-PDF-derived seed module (data) + idempotent seeder fn | generic battery-publish flow |

---

## 6. Scoring & aggregation design

### 6.1 The `absolute_tier` algorithm

New file `src/lib/scoring/algorithms/absolute-tier.ts`. Pure functions; the lookup is independent per athlete.

```ts
type Variant = "male" | "female"

interface TierTable {
  thresholds: number[]            // length 10, ENCODED, ascending-by-TIER (T[0]=T1 ... T[9]=T10)
  scoreModel: "standard" | "hybrid_reps_then_time"   // hybrid is v2-only
  hybridFlipTier?: number         // v2: e.g. 7 => indices 0..5 are reps, 6..9 are time
}

/** Returns 0 | 0.5 | 1..10. Step function — never interpolated. */
function calculateAbsoluteTier(p: {
  value: number                   // encoded scoreValue
  secondaryValue?: number | null  // reps at cap (hybrid, v2)
  scheme: WorkoutScheme
  scoreType: ScoreType            // DRIVES direction via getSortDirection (no `direction` column)
  variant: Variant
  status: EventScoreInput["status"]   // "scored"|"cap"|"dnf"|"dns"|"withdrawn"
  table: TierTable
}): number {
  // Rule 0: untested / can't perform / withdrawn / DNS / DQ.
  // NOTE the DB→engine status mapping (competition-leaderboard.ts:300): a DB `dq`
  // arrives here as engine `dnf`, so `dnf` MUST also be tier 0 — not just dns/withdrawn.
  if (p.status === "dns" || p.status === "withdrawn" || p.status === "dnf") return 0
  if (p.value == null) return 0

  if (p.table.scoreModel === "hybrid_reps_then_time") {
    return hybridTier(p)          // v2 — see §6.3
  }

  // Direction comes from scoreType, NOT a separate column: getSortDirection("time","max")
  // === "desc" lets a hold (longer = better) reuse the standard machinery. There is no
  // `direction` column on benchmark_tests — the seed assigns scoreType per test (§2.4).
  const dir = getSortDirection(p.scheme, p.scoreType)   // "asc" = lower better; "desc" = higher better
  const T = p.table.thresholds
  const qualifies = (k: number) => dir === "asc" ? p.value <= T[k] : p.value >= T[k]

  // Rule 0.5: completed but below the Tier 1 minimum
  if (!qualifies(0)) return 0.5

  // Rule 1..10: highest qualifying tier
  let tier = 1
  for (let k = 0; k < 10; k++) if (qualifies(k)) tier = k + 1
  return tier
}
```

**Direction handling (the qualifying inequality) — resolved entirely by `scoreType`, no `direction` column:**

| Direction (from `getSortDirection(scheme, scoreType)`) | How a test gets it | Example tests | Qualify rule |
|--------------------------------------|--------------------|---------------|--------------|
| `desc` (higher better) | scheme default for `load`/`reps`/`rounds-reps`/`calories`/`meters`/`feet`/`points`, **or** `scoreType: "max"` to flip a `time` test | Strict Press (`load`), Pull-ups (`reps`), Cindy (`rounds-reps`), Avg Watts (`points`), Double Unders (`reps`), **L-Sit / Dead Hang holds** (`time`+`max`) | `value >= T[k]` |
| `asc` (lower better) | scheme default for `time`/`time-with-cap` (or `scoreType: "min"`) | 1 Mile Run, 2K Row, Fran (`time`) | `value <= T[k]` |

> **Why no `direction` column (correction vs earlier draft):** every documented "exception" is handled by the test's `scoreType`. Higher-is-better counts (watts → `points`, double-unders → `reps`) are already `desc` by scheme; the only genuine reversal is a **time-based hold** (longer = better), which `scoreType: "max"` turns into `desc` via `getSortDirection("time","max")` (verified at `direction.ts:32`). Adding a `direction` column AND not threading it (as the earlier draft did) would have silently inverted holds — so we delete the column and require correct `scoreType` instead. **Unit-test each direction case:** a hold (`time`+`max`), an avg-watts test (`points`+`max`), and a run (`time`+`min`). **Note (#19):** because direction is derived, the seed/editor MUST set `scoreType` to `min` or `max` for every tier test — `sum`/`average`/`first`/`last` fall through to the scheme default and silently mis-direct; the v2 authoring UI exposes a "higher/lower is better" toggle (not a raw `scoreType` picker) and validates it against `getSortDirection` (§8.5/§9).

> **Fail closed on a missing tier table (#22) — never a silent Tier 0.** Resolving the variant and its table is a hard precondition. If `tableByVariant[variant]` is `undefined` (a config gap — e.g. female thresholds never seeded), the wrapper **throws a typed `BenchmarkConfigError`** (defined in `absolute-tier.ts`); it does **not** default to the other sex and does **not** silently return tier 0. The leaderboard / stat-line **catches** it, renders that test cell as a controlled **"unavailable"** state (visually distinct from both untested-tier-0 and attempted-tier-0), **excludes that test from the category denominator** for affected athletes, and logs/monitors the error. A silent Tier 0 would read as *athlete* failure rather than the *system* misconfiguration it is. The publish-time completeness check (§13.2) is the first line of defence; this score-time guard is the backstop for post-publish drift.

### 6.2 Event-points wrapper (synthesizing the mandatory `rank`)

`EventPointsResult.rank` is mandatory and intrinsically relative; a tier has no natural rank. Synthesize one by ordering athletes within the (event, division) group by tier desc — used only to fill the slot and for countback.

```ts
function calculateAbsoluteTierEventPoints(
  scores: EventScoreInput[], scheme, scoreType, tableByVariant: Record<Variant, TierTable>,
): Map<string, EventPointsResult> {
  const tiers = scores.map(s => {
    const variant = requireVariant(s)                  // #3b: NEVER `?? "male"` — fail closed
    const table = tableByVariant[variant]
    if (!table) throw new BenchmarkConfigError(`No ${variant} tier table for this test`)  // #22
    return {
      userId: s.userId,
      tier: calculateAbsoluteTier({
        value: s.value, secondaryValue: s.secondaryValue, scheme, scoreType,
        variant, status: s.status, table,
      }),
    }
  })
  // Synthesize a rank ONLY to fill the mandatory EventPointsResult.rank slot. This rank is
  // FIELD-RELATIVE (everyone tied at Tier 7 on a weak event gets rank 1) and MUST NOT be fed to
  // countback — absolute tiers need the tier-histogram tiebreaker instead (§6.5/#5).
  const sorted = [...tiers].sort((a, b) => b.tier - a.tier)   // higher tier = better rank
  const out = new Map<string, EventPointsResult>()
  let rank = 1
  sorted.forEach((t, i) => {
    if (i > 0 && t.tier !== sorted[i - 1].tier) rank = i + 1
    out.set(t.userId, { userId: t.userId, points: t.tier, rank })   // points = TIER
  })
  return out
}

// #3b — requireVariant NEVER defaults to a sex. A null/unknown variant is an invariant violation
// (participation is gated on a set user.gender, §8.1), so fail loud rather than silently mis-tier.
function requireVariant(s: EventScoreInput): Variant {
  if (s.variant === "male" || s.variant === "female") return s.variant
  throw new BenchmarkConfigError(`Missing/invalid benchmark variant for user ${s.userId}`)
}
```

**Dispatch seam (#4) — widen `calculateEventPoints`, preload the context, then the two switches + label fn:**

```ts
// SEAM: widen the dispatch with an optional, PRELOADED absolute-tier context (NOT queried inside).
//   calculateEventPoints(eventId, scores, scheme, config,
//     ctx?: { scoreType: ScoreType; tableByEventId: Map<string, Record<Variant, TierTable>> })
// Build ctx ONCE before the per-event loop (benchmark pre-pass): a single
//   loadAllBenchmarkThresholds(filteredTrackWorkoutIds) → Map keyed by trackWorkoutId.
// All non-benchmark algorithms ignore ctx. At the call site (competition-leaderboard.ts:1147)
// pass { scoreType: eventScoreType, tableByEventId } — eventScoreType already exists at :1101–:1103.

// algorithms/index.ts:169  in calculateEventPoints
case "absolute_tier": {
  const tableByVariant = ctx?.tableByEventId.get(eventId)
  if (!ctx || !tableByVariant) throw new BenchmarkConfigError(`No tier tables loaded for event ${eventId}`)
  return calculateAbsoluteTierEventPoints(scores, scheme, ctx.scoreType, tableByVariant)
}
// algorithms/index.ts:628  in calculatePointsForPlace  — no static place map (mirror p_score)
case "absolute_tier": return 0
// algorithms/index.ts:669  getScoringAlgorithmName (no never guard — must add for UI label)
case "absolute_tier": return "Tier Rating"
```

> **Do NOT** add `absolute_tier` to the `tiebreakers.ts` online lower-is-better branch — tier is higher-is-better, aligning with the default (`tiebreakers.ts:78`).

### 6.3 Hybrid reps-or-time tests (Open 18.4 / 16.2)

> **DEFERRED to v2.** Hybrid covers exactly 2 of 58 tests; it is omitted from the v1 seeded HillerFit battery (marked "coming soon") and its `secondaryValue` engine plumbing + `hybridTier` are v2. The full design is kept here so v2 can pick it up without re-deriving it.

Modeled as scheme `time-with-cap`. **Store the two sub-scales as SEPARATE arrays, never one mixed array** (the earlier draft's single `thresholds[]` holding both reps-ints and ms-ints across the flip is the bug source). Use the existing `hybridScale` marker on each tier row to build two clean arrays — `repThresholds` (encoded reps, `desc`) and `timeThresholds` (encoded ms, `asc`):

```ts
function hybridTier(p): number {
  // repThresholds / timeThresholds are built from rows where hybridScale === "reps" | "time"
  // — two arrays, never one mixed array.
  const { repThresholds, timeThresholds, hybridFlipTier } = p.table  // flip e.g. 7
  if (p.status === "cap") {
    // didn't finish -> rep branch (higher reps better). reps live in secondaryValue.
    const reps = p.secondaryValue ?? 0
    if (reps < repThresholds[0]) return 0.5
    let tier = 0.5
    repThresholds.forEach((thr, k) => { if (reps >= thr) tier = k + 1 })   // 1..(flip-1)
    return tier
  }
  // finished (status "scored") -> time branch (lower ms better). Always outranks rep tiers.
  // Boundary: a finish exactly at the slowest time threshold still earns the first time tier.
  let tier = hybridFlipTier - 1     // floor: better than every rep tier
  timeThresholds.forEach((thr, k) => { if (p.value <= thr) tier = hybridFlipTier + k })
  return tier
}
```

> **v2 risk — cap/finish status derivation must be verified against source.** This branch keys on `status === "cap"` (didn't finish) vs `"scored"` (finished). For a `time-with-cap` event the cap/finish status is set in the encode + score pipeline; before shipping hybrid, **trace where `status: "cap"` is actually assigned for a time-with-cap submission** (the leaderboard's `computeSortKey` at `:1122` already consumes `timeCap.secondaryValue` for capped scores, so the data exists — confirm the status writer sets `cap` reliably when the athlete hits the cap and `scored` when they finish under it). Open 16.2 is "time/reps" (either outcome), so both branches must be exercised.
>
> **v2 risk — best-attempt selection is NON-monotonic for hybrid.** A finish time encodes as ms (~510000) while reps encode as ~164; a raw `(statusOrder, sortKey)` comparator cannot compare a capped attempt against a finished attempt. So for hybrid tests `promoteBest` **must compare by the computed `tier`, not by raw value** (store the snapshot `tier` on `score_attempts` and promote by max tier). For standard tests best-raw == best-tier (tier is monotonic in raw within a test), so the cheap raw comparator is fine there. See §7.1.
>
> Provide a worked **Open 18.4 M** fixture end-to-end as the canonical hybrid test: 62 reps capped → Tier 1; 8:30 finish → Tier 7; 6:00 finish → Tier 10.

### 6.4 Category attribute scores + Overall (new pass)

**Wiring prerequisite (don't skip):** the per-event loop (where `trackWorkout` is in scope, ~`:1150`) must **attach `trackWorkout.benchmarkCategory` onto each `eventResult`** it builds, alongside the per-event `tier` (= `pointsResult.points`). `fetchScores` selects from `scoresTable` only, so the category — which lives on `trackWorkouts` — is otherwise invisible to the aggregation pass below. One assignment in the loop closes the gap.

Inserted as a new pass over `leaderboardMap.values()` **immediately before `const leaderboard = Array.from(leaderboardMap.values())` at `competition-leaderboard.ts:1470`**, gated on `scoringConfig.algorithm === "absolute_tier"`:

```ts
const battery = await loadBattery(scoringConfig.absoluteTier.batteryId)  // throws if config/categories invalid (§5.1)
// DENOMINATOR is DERIVED from active included tests, NOT the JSON testCount (a validated cache only,
// §9/#9): loadBattery returns activeTestCountByCategory = count(benchmark_tests WHERE includedInScoring
// AND categoryKey = c.key). This is what makes the v1 Lite seed (deferred tests excluded) honest (§2.1/#7).
for (const entry of leaderboardMap.values()) {
  const sums: Record<string, number> = {}
  for (const er of entry.eventResults) {
    const cat = er.benchmarkCategory                       // attached in the per-event loop above
    if (cat) sums[cat] = (sums[cat] ?? 0) + er.points      // er.points == tier
  }
  entry.categoryScores = {}
  for (const c of battery.categories) {
    const denom = battery.activeTestCountByCategory[c.key] ?? c.testCount  // derived; untested-but-included = 0 drags down
    const avgTier = (sums[c.key] ?? 0) / denom             // 0..maxTier
    entry.categoryScores[c.key] = avgTier / battery.maxTier * battery.scoreMax   // 0..scoreMax (100)
  }
  // Overall = WEIGHTED MEAN of the category scores. HillerFit weights are all 1 ⇒ simple mean; a
  // generic battery with non-equal weights is honored. Category scores are ALREADY 0..scoreMax, so
  // the weighted mean IS the Overall — do NOT rescale again. (The earlier draft's
  // `/ categoryScale * overallMax` double-scaled a 0..100 value to 0..1000; #1.)
  const cats = battery.categories
  const wSum = cats.reduce((a, c) => a + (c.weight ?? 1), 0)
  entry.overallScore = cats.reduce(
    (a, c) => a + entry.categoryScores[c.key] * (c.weight ?? 1), 0,
  ) / wSum   // 0..scoreMax (100) — NO further rescaling
  entry.ratingBand = bandFor(entry.overallScore, battery.ratingBands)
}
```

> **Two fixes baked into the pass above:** **(1) No double-scale (#1).** Category scores are already 0..`scoreMax`; the weighted mean of them IS the Overall. The earlier `/ categoryScale * overallMax` line multiplied a 0..100 value back up to 0..1000 (a single Tier-7 board would have shown **700**, a perfect board **1000**) — it is deleted. A worked check: all tiers = 7 ⇒ each category score = `7/10*100 = 70` ⇒ Overall = mean = **70** (Regional caliber), matching §2.1/§2.2. **(2) Weighted mean honors the `weight` field.** The earlier draft defined `weight` but computed an unweighted `avg()`. For HillerFit (all weights 1) this is identical to the simple mean; for a generic battery it makes the configurable-weights promise (§9) real. **Single-test collapse still holds:** 1 category, weight 1 ⇒ Overall == that category score == `tier ÷ maxTier × scoreMax`.

New optional fields on `CompetitionLeaderboardEntry` (`competition-leaderboard.ts:71`, re-exported at `leaderboard-fns.ts:45`):

```ts
categoryScores?: Record<string, number>   // { STR: 73.3, GYM: 64.2, ... }  (each 0..scoreMax)
overallScore?: number                      // 0..scoreMax (100)
ratingBand?: string                        // "Seriously trained"
// per eventResults item: tier?: number | null; benchmarkCategory?: string | null
```

### 6.5 Ranking, multiplier, ties

```ts
// SEAM B  (competition-leaderboard.ts:1153, where `const multiplier = ...` lives) — protect
// half-tiers from Math.round
const multiplier = scoringConfig.algorithm === "absolute_tier"
  ? 1 : (trackWorkout.pointsMultiplier ?? 100) / 100
const points = scoringConfig.algorithm === "absolute_tier"
  ? (pointsResult?.points ?? 0)                  // raw tier, no round
  : Math.round(basePoints * multiplier)

// SEAM D  (competition-leaderboard.ts:1486, the `totalPoints: e.totalPoints` line inside the
// tiebreakerInput athletes map) — feed Overall/100 into the ranking instead of cumulative points.
// Because sex is a variant (one "Open" division), this single division ranks everyone by Overall;
// the existing :1508–:1514 sort (division, then overallRank) then works unchanged.
totalPoints: scoringConfig.algorithm === "absolute_tier" ? (e.overallScore ?? 0) : e.totalPoints
```

- **Rank key:** `overallScore` desc (fed in at `:1486`; `applyTiebreakers` at `:1497` assigns `overallRank`; final sort at `:1508–:1514` is unchanged).
- **Tie-break — benchmark-specific tier histogram, NOT field-relative countback (#5).** Do **not** reuse the existing `countback`: the synthesized per-event ranks (§6.2) are *field-relative*, so rank-1-on-a-weak-event (Tier 7) would out-count rank-4-on-a-strong-event (Tier 9) — inverting the absolute order. `applyCountback` (`tiebreakers.ts:213–276`) literally counts 1st/2nd/… placements, which is exactly the wrong signal for absolute tiers. Instead, among athletes tied on `overallScore`, compare **tier histograms**: most Tier 10s, then Tier 9s, … down through 1 and 0.5, then fall back to summed raw within the tied test set. Feed each athlete's per-event **tier list** (`eventResult.tier`, already attached in §6.4) — never the synthesized `er.rank`.
- **Multiplier forced to 1 AND `Math.round` skipped (#12):** organizers lose per-event weighting for batteries, but the spec math is fixed; multiplying a 0.5 tier then rounding would silently destroy half-tiers (verified gotcha). See the audit below.

> **Integer-points audit — the multiplier is NOT the only seam (#12).** The 0.5 sub-tier must survive end-to-end. Verified points-touching sites between engine and screen: **(1)** `competition-leaderboard.ts:1180` `Math.round(basePoints * multiplier)` → replaced by SEAM B (raw tier, no round). **(2)** A *second* rounding seam the earlier draft never named: `competition-leaderboard.ts:1327` `missingPoints = Math.round(calculatePointsForPlace(...) * multiplier)` — safe **only** because §6.2 makes `calculatePointsForPlace` return `0` for `absolute_tier` (`Math.round(0)=0`); pin it with a test. **(3)** `entry.totalPoints += points` (`:1316`) sums raw tiers — fine; note benchmark ranks on `overallScore` (SEAM D), so per-event `totalPoints` is display-only. **(4)** Display: both leaderboard tables render via `formatPoints` (`online-competition-leaderboard-table.tsx:173`, `competition-leaderboard-table.tsx:130`); the `absolute_tier` branch must `String(points)` with **no** `Math.round`/`Math.floor`/`toFixed(0)`, so `0.5` shows as a half-tier. **(5)** No leaderboard-results CSV export exists today (registration/revenue CSVs omit points) — the critic's "CSV export" site does not exist; if one is added later it must format tiers as decimals. Add a half-tier round-trip test asserting a `0.5` tier reaches `formatPoints` output unrounded.

---

## 7. Perpetual leaderboard & time windowing

> **This entire section is the v2 windowing layer.** v1 ships **best-to-date only** using the live `scores` row kept monotonic by the **keep-best-on-write** guard (§8.1): a retest overwrites the single `scores` row **only when it beats the stored tier/raw**, so the live row is the athlete's best submission, not merely the latest. There is **no per-attempt history and no invalidation-restore in v1** (an `invalid` action reverts that test to untested/tier-0). Everything below (history table, `promoteBest`, windows, **true all-time + invalidation-restore**) is the **v2** layer (§10, V2A).

### 7.1 Retest history — reconcile one-current-row with many-attempts (v2)

**Keep** the `idx_scores_competition_user_unique` contract (it's load-bearing for the upsert and the dedupe). Treat `scores` as the **all-time-best current row**; add an **append-only `score_attempts`** as the source of truth for every windowed query. Note `scores.recordedAt` already date-stamps the *current* row — it covers all-time windowing on its own; `score_attempts.achievedAt` is needed only because windows require **per-attempt** dates and retest history, which the single `scores` row cannot hold.

**Write path (every submit / retest / organizer edit):**

1. Encode value through `encode/*` (unchanged). For the BW-pullup test, the benchmark submit wrapper adds the representative bodyweight first (§2.5).
2. INSERT an immutable `score_attempts` row (`achievedAt` = client test date, default now; `tier` snapshot; `variantAtAttempt`; **and `cappedRoundCount`** so sortKey can be recomputed — see below).
3. `promoteBest(competitionEventId, userId, scalingLevelId)`: select all attempts for the key, pick the best, UPSERT its fields onto the `scores` row via the existing `onDuplicateKeyUpdate`. So `scores` always mirrors the all-time best.
4. (Scale only) recompute affected `(test,user,division,window)` cells in an optional materialized table.

> **`promoteBest` ordering is NOT a one-liner — three traps the earlier draft glossed:**
>
> 1. **sortKey reproduction needs round-level data.** The leaderboard deliberately *recomputes* `sortKey` at `:1093–:1122` rather than trusting the stored value, and that recompute consumes `cappedRoundCount` (from `scoreRoundsTable`) and per-round statuses. A flat `score_attempts` snapshot of `scoreValue/secondaryValue/sortKey` **cannot** reproduce this for rounds-reps tests (e.g. Cindy). Therefore `score_attempts` must also snapshot `cappedRoundCount` (added to the v2 DDL in §5.3) and `promoteBest` must recompute the key via `computeSortKey` the same way the leaderboard does — or it picks a stale-key winner.
> 2. **Standard tests: best-raw == best-tier.** For every standard test, tier is a monotonic step function of the raw encoded value, so ordering by `(statusOrder, sortKey)` and taking row[0] yields the max-tier attempt. The §7.2 "best" mode and `promoteBest` agree here.
> 3. **Hybrid tests: best-raw ≠ best-tier (non-monotonic).** A capped attempt's reps and a finished attempt's ms are not comparable as raw values, so for hybrid tests `promoteBest` (and "best" mode) must compare by the **snapshot `tier`**, not by sortKey. This is why `score_attempts.tier` is stored. (Hybrid is itself v2, so this only matters once hybrid ships.)
>
> `promoteBest` must also copy the winning attempt's own `verificationStatus` — otherwise a new best inherits a stale `"verified"`.

> **Invalidation restore (specified behavior).** When an organizer marks the current best **invalid**, `promoteBest` re-runs over the *remaining valid* attempts and promotes the next-best valid one onto `scores` (the athlete does **not** silently drop to tier 0 unless no valid attempt remains, in which case the test reverts to untested/tier 0). This is the whole point of keeping append-only history.

### 7.2 Window selection (v2)

| Window | Mode | Query |
|--------|------|-------|
| `best-to-date` | — | **(v1)** Read straight from `scores`, kept monotonic by keep-best-on-write (§8.1). Identical cost to today's leaderboard. **Not** windowed all-time (v2). |
| `12mo` / `24mo` | `current` | **(v2)** `score_attempts WHERE achievedAt >= now - N months`, then per `(test, user, division)` pick best — by `(statusOrder, sortKey)` for standard tests, by snapshot `tier` for hybrid (§7.1). |
| any | `best` | **(v2)** Substitute each test's value with the MAX-**tier** attempt from `score_attempts` before `calculateEventPoints`. ("best" means highest *tier*; for standard tests this equals best raw, for hybrid it must use the stored tier — §7.1.) |

The selected attempt set becomes the **source** of `EventScoreInput[]` — the absolute-tier math and category aggregation are **identical** regardless of window. A "current vs all-time best" page issues two reads (e.g. `12mo` + `all-time`) and diffs the Overall/100 + per-test tiers client-side; `all-time` is cheap (just `scores`).

### 7.3 Live vs materialized — recommendation

- **`best-to-date`: live** (reuses `scores`, same cost as today). **This is v1.** True windowed `all-time` is v2.
- **`12mo`/`24mo`: v2; live first, materialize later.** The current leaderboard is `O(events × registrations × scores)` with **zero server cache** (verified). A 58-test battery for a popular gym is far heavier than a fixed comp. When windowing ships, start live; add a thin `benchmark_window_bests` projection (refreshed incrementally on `promoteBest`) when a board exceeds a threshold (e.g. > 50 athletes).
- **Load budget (currently unmeasured — flag for validation):** "acceptable for v1" is an assertion, not a measured bound. Before opening a perpetual public board to a real gym, capture a p95 render time at a representative athlete count (e.g. 100 athletes × 58 events) and set a threshold (e.g. p95 < 500 ms) that triggers the materialization work in §7.3. The new category pass adds an `O(entries × events)` loop on top of the existing cost.
- Keep the existing client `staleTime: 10_000`.

### 7.4 Submission-window reinterpretation

A perpetual board is `competitionType: "benchmark"`, which **declares the `videoSubmissions` capability but NOT `submissionWindows`** (§5.2). After the M0a refactor, `checkSubmissionWindow`'s gate is `competitionCan(type, "videoSubmissions")` → passes; and because benchmark lacks `submissionWindows`, no window rows are ever seeded, so the no-window allow-all (`:161–:169`) returns allowed unconditionally. The `perpetual` capability (and `boardMode: 'perpetual'` in settings) disables any organizer UI that would create windows.

> **Result visibility — benchmark results are PUBLIC on valid submission, NOT publish-gated (#15).** The publish-gate default at `competition-leaderboard.ts:440–443` yields `divisionResults = {}` (hide-until-published) **only for `competitionType === "online"`**. Benchmark deliberately **does not declare `optInResultPublishing`** (§5.2), so its default is `undefined` → the `:1082–:1085` per-(event,division) publish filter is skipped → every non-`invalid` score is visible immediately. This is essential: a perpetual 55-test v1 self-serve board must never require the organizer to publish every test before anything shows. Organizer moderation still works via the existing `invalid` verification action (excluded at `:248`), not via the publish gate.

### 7.5 Do NOT reuse Series

Series (`series-leaderboard.ts`) aggregates the **same workout across different competitions**, ranking athletes **relatively** across throwdowns. A benchmark board is **one** board, time-windowed, absolute-scored, never-closing. Borrow Series' *pattern* (a separate leaderboard module that builds `EventScoreInput[]` then delegates to `calculateEventPoints`) but build a parallel `src/server/benchmark-leaderboard.ts` — do not extend `series-leaderboard.ts`.

---

## 8. Submission & verification UX

### 8.1 Athlete entry + retest

- **Reuse** `VideoSubmissionForm` (`src/components/compete/video-submission-form.tsx`) on the same event-detail route `routes/compete/$slug/workouts/$eventId.tsx`. Video URL requirement is driven by the battery's **`videoPolicy`** (`never` = optional as today; `for_top_scores` = required once the submission would land in a top tier / top-N; `always` = required on every submission) — v1 default `never` (#17). Score required only on `videoIndex 0`.
- Raw value (225 lb bench, 5:30 mile, "5+12" rounds) flows through `parseScore` + `encodeScore` unchanged. **Exception — Weighted C2B Pull Up:** the form collects *added weight* and the benchmark submit wrapper adds the representative bodyweight constant before `encodeScore` (§2.5).
- **Sex/variant is SNAPSHOTTED at submit, not read live (#24).** Capture `scores.benchmarkVariant = user.gender` onto the score row at write. The engine reads the variant from that snapshot, so a later profile gender change affects only **future** submissions and never silently re-tiers prior scores (live-reading `user.gender` at render — there is no server cache — would re-tier everything; rejected, §13). (We do **not** seed Men/Women divisions; one "Open" division holds everyone — §12.1.)
  - **Variant is NOT the division key (#3a).** Write `scalingLevelId` = the single **"Open" division** level (matching `registration.divisionId`) so leaderboard grouping/dedupe/publish/upsert (`competition-leaderboard.ts:1036–:1088`, `scores.ts:126`) stay on one unified board; carry the sex on the separate `benchmarkVariant` snapshot column. Encoding M/F as `scalingLevelId` would either drop the score or split the board (§5.1).
  - **Gender is strictly Male/Female** (`GENDER_ENUM`, `users.ts:23`), an indexed enum captured via the existing athlete-profile flow (`athlete-profile-fns.ts:148`). **Gate benchmark participation on a complete profile** — `user.gender` must be set before an athlete can submit (one-field prompt if missing). No per-submission sex picker, no non-binary case. A null variant at scoring time is an invariant violation and **fails closed** (§6.2), never defaults to male.
- **Retest (v1) = keep-best-on-write (#2).** On re-submit, the benchmark submit wrapper computes the new tier and runs the upsert **only when the new score beats the stored tier** (raw value as the tiebreak) — an equal-or-worse retest is ignored — so the single live `scores` row is the athlete's **best-to-date**, not merely the latest. This makes "best-to-date" honest without a history table. **Limitation (state it plainly):** without `score_attempts`, an organizer `invalid` action on the current best **cannot restore a prior best** — the test reverts to untested/tier-0 until the athlete resubmits. True all-time history + invalidation-restore is v2 (§7.1).
- **NEW:** when an athlete re-submits a value different from a previously verified one, reset `scores.verificationStatus = null` and video `reviewStatus = "pending"` so the cell re-enters review (closes the verified-staleness gap at `video-submission-fns.ts:949/1143`).
- **`isOpenJoin`** (single-test boards): lazily create the registration on first submit instead of throwing at `video-submission-fns.ts:887` — but **only behind a guard list, in one transaction (#16):** (1) reject unless `battery.isOpenJoin` and `scoringConfig.algorithm === "absolute_tier"`; (2) reject unless the competition `status === "published"` and visibility permits (no submitting to an unpublished/private board — `competitions.ts:108–114`); (3) reject unless `user.gender` is set (profile-complete gate) and any required waiver is signed; (4) create the athlete's individual `teamId` + registration **transactionally** with `divisionId` = the single "Open" division and `scalingLevelId` = that **same Open level** (NOT a sex level, #3a), using an **idempotent upsert** on registration (unique `(competitionId, userId)`) so a duplicate-registration race collapses to one row; (5) **rate-limit** the lazy-register + submit path (`submitVideoFn` has none today). Without (4) the score upsert keyed on `(competitionEventId, userId, scalingLevelId)` has no division context (§13.7).

### 8.2 Video → tier recalc — read-time derivation AND the write-side adjust path

**Read side (the easy half):** the tier is **derived at read time** inside the `absolute_tier` branch from the score's current `scoreValue`. Because the leaderboard reads live and recomputes per request (`fetchScores:212`, sortKey recompute `:1093–:1122`), any organizer action that changes `scoreValue` (`adjust`), zeroes/excludes it (`invalid` → excluded at `:248`), or leaves it (`verify`) **automatically** flows into the recalculated tier — and into category scores + Overall — on the next read. **No new read-side write hooks are needed.** Surface the derived tier in the review UI as a preview ("Claimed 225 lb → Tier 7"; on adjust, live "new tier").

**Write side (the part the earlier draft under-sold) — the organizer ADJUST path is NOT a one-liner.** When an organizer adjusts the raw value during review, the existing verify/adjust transaction (`submission-verification-fns.ts:251`) already re-encodes the adjusted raw value and writes `scores.scoreValue` + `verificationStatus`; the tier then re-derives on read, so **v1 needs no new write logic here** beyond surfacing the preview. **For v2 (once `score_attempts` exists):** adjust must additionally (a) write a `score_attempts` snapshot of the adjusted value with its computed tier, (b) call `promoteBest` (the adjusted value may or may not remain the best across attempts), and (c) on `invalid`, `promoteBest` restores the next-best valid attempt (§7.1). The read-time tier derivation and the v2 write-time snapshot are **not** double-counting: the snapshot records history; the leaderboard still derives the displayed tier from the promoted `scores` row at read time.

> **v2:** the `score_attempts` snapshot write needs adding to all writers (`submitVideoFn`, `saveCompetitionScoreFn`, and the verify/adjust/invalid branches) — centralize in one `recordAttempt` + `promoteBest` helper so history never silently drops a write (verified multi-writer gotcha).

### 8.3 Category-breakdown "stat line" page

- **New route** `/compete/$slug/stats` (public, per-athlete via `?athlete=` or signed-in user).
- **New component** `<BenchmarkStatLine>`: four attribute cards (STR/GYM/ENG/WORKOUT), a big Overall/100 dial with the rating band, a per-test grid where untested (tier 0, no submission) is visually distinct from "attempted, T0" **and from a config "unavailable" cell (§6.1).** Each submitted cell carries a **verification badge** derived from the existing `scores.verificationStatus` (`scores.ts:90`): `null` → `claimed`/`pending`, `verified` → `verified`, `adjusted` → `adjusted`, `invalid` → excluded — so self-claimed and organizer-verified scores are visibly distinct on a public board (#17). No migration (reuses existing columns + the `scoreVerificationLogsTable`).
- **New server fn** `getBenchmarkStatLineFn(competitionId, athleteUserId, window?, mode?)` → reuses `getCompetitionLeaderboard` scoped to the athlete; returns `eventResults` (each with `tier` + `benchmarkCategory`) + `categoryScores` + `overallScore` + `ratingBand`. (In v1 `window`/`mode` are no-ops — best-to-date only.)
- Add a **"Stats" tab** to `CompetitionTabs` shown only when `scoringAlgorithm === "absolute_tier"`.

### 8.4 Perpetual board with window toggle

- **Extend** the existing `/compete/$slug/leaderboard` + online leaderboard table. Overall column shows **Overall/100 + band** instead of cumulative points when `algorithm === "absolute_tier"`; rows carry the verification badge (§8.3) — **this is v1.**
- **Copy matters for the first demo (#20).** A benchmark is neither a normal online competition nor an in-person event, but it inherits online-flavored labels ("Submissions", "Results", "Submission windows", "Divisions", "Open", "Verify", "Publish"). Audit the benchmark-visible strings so the board reads as a perpetual rating board, not a bolted-on online comp — at minimum the leaderboard header, the score-entry CTA, and the Stats tab. Not a correctness blocker, but it's the difference between "polished" and "bolted-on" at a gym demo.
- **v2:** new URL search params on `leaderboardSearchSchema` (`leaderboard.tsx:10`): `window=12mo|24mo|all`, `mode=current|best`, threaded to `getCompetitionLeaderboardFn` input (`leaderboard-fns.ts`) → `fetchScores` predicate. v1 ships best-to-date only (no toggle).

### 8.5 Generic gym authoring + single-test flow

> **v1 ships the training-PDF-derived benchmark (and "post your bench") as code-seeded data modules — the generic authoring UI / tier-table editor is v2.** The data model is fully generic from day one (batteries/tests/thresholds are just rows), so the editor is additive-later, not a rewrite. Building a per-cell editor for 1,160 cells before the concept is validated is the time-sink the product critique flagged.

- **Battery = online-comp organizer flow reused wholesale** (for the comp shell): `OrganizerCompetitionForm` → `createCompetitionFn` (as `competitionType: "benchmark"`); divisions via `initializeCompetitionDivisionsFn` (seed a single "Open" group); events via `createWorkoutAndAddToCompetitionFn`. Benchmark inherits the right feature set automatically from the capability registry (§5.2).
- **Training-guide-derived benchmark** ships as a seeded battery (mirror `demo-competition-fns.ts`): 58 designed trackWorkouts tagged with `benchmarkTestId` + `benchmarkCategory`, one "Open" division, the battery + tests + thresholds rows. The seed extracts its test and threshold data from `/Users/zacjones/Downloads/HillerFit_Training_Guide.pdf`. Each test carries the correct `scheme` + `scoreType` (the latter encodes direction — §6.1). It does **not** create any HillerFit-branded page, route, navigation item, marketing surface, logo, call to action, or theme.
- **"Post your bench"** = same machinery, 1 event, `isOpenJoin = true`, one-column board. Also seeded as a data module in v1.
- **v2 — NEW scoring panel** (extend `scoring-settings-form.tsx` at `/compete/organizer/$competitionId/scoring.tsx`): a **tier-table editor** that takes raw values per (test, sex, tier) and **encodes them through `encode/*` before INSERT** into `benchmark_tier_thresholds`. The editor exposes a **"higher value is better / lower value is better" toggle per test** (the mental model organizers actually have) and **derives `scoreType`** from it (`better=higher → max`, `better=lower → min`), then **validates against `getSortDirection(scheme, scoreType)`** so an impossible combination — a load test marked lower-better, or a `sum`/`average`/`first`/`last` scoreType that falls through to the scheme default — is rejected at author time (#19). No raw `scoreType` picker, no `tierDirection` column (direction stays derived). Gated on validated demand for gym-authored batteries.

### 8.6 Concrete file inventory (experience layer)

| Add / Extend | Path | Phase |
|--------------|------|-------|
| NEW route | `routes/compete/$slug/stats.tsx` | v1 |
| NEW component | `components/compete/benchmark-stat-line.tsx` | v1 |
| NEW server fn | `server-fns/benchmark-stat-line-fns.ts` (or add to `leaderboard-fns.ts`) | v1 |
| Extend | `components/.../online-competition-leaderboard-table.tsx` (Overall/100 + band column), `components/competition-tabs.tsx` (Stats tab) | v1 |
| NEW | `lib/competitions/capabilities.ts` (capability registry); refactor the **chokepoint** `competitionType` sites → `competitionCan()` (M0a; ~100 remaining sites are M0b, deferred) | **v1 (M0a)** |
| Extend | `server-fns/video-submission-fns.ts` (`benchmarkVariant` snapshot + Open-division `scalingLevelId`, **keep-best-on-write**, guarded `isOpenJoin` lazy register, verification reset; optional BW wrapper) | v1 |
| Extend | `routes/compete/$slug/leaderboard.tsx` (window/mode search params) | **v2** |
| NEW component | `components/organizer/benchmark-tier-table-editor.tsx`; extend `routes/compete/organizer/$competitionId/scoring.tsx`, `scoring-settings-form.tsx` | **v2** |

---

## 9. Genericity & reuse

The training-guide-specific content is **data, not code or branded UI**:

> **The generic vision is preserved in full — it is just phased.** v1 ships a training-guide-derived seed (data + the absolute-tier engine); the *authoring UI* that lets any gym build a battery is v2. Because every source-specific thing is a **row**, not code or branded UI, "any gym authors a battery" needs no data-model change later — only the editor UI. None of the v1 cuts are rewrites.

- **The training-guide benchmark is one `benchmark_batteries` row.** Categories, test counts, weights, and rating bands are JSON columns on that row. The (v1) **55 included** seeded tests are `benchmark_tests` rows (the 2 hybrid Open tests + Weighted C2B are v2 "coming soon", carried with `includedInScoring = false` so they are **excluded from the denominator** — §2.1/#7); the v1 thresholds (10 × 2 sexes per included test, ~1,100) are `benchmark_tier_thresholds` rows (the full-58 chart is ~1,160 at v1.1). The **denominator is derived from `count(active includedInScoring tests)`**, so enabling a deferred test later is a data change, not a math change (#9). **Nothing about the PDF source is hard-coded into routes/pages** beyond the seed module (itself just data + an idempotent seeder).
- **Any gym authors a battery** (v2) through the organizer flow + the tier-table editor. They pick categories, add tests (choosing `scheme` + `scoreType` from the existing workout vocabulary — `scoreType` sets the tier direction, §6.1), and fill the tier grid.
- **Configurable per battery:** number of categories, test counts (a validated cache; the real denominator is derived, §6.4/#9), category weights (`weight` in the categories JSON, now applied as a weighted mean — §6.4), **`maxTier`** (the per-test tier ceiling) and **`scoreMax`** (the 0..100 Overall ceiling) — renamed from the ambiguous `categoryScale`/`overallMax` (#1), rating bands, `isOpenJoin`, **`videoPolicy`**, variant set (the scaling group), and `boardMode`.
- **Single-test "post your bench"** is the degenerate case: 1 category, 1 test, `isOpenJoin = true`. Overall == category score == `tier ÷ maxTier × scoreMax`. **Zero special-case branches** — the same (weighted) aggregation math collapses correctly.
- **The variant axis is generic too:** "male"/"female" is the HillerFit default, but a battery could define any variant set (e.g. weight classes) via its `variantScalingGroupId` — the engine just reads which threshold column to use.

---

## 10. Implementation plan (phased)

**Phasing principle (revised):** approve the architecture, lean the phasing. The thesis (reuse the online runtime, add one `absolute_tier` algorithm) is sound; the earlier plan put two **v2-grade** concerns — perpetual *windowing* (`score_attempts`/`promoteBest`) and the *generic authoring UI* — on the v1 critical path, plus baked the *hybrid* test class (2 of 58) into the core algorithm. We pull all three off the v1 path. Every cut is **additive-later, not a rewrite** — the data model stays generic, the schema columns stay nullable. The goal is a demoable "video-game stat line for your fitness" in front of a real gym in ~2-3 milestones instead of 6.

> **Revision 2 further shrinks the v1 surface (critique #18 — "v1 is still big").** M0 is split so only chokepoints ship first (M0a; the ~100-site cleanup is M0b, post-demo); Weighted C2B is deferred (one fewer special case); the denominator is derived (no hand-maintained counts); and results auto-publish (no per-event publishing). If even the 55-test training-guide seed feels heavy before the concept is proven, the **leanest validation slice is the single-test "post your bench" battery** (§12.12) — same machinery, one owner-authored test, a stat line in front of users fastest.

Each milestone is independently mergeable. **DB workflow:** `pnpm db:push` to apply schema to the dev branch during development; `pnpm db:generate --name=<feature>` to generate migrations only before merging to main. The **3** `benchmark_*` definition tables, the two `trackWorkouts` columns, **and the new `scores.benchmarkVariant` column** **require a real migration**; the capability registry, the `"benchmark"` `competitionType` value, and the `"absolute_tier"` `scoringAlgorithm` value are TS-only and need **no** migration. `score_attempts` is a separate later migration (V2A).

### v1 — capability refactor first, then the thinnest stat-line slice (training-guide-derived, best-to-date only)

| M | Milestone | Files touched | Migration? | Effort |
|---|-----------|---------------|------------|--------|
| **M0a** | **Extend existing capability registry + benchmark chokepoint refactor (foundational; ships on its own)** — the current checkout already has `lib/competitions/capabilities.ts` with `competitionCan`/`leaderboardVariant` for `"in-person"`/`"online"` and tests that make `"benchmark"` fail closed. Extend that registry with `"benchmark"` and `perpetual`, then refactor/verify ONLY the sites benchmark v1 needs: submission gate (`video-submission-fns.ts` + score/video/window-status API routes), publish-gate default (`competition-leaderboard.ts`), leaderboard-variant selector, route/tab visibility. Behavior-preserving for online/in-person. **Two test layers:** updated registry truth-table snapshot **+ characterization tests** on the real chokepoint routes/server-fns (benchmark passes the video-submission gate; benchmark does not use submission windows; results visible w/o publish; organizer-vs-cohost parity; `scoringAlgorithm==="online"` untouched). Leaves the `scoringAlgorithm`-axis sites alone. Full spec: `ai/research/m0-competition-type-capability-registry.md`. | `lib/competitions/capabilities.ts`, current chokepoint files | No | M |
| **M0b** | **Deferred cleanup (after the demo)** — refactor the remaining ~100 `competitionType`/`isOnline`/`isInPerson` sites (heats, check-in, venue, volunteers, results-entry model, sidebar labels) opportunistically. Until done they keep their literal checks; benchmark (neither type) correctly leaves those features hidden. Not on the demo critical path. | ~45–50 route/component files (mechanical) | No | L |
| **M1** | **Register the `"benchmark"` type + schema + PDF-derived seed (3 tables + 1 scores column, no `score_attempts`)** — add `"benchmark"` to `COMPETITION_TYPES` + the `$type` union + a registry entry declaring `{videoSubmissions, perpetual}` (**NOT** `optInResultPublishing`); `benchmarks.ts` (3 tables with `ownerKey` unique, `maxTier`/`scoreMax`, `videoPolicy`, `includedInScoring`), ULID factories, `trackWorkouts.benchmarkTestId`/`benchmarkCategory` + **`scores.benchmarkVariant`**; `benchmark.schema.ts` (Zod: thresholds `z.array().length(10)`, strict fail-closed `categoriesSchema`, `scoringConfig.superRefine`); seed data derived from `/Users/zacjones/Downloads/HillerFit_Training_Guide.pdf` (**55 included** tests; hybrids + Weighted C2B `includedInScoring=false`) + idempotent seeder publishing a generic `competitionType:"benchmark"` competition with results auto-visible. No HillerFit-branded pages, routes, navigation, marketing copy, logos, calls to action, or visual theme. | `db/schemas/competitions.ts`, `lib/competitions/capabilities.ts`, `db/schemas/benchmarks.ts`, `db/schemas/common.ts`, `db/schemas/programming.ts`, `db/schemas/scores.ts`, `db/schema.ts`, `schemas/benchmark.schema.ts`, `schemas/scoring.schema.ts`, `lib/seed/*benchmark*` | **Yes** (`--name=benchmark-battery`) | M |
| **M2** | **Absolute-tier algorithm (standard only)** — `absolute-tier.ts` (standard tiers + `scoreType`-driven direction; **fail-closed on missing variant/table** via `BenchmarkConfigError`; **no hybrid**); `category-aggregation.ts` (weighted mean, **no double-scale**, derived denominator); `absolute_tier` enum + config block + `superRefine`; **widen `calculateEventPoints` with `ctx:{scoreType, tableByEventId}`**; both dispatch switches (`:182`, `:660`) + un-guarded label fn (`:669`); `EventScoreInput.variant`; **benchmark tier-histogram tiebreaker**. Unit tests: tier 0/0.5/1–10; direction cases (hold `time`+`max`, watts `points`+`max`, run `time`+`min`); **Overall not double-scaled** (all tiers 7 ⇒ 70 not 700); weighted aggregation untested=0; half-tier survives `formatPoints`; null-variant fails closed; **one encode fixture per family** (load, time-min, meters, feet, reps, points, rounds-reps, BW-add). | `lib/scoring/algorithms/absolute-tier.ts`, `lib/scoring/category-aggregation.ts`, `lib/scoring/algorithms/index.ts`, `lib/scoring/tiebreakers.ts` (or new benchmark tiebreaker), `schemas/scoring.schema.ts` | No | M |
| **M3** | **Submission (best-to-date, no history)** — snapshot `scores.benchmarkVariant = user.gender` + write Open-division `scalingLevelId` (require gender on profile); **keep-best-on-write** guard (overwrite only when the new tier/raw is better); **guarded** `isOpenJoin` lazy register (published+visible, profile/waiver, transactional individual team, idempotent, rate-limited); verification reset on changed re-submit; (optional) BW-pullup wrapper if not deferred. **No `score_attempts`/`promoteBest`** (invalidation reverts to tier-0 in v1). | `server-fns/video-submission-fns.ts`, `server-fns/submission-verification-fns.ts` (reset on adjust) | No | M |
| **M4** | **Leaderboard + stat-line page (THE DEMO)** — build a score/variant lookup from `scores.benchmarkVariant` + `loadAllBenchmarkThresholds` ONCE before the loop (no N+1); variant from `scores.benchmarkVariant` snapshot at `:1102–:1144`; attach `benchmarkCategory` onto each `eventResult`; multiplier=1 **and skip `Math.round`** at `:1153`/`:1327`; category pass before `:1470`; rank-by-Overall at `:1486`; tier-histogram tiebreaker; **results auto-visible** (no publish gate); verification badges; new entry fields; `/stats` route + `<BenchmarkStatLine>` (untested vs attempted vs unavailable); Stats tab; benchmark-flavored copy. Best-to-date only. | `server/competition-leaderboard.ts`, `server-fns/leaderboard-fns.ts`, `routes/compete/$slug/stats.tsx`, `components/compete/benchmark-stat-line.tsx`, `components/competition-tabs.tsx` | No | L |

**v1 is demoable at the end of M4** — a public, perpetual, absolute-scored Overall/100 board + per-athlete stat line for the seeded PDF-derived benchmark. **Then validate with a real gym before building any of v2.**

### v2 — only after validation (additive, no rewrites)

| M | Milestone | Why deferred |
|---|-----------|--------------|
| **V2A** | **Retest history + windowing** — `score_attempts` table (incl. `cappedRoundCount`/`tier` snapshot for sortKey reproduction); `promoteBest` (standard: best-raw; hybrid: best-tier) + invalidation-restore; `window`/`mode` params + `fetchScores` predicate; window toggle UI; materialization threshold per §7.3. | Highest-complexity, least-validated; best-to-date (live `scores` row + keep-best-on-write) covers v1. Off the foundation so the riskiest reconciliation logic isn't front-loaded. |
| **V2B** | **Hybrid reps-or-time** — `EventScoreInput.secondaryValue`; `hybridTier`; two-array threshold storage; cap/finish status verification; Open 18.4 fixture; seed the 2 deferred tests. | 2 of 58 tests, disproportionate algorithm/test burden; schema columns already nullable so no migration. |
| **V2C** | **Generic authoring UI** — per-cell tier-table editor (encodes before save); battery create/publish flow; generic single-test template. | Needed by zero users at launch (HillerFit is code-seeded); gate on validated demand for gym-authored batteries. |

> The distinct `competitionType:"benchmark"` + capability registry that an earlier draft deferred is now **foundational M0a** (per owner steer) — it is no longer a deferred item. Only the broad cleanup (M0b) is deferred.

**Recommended sequence:** **M0a (chokepoint capability registry — mergeable on its own, benefits the online product)** → M1 → M2 (testable in isolation with seeded data) → M3 → **M4 (demo + validate)** → then M0b cleanup + V2A/V2B/V2C as demand dictates.

---

## 11. lat.md documentation plan

Per the project's required post-task checklist (`lat check` must pass, update `lat.md/` for any new functionality):

| Action | File / section |
|--------|----------------|
| **NEW** | `lat.md/benchmarks.md` — the battery/category/test/tier-table model, the absolute-tier scoring intent, the perpetual-instance binding (a distinct `competitionType:"benchmark"` + the capability registry), the 0/0.5/1–10 rule, `Σtier÷count÷maxTier×scoreMax` + weighted Overall/100 math (no double-scale), the variant-snapshot / best-to-date model, the BW representative-bodyweight encoding (deferred), and the deferred hybrid case. Cross-link `[[lat.md/domain.md#Scoring]]` and `[[lat.md/series-event-templates.md]]`. Add source refs `[[src/db/schemas/benchmarks.ts#benchmarkTierThresholdsTable]]`, `[[src/lib/scoring/algorithms/absolute-tier.ts#calculateAbsoluteTier]]`. |
| **Update** | `lat.md/domain.md` — Competitions: document the **competition-type capability registry** (`competitionCan`) and the distinct `competitionType:"benchmark"` (declaring videoSubmissions/perpetual — **NOT** optInResultPublishing, so benchmark results are public on valid submission) + `algorithm:"absolute_tier"`; Scoring: add the `absolute_tier` algorithm, that points = tier, and the DB-`dq`→engine-`dnf` status mapping; Video Submissions: note v2 retest history (`score_attempts`) + verification-reset-on-re-submit. |
| **Update** | `lat.md/organizer-dashboard.md` — scoring config: note benchmark batteries are always-open (no submission windows); the per-cell tier-table editor is v2. |
| **Update** | `lat.md/series-event-templates.md` — add a "not the same as benchmark boards" note (Series = cross-comp relative; benchmark = single-board absolute, best-to-date in v1). |
| **Test specs** | If `lat.md/tests.md` requires `// @lat:` mentions, add v1 spec sections for: **encode-roundtrip per encoding family** (load 115 lb → 52163 g; time-min 5:00 → 300000 ms; meters 2K → 2000000 mm; feet 50 ft → 15240 mm; reps 30 → 30; points/watts 250 → 250; rounds-reps "5+12" → 500012; BW-pullup add-bodyweight (185+25) lb → 95254 g); 0.5 sub-tier; **direction cases** (time-hold `scoreType:"max"` = longer-better; avg-watts `points`+`max`; run `time`+`min`); **Overall NOT double-scaled** (all tiers 7 ⇒ 70, not 700); **derived denominator** with a deferred test excluded; weighted category aggregation with untested = 0; **half-tier survives `formatPoints`** (multiplier=1, no round at `:1180`/`:1327`); **null variant fails closed** (no male default); **missing tier table → `BenchmarkConfigError`** (not silent tier 0); **tier-histogram tiebreaker** (Tier 9 on a strong event beats Tier 7 on a weak event despite the synthesized rank); **keep-best-on-write** (a worse retest does not overwrite); and the `dq→dnf`→tier-0 mapping. **v2 specs:** hybrid Open 18.4 (62 reps cap→T1, 8:30→T7), window best-attempt selection, promoteBest sortKey reproduction + invalidation-restore. |
| **Validate** | Run `lat check` — all wiki links and code refs must pass before the task is considered done. |

---

## 12. Open decisions for review (A vs B, with recommendation)

> **No product fork is open for v1.** The owner clarified that the first seed is built against the local training PDF and that HillerFit-branded pages are out of scope. The remaining choices below are recorded for traceability and v2 planning.

1. **Sex axis — variant vs division.**
   **A (recommended):** Sex is a per-athlete **variant** sourced from the required M/F `user.gender` profile field, threaded into `EventScoreInput.variant`; all athletes sit in one "Open" division and rank on **one unified Overall/100 board**.
   **B (rejected):** Seed "Men"/"Women" **divisions**; sex rides existing `scalingLevelId` plumbing with zero engine change, but the board **splits** by sex.
   *Recommendation: A* — but **state the cost honestly:** A is the **single largest source of new engine surface**, not a free win. It forces `EventScoreInput.variant`, `user.gender` threading, the nullable-`scalingLevelId` tier-0 trap (§13.5), and requiring gender (M/F) on the athlete profile — all **mandatory companions** (modest, since `user.gender` already exists as an enum + capture flow). The training guide's score model is one absolute 0–100 scale for everyone; the unified board is the product, so A still wins. B is the simpler-plumbing fallback if split boards are ever wanted.

2. **✅ RESOLVED (owner steer) — competition type: distinct `"benchmark"` behind a capability registry, NOT reuse `"online"`.**
   **A (chosen):** Add `competitionType: "benchmark"` and a **capability registry** (`competitionCan(type, capability)`, §5.2). Refactor the **~129** `competitionType`/`isOnline`/`isInPerson` sites (61 files) to capability lookups — behavior-preserving for online/in-person — **in two tranches: M0a chokepoints (v1) + M0b cleanup (deferred, post-demo)** to bound blast radius (#6). Benchmark declares `{videoSubmissions, perpetual}` — **NOT `optInResultPublishing`** (that would hide every event until published; benchmark results are public on valid submission, #15). Foundational **M0a**.
   **B (rejected):** Reuse `competitionType: "online"`, distinguish only by `scoringConfig.algorithm`. Zero refactor, but it **pollutes the standalone online product** with benchmark behavior and piles a third meaning onto the already-overloaded `"online"` token (which is also a `scoringAlgorithm`).
   *Why A:* online competitions are a crucial standalone product; the owner wants a system that assumes more types are coming and lets them reuse current features cleanly. A costs one mechanical, behavior-preserving refactor up front but makes online *cleaner* and every future type (leagues, ladders) nearly free. Migration is TS-only either way. The only real cost is the refactor effort (now bounded to M0a, M); de-risked by the snapshot truth-table test **plus characterization tests on the real chokepoint routes/server-fns** (§5.2/#6).

3. **Tier tables — real tables vs `settings` JSON.**
   **A (recommended):** Real `benchmark_*` tables (queryable, per-cell editable, joinable on every read).
   **B:** Inline the ~1,160 thresholds in `competitions.settings` JSON.
   *Recommendation: A.* Decisive: the data is too heavy and too query/edit-bound for JSON, and malformed-JSON-silently-becomes-null (verified gotcha) makes 58-test thresholds in JSON fragile.

4. **Category model — JSON-on-battery + column-on-event vs a fourth `benchmark_categories` table.**
   **A (recommended):** Categories as JSON on the battery (`[{key,label,testCount,weight}]`) + `benchmarkCategory` column on each event.
   **B:** A separate `benchmark_categories` table.
   *Recommendation: A.* Categories are a tiny fixed list, never independently queried; A avoids a fourth table and a join.

5. **⭐ RE-SCOPED — windowing on the v1 path vs deferred; and "all-time" vs "best-to-date" (#2).**
   **A (NOW recommended):** **Defer windowing + per-attempt history + invalidation-restore to V2A.** v1 ships **best-to-date only** off the live `scores` row, kept monotonic by a **keep-best-on-write** guard (§8.1): a retest overwrites only when it beats the stored tier/raw. This is honestly **"best-to-date," not "all-time"** — without `score_attempts`, an `invalid` action on the current best reverts the test to tier-0 until the athlete resubmits. No `promoteBest` in M1–M4.
   **B (earlier draft):** Call it "all-time" and ship `score_attempts` + windowing in the foundational M1 (or, the *original* overclaim: call overwrite-in-place "all-time" — rejected as dishonest).
   *Recommendation: A* — windowing is the least-validated, highest-complexity part (promoteBest sortKey reproduction needs round-level data, §7.1) and is not needed to validate the concept. The earlier draft **overclaimed "all-time"** while overwriting in place (#2); the keep-best guard is the cheap honest middle. When true history ships (V2A): live first, then materialize past ~50 athletes (§7.3). **Owner note:** if the brand *requires* preserved PR history at launch, pull a minimal `score_attempts`+`promoteBest` into v1 instead (the critic's split-history option) — but that re-imports the riskiest reconciliation.

6. **Promote-best-on-write vs compute-best-on-read (V2A only).**
   **A (recommended):** `promoteBest` keeps `scores` == all-time best (cheap reads).
   **B:** No promote step; compute best on every read.
   *Recommendation: A.* Keeps `all-time` reads as cheap as today and gives a single live "current" value. (Moot for v1, which has no history.)

7. **`achievedAt` source — athlete-entered vs server-now (V2A only).**
   **A (recommended):** Athlete-entered test date (enables backfilling the "past 12–24 months" history HillerFit requires), with a "not in the future" guard.
   **B:** `now()` only (prevents window-gaming).
   *Recommendation: A* with the guard. (Moot for v1 — no windows.)

8. **⭐ Weighted C2B "BW"/"+5" — baked representative bodyweight vs DEFER vs true per-athlete (#14).**
   **A:** Bake a representative bodyweight per variant (M 185 lb / W 145 lb) into the encoded threshold; athlete enters *added* weight at submit and the wrapper adds the constant (§2.5). Simple, but it ships a **knowingly-unfair scored value on a public board** (a 220 lb and a 150 lb athlete doing bodyweight C2B score identically).
   **B (v1.1):** Capture athlete bodyweight at submit and compute that one test's threshold at runtime (accurate, special-cased).
   **C (NOW recommended for v1):** **Defer Weighted C2B to v2** alongside the 2 hybrid Open tests (GYM → 13 included, §2.1). Deferring one GYM test is as cheap as deferring the hybrids and removes the single wrong-by-design cell from the public board. If shipped anyway, **capture `bodyweightLbAtAttempt`+`addedWeightLb` on the score row** even while scoring off the constant, so B is backfillable.
   *Recommendation: C for v1, B for v1.1.* If the owner prefers A, confirm the two constants and accept the stated inaccuracy. The encode + submit contract for A/B is defined in §2.5.

9. **Chart re-versioning — immutable published thresholds vs in-place editable.**
   **A (recommended):** Immutable published thresholds with an explicit **versioned re-rate** action (clean audit; supports the all-time window honestly).
   **B:** In-place editable thresholds that retroactively re-tier everyone.
   *Recommendation: A.* The chart "refreshes every 2–3 years"; without versioning, historical tiers silently shift. (Defer the full versioning machinery to v2; for v1, since v1 has no history, edits simply re-tier on next read — acceptable while there is no windowed past to honor.)

10. **Stat-line visibility — public vs private-by-default.**
    **A (recommended):** Public per-athlete `/stats` (gym-leaderboard vibe) with an athlete privacy toggle in settings.
    **B:** Private by default.
    *Recommendation: A* with the toggle.

11. **✅ RESOLVED — gender source.** The platform is **Male/Female only** (`GENDER_ENUM` = `{MALE, FEMALE}`, `users.ts:23`), so there is no non-binary case. Variant = `user.gender` (an indexed enum already captured via the athlete profile, `athlete-profile-fns.ts:148`). Decision: **require `user.gender` on the athlete profile before benchmark participation** (one-field prompt if missing); no per-submission sex picker. This removes the former tier-0-on-missing-variant risk at the source.

12. **✅ RESOLVED — source data and branding boundary.** The local `/Users/zacjones/Downloads/HillerFit_Training_Guide.pdf` is the source artifact for the first benchmark seed. The full chart is sized around 58×2×10, while v1 scores 55 tests and defers Weighted C2B plus the 2 hybrid Open tests. **Implementation rule:** extract tests/thresholds from the PDF into generic WODsmith benchmark rows; do **not** build any HillerFit-branded page, route, tab, stats page, product navigation item, marketing surface, logo, call to action, theme treatment, or customer-facing product area. If PDF extraction reveals missing or ambiguous threshold data, ask the owner about the data gap rather than inventing a branded product fork.

---

## 13. Risks & edge cases

1. **One-score-per-(event,user,division) vs retests.** The unique index `idx_scores_competition_user_unique` (`scores.ts:126`) forces a single live row. **v1:** a retest is gated by **keep-best-on-write** — it overwrites that row only when the new tier/raw is better, so the live row is **best-to-date**, not the latest (no history; an `invalid` action reverts the test to tier-0 until resubmit). **v2:** retests are handled by `score_attempts` + `promoteBest` + invalidation-restore, **not** by relaxing the index (which would ripple into the upsert and the leaderboard dedupe). `promoteBest` must reproduce the leaderboard's authoritative ordering, which recomputes `sortKey` at `:1093` from **round-level data** (`cappedRoundCount`/`scoreRoundsTable.status`) a flat snapshot lacks — so `score_attempts` must snapshot `cappedRoundCount`, and for hybrid tests `promoteBest` must order by snapshot `tier` (non-monotonic raw) (§7.1).

2. **Untested tests = tier 0 drag the Overall.** Intentional per spec — the denominator is the battery test count, not submitted count. **Invariant to protect:** the competition's events tagged `benchmarkTestId` must exactly mirror the battery's `benchmark_tests` rows, or the denominator and the actual tier sum disagree. **Also protect threshold completeness:** every test must have all 10 thresholds **for each variant** — a test missing its female thresholds silently scores every woman 0 on it, dragging Overall. Add a **publish-time completeness check** (test-count parity AND `10 × each variant × each test` thresholds present).

3. **Thresholds must be PRE-ENCODED, and fit `int`.** A seeder/editor that inserts raw lbs/seconds produces wildly wrong tiers with no error — every value must run through `encodeScore` with the test's scheme. **Test:** Strict Press M T1 = 115 lb → 52163 g; a 116 lb score yields tier ≥ 1. **Width verified:** the largest encoded HillerFit value is a 10K run in mm (10,000,000) — far below `INT_MAX` (2,147,483,647) — so `thresholdValue` is `int`, matching `scores.scoreValue (int)`; **no `bigint`, no need to alter the shared scores table** (§5.3).

4. **Hybrid Open scoring (v2).** Store rep thresholds and time thresholds in **two separate arrays** (never one mixed array — that was the earlier bug source); the tier function switches scheme + direction at `hybridFlipTier`. Before shipping, **trace the `cap` (didn't finish) vs `scored` (finished) status writer** for time-with-cap events against `timeCap` and confirm it is set reliably (Open 16.2 yields either outcome). Best-attempt selection is **non-monotonic** — promote by computed `tier`, not raw value (§7.1). Open 18.4 fixture required.

5. **Variant must be decoupled from `scalingLevelId` (#3a).** `scalingLevelId` is dual-used as `divisionId` across leaderboard grouping/dedupe/publish/upsert (`competition-leaderboard.ts:1036–:1088`, `scores.ts:126`). Encoding M/F there would **drop** scores (variant level ≠ the registration's Open division → `scoresMissingRegistration++` at `:1043`) or **split** the unified board into per-sex groups. Resolution: write `scalingLevelId` = the single **"Open" division** and snapshot the sex on the new `scores.benchmarkVariant` column. The profile gate (require M/F `user.gender`) + the fail-closed variant guard (§6.2) remove the null-variant path (§5.1, §8.1, §12.11).

6. **Team divisions vs individual benchmarks.** `submitVideoFn` requires a score only on `videoIndex 0` and stores **one captain-owned score** per team event — per-athlete tiers are impossible for teams. **Batteries must be individual-only (`teamSize 1`)**; enforce at battery creation.

7. **Video-required rule + `isOpenJoin` abuse surface.** Video URL requirement is per-battery `videoPolicy` (`never`/`for_top_scores`/`always`, #17); a score is required on `videoIndex 0`. The `isOpenJoin` lazy-register must run **before** the score insert, set `scalingLevelId` = the **Open division** level (not a sex level, #3a), AND pass the **abuse guards** — reject unless published+visible, profile-complete + waiver signed; create the individual team transactionally; idempotent registration upsert; rate-limited (#16, §8.1). Without the guards it is a spam/private-board/duplicate-registration path; without the division context the upsert keyed on `(competitionEventId, userId, scalingLevelId)` is ambiguous (§13.5).

8. **Verification staleness on retest.** Re-submit does **not** reset a prior `"verified"` status today (`video-submission-fns.ts:949/1143`). The M3 fix (reset to `null`/`pending` on changed value) is required or organizers trust wrong data.

9. **Multiplier rounding swallows 0.5.** `pointsMultiplier` `Math.round`s (the multiplier is set at `:1153`; rounding happens where points are assigned). Forced to 1 for `absolute_tier` — verify the gate is applied at both the multiplier and the points assignment (§6.5).

10. **No server cache + perpetual board.** A viral gym battery recomputes `O(events×regs×scores)` per request (and the new category pass adds another `O(entries×events)` loop). **"Acceptable for v1" is currently unmeasured** — capture a p95 at a representative size before opening a public board and set the threshold that triggers materialization (§7.3).

11. **`penaltyPercentage` is metadata only** (`competition-leaderboard.ts` — selected/passed through at `:236`/`:1287`, never multiplied into value/points). For batteries, organizers must bake any penalty into the adjusted **raw value** during `adjust`. Document for reviewers.

12. **Two dispatch switches + a label fn.** `calculateEventPoints` (`:182`) and `calculatePointsForPlace` (`:660`) both have `never` exhaustiveness checks — add the case to **both** or the type-check fails. `getScoringAlgorithmName` (`:669`) has **no** `never` guard and silently returns `undefined` if not updated (UI label bug).

13. **DB status enum is narrower than the engine status.** `scores.status` ∈ `{scored, cap, dq, withdrawn}` (`scores.ts:33`) — no `dns`/`dnf`; `mapScoreStatus` (`:300`) maps `dq → dnf`. The `absolute_tier` tier-0 branch keys on the **engine** status, so it must treat `dns`, `withdrawn`, **and `dnf`** (which is where DB `dq` lands) as tier 0 (§6.1).

### Added in revision 2 (verified against the codebase)

14. **Overall must NOT be double-scaled (#1 — the headline bug).** Category scores are already 0..`scoreMax`; Overall is their weighted mean with **no** further `÷ maxTier × scoreMax`. The earlier draft's extra rescale produced **700/1000**. Pin with a test: all tiers 7 ⇒ Overall **70** (§6.4).

15. **Variant snapshot, not live gender (#24).** Reading `user.gender` live at render (no server cache, `:393`) re-tiers every prior score when an athlete changes their profile. Variant is snapshotted to `scores.benchmarkVariant` at submit; profile changes affect future submissions only (§8.1).

16. **Missing variant fails closed, never defaults to male (#3b).** The earlier `(s.variant ?? "male")` silently scored a variant-less athlete against the male table. `requireVariant` throws `BenchmarkConfigError` instead; a null variant is an invariant violation (§6.2).

17. **Tiebreak must be tier-histogram, not field-relative countback (#5).** Synthesized per-event ranks are field-relative, so `applyCountback` (`tiebreakers.ts:213–276`) would rank Tier-7-on-a-weak-event above Tier-9-on-a-strong-event. Use the tier-histogram tiebreaker fed by `eventResult.tier` (§6.5).

18. **Preload to avoid N+1 / O(n²) (#13).** Build a score-id/user-id to `scores.benchmarkVariant` lookup and `loadAllBenchmarkThresholds(trackWorkoutIds)` **once** before the per-event loop; never `filteredRegistrations.find(...)` per score or query thresholds per event/division (§6.2, §3.3).

19. **Benchmark results must be public on submission, not publish-gated (#15).** The `optInResultPublishing` capability (online-only, `:440–443`) hides every (event,division) until published — for a 55-test v1 perpetual board that is an empty board. Benchmark does NOT declare it, so the default is `undefined` and the `:1082` filter is skipped (§7.4).

20. **`UNIQUE(teamId, slug)` does not enforce global slug uniqueness (#21).** MySQL treats each NULL as distinct, so multiple global (`teamId IS NULL`) batteries could share a public slug. Use the non-null `ownerKey` sentinel (`COALESCE(teamId,'__global__')`) + app-level validation (§5.3).

21. **Missing tier table → hard error, never silent tier 0 (#22).** A test missing a variant's thresholds throws `BenchmarkConfigError` at score time (caught → "unavailable" cell, excluded from the denominator, logged) — not a silent 0 that reads as athlete failure. The publish-time completeness check (item 2) is the first defence (§6.1).

22. **Dispatch seam must be widened, not faked (#4).** `calculateEventPoints(eventId, scores, scheme, config)` carries no `scoreType`/threshold tables; pass a preloaded `ctx:{scoreType, tableByEventId}` rather than querying inside the dispatch or overloading `config` (§6.2).

23. **`ScoringConfig` is a flat object — guard it (#11).** `{algorithm:"absolute_tier"}` with no `absoluteTier.batteryId` parses clean then crashes at `loadBattery`. The `superRefine` (§5.2) makes `batteryId` required and forbids a stale `absoluteTier` on other algorithms.

24. **Categories JSON is scoring-critical — fail closed (#10).** It drives the denominator + weights; a malformed/`null` blob corrupts scores like a bad threshold table. Strict Zod on write/publish/read; `loadBattery` throws rather than returning `null` (§5.1).

25. **`testCount` drift (#9).** The categories-JSON `testCount` is a validated cache, not the authority — the denominator is derived from `count(active includedInScoring tests)`. Publish-time check asserts JSON `testCount` === active-test count === tagged-trackWorkout count, fail-closed (§6.4, item 2).

26. **Weighted C2B is the one knowingly-unfair scored cell (#14).** If shipped in v1 with the representative constant, a 220 lb and a 150 lb athlete doing bodyweight C2B score identically on a public board. Recommended **deferred** to v2 (§2.5, §12.8 Option C); if shipped, capture bodyweight for the v2 backfill.

27. **Half-tier 0.5 must survive every points seam (#12).** Not only the multiplier (`:1180`): also the `:1327` missing-points `Math.round` (safe only because `calculatePointsForPlace → 0`) and `formatPoints` display (no `Math.round`/`toFixed(0)`). Audit + test (§6.5).

---

*End of guide.*
