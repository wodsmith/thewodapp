# CrossFit Open Scorecard Template Research

This note summarizes five years of official CrossFit Open workout packets and translates the patterns into a WODsmith-branded downloadable scorecard concept.

## Scope

The analysis covers the 2022-2026 CrossFit Open, weeks 1-3 each year, using the official Games workout pages and linked scorecard PDFs.

Primary source pages:

- 2026 Open workouts: https://games.crossfit.com/workouts/open/2026
- 2025 Open workouts: https://games.crossfit.com/workouts/open/2025
- 2024 Open workouts: https://games.crossfit.com/workouts/open/2024
- 2023 Open workouts: https://games.crossfit.com/workouts/open/2023
- 2022 Open workouts: https://games.crossfit.com/workouts/open/2022

The repeatable source fetcher lives at `scripts/research/crossfit-open-scorecards.mjs`.

## Observed Patterns

Official Open packets consistently separate the downloadable into two jobs: a workout details section for briefing and standards, and a final scorecard page for floor use.

- Packet shape: header with week/date window, workout prescription, division variations, quick start, notes, tiebreaks, equipment, movement standards, then an athlete/judge copy.
- Scorecard fields: workout location, date, athlete name, judge name, judge signature, athlete signature, Rx/Scaled selection, final score field, and sometimes judge-course confirmation.
- Score rows: each meaningful checkpoint has a cumulative rep count, and tiebreak checkpoints are labeled inline when needed.
- Variations: Rx, scaled, teen, masters, and foundations/adaptive variants are usually present, but the floor scorecard keeps the main usable scoring path visually dominant.
- Movement standards: requirements and common no-reps are kept outside the score rows, which protects the scorecard from becoming too dense during judging.

## Five-Year Workout Mix

The last five Opens lean heavily on scorecards that must handle several scoring shapes.

- For-time with cap: 2026 26.1, 26.2, 26.3; 2025 25.2, 25.3; 2024 24.1, 24.3; 2022 22.2, 22.3.
- AMRAP / rounds-reps: 2025 25.1, 2024 24.2, 2023 23.1, 2022 22.1.
- Multi-part scoring: 2023 23.2 combines an AMRAP part with a max-load thruster part.
- Common equipment families: dumbbell, barbell, rower, box, jump rope, pull-up bar/rings, wall-ball target, and floor tape or lane markings.
- Common scoring complications: time caps, cumulative rep checkpoints, tiebreak times, progressive loading, round ladders, and distance sections counted as reps.

## Recommended Downloadable

Create a two-page printable named "WODsmith Open-Style Score Kit" with a clean black/white base, one WODsmith accent color, and enough whitespace for clipboard use.

Page 1 should be the workout details sheet:

- Header: WODsmith mark, workout title, event/heat, date, location, division, workout version.
- Workout prescription: large readable block for the workout and cap/AMRAP duration.
- Variation table: Rx, scaled, masters/teen/foundations columns with load, height, movement, and equipment differences.
- Setup checklist: equipment, lane/floor plan, measurement notes, camera/video notes, safety constraints.
- Standards digest: movement, rep credited when, top no-reps. Keep this to one compact row per movement.
- Briefing notes: tiebreak rule, score-entry rule, special constraints, and judge reminders.

Page 2 should be the scorecard:

- Identity strip: athlete, judge, division, version, heat/lane, location, date.
- Final result block: score type selector with fields for time, reps at cap, rounds+reps, load, and tiebreak.
- Score grid: configurable rows with movement label, reps/distance/load, cumulative score, split/tiebreak, judge initials, and no-rep tally.
- Signature strip: judge confirmation, athlete confirmation, judge signature, athlete signature.
- Athlete copy area: a tear-off or lower duplicate containing final score, tiebreak, and notes.

## Template Rules

The template should be flexible enough for WODsmith workouts, not only CrossFit Open replicas.

- Support 3-15 score rows without redesigning the sheet.
- Treat tiebreak as optional per row, not a separate fixed section.
- Include cumulative-score cells by default because Open scorecards repeatedly use cumulative reps to reduce arithmetic errors.
- Include distance/load modifiers in the row model because lunges, shuttle runs, progressive barbells, and dumbbells recur.
- Keep movement standards on the details page so the scorecard page remains fast to use under fatigue.
- Reserve an optional QR/short link slot for WODsmith score entry or event instructions.

## Suggested Data Model

A printable generator can render both pages from one structured workout definition.

```ts
type PrintableScoreKit = {
  title: string
  scoreType: "time" | "time-with-cap" | "rounds-reps" | "reps" | "load"
  timeCapMinutes?: number
  divisions: Array<{
    name: string
    version: "rx" | "scaled" | "foundations" | string
    equipment: string[]
    variations: string[]
  }>
  rows: Array<{
    label: string
    reps?: number
    distance?: string
    load?: string
    cumulative?: number
    tiebreakAfter?: boolean
  }>
  standards: Array<{
    movement: string
    creditedWhen: string
    commonNoReps: string[]
  }>
}
```

## Design Direction

The WODsmith version should feel more like a competition operations tool than a sponsor-heavy Games packet.

- Use a strong top rule and compact metadata fields instead of large decorative banners.
- Use high-contrast row bands and large cumulative numbers for judges.
- Put the final score block in the top-right corner so it is easy to photograph.
- Use monospace numerals for cumulative reps, split times, and loads.
- Add a small "powered by WODsmith" footer, not a marketing block.
