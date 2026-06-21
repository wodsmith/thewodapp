# Benchmark Leaderboard Assumptions And Decisions

This file records what implementers should treat as settled, what still requires owner input, and what is intentionally deferred.

## Accepted Decisions

- Use distinct `competitionType: "benchmark"`.
- Reuse current competition infrastructure through capabilities instead of overloading `online`.
- Extend the existing registry in `apps/wodsmith-start/src/lib/competitions/capabilities.ts`; do not create a parallel registry or rebuild M0 from scratch.
- Represent sex as a per-score variant snapshot from required `user.gender`.
- Keep every benchmark board in one Open division for v1.
- Use `absolute_tier` as a new scoring algorithm.
- Store tier thresholds in real tables, pre-encoded in engine units.
- Derive direction from `scheme` + `scoreType`; do not add a `direction` column.
- Compute v1 as best-to-date from the live `scores` row with keep-best-on-write.
- Do not declare `optInResultPublishing` for benchmark.
- Defer Weighted C2B, Open 16.2, and Open 18.4 from v1 scoring.
- Use `/Users/zacjones/Downloads/HillerFit_Training_Guide.pdf` as the source artifact for the first benchmark seed.
- Do not build HillerFit-branded pages, routes, marketing surfaces, logos, or theme treatments.
- The first seed sets `videoPolicy: "never"` and `isOpenJoin: true`; M3 must enforce the guarded open-join checks before athlete writes.

## Source Data Check

Before completing the first seed, extract tests, categories, units, and thresholds from the local training PDF and record assumptions. If the PDF is ambiguous or incomplete, ask the owner about the data gap. Do not solve ambiguity by creating branded product surfaces.

## Deferred Decisions

- Whether v2 history stores every attempt before or after organizer adjustment.
- Whether Weighted C2B v2 captures athlete bodyweight at submit or remains representative-bodyweight based.
- Which materialization threshold should trigger cached windowed leaderboards.
- Whether stats pages are public by default with privacy toggle or private by default if product feedback changes.

## Rejected Alternatives

- Reusing `competitionType: "online"` for benchmark.
- HillerFit-branded pages or product navigation.
- Requiring videos for every v1 benchmark seed submission before the scoring concept is validated.
- Men/Women divisions for v1.
- `settings` JSON for all tier thresholds.
- A fourth category table in v1.
- Calling overwrite-in-place all-time history.
- Field-relative countback for absolute-tier ties.
- Silent tier 0 for missing threshold tables or missing variants.

## User Decision Needed

Only source-data ambiguity in the training PDF should block the first seed. All other v1 choices above are implementation assumptions unless the owner explicitly reopens them.
