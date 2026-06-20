# Benchmark Leaderboard Traceability

This matrix links implementation artifacts back to the guide and the required test surface.

| Contract | Guide Source | Implementation Artifact | Tests |
| --- | --- | --- | --- |
| Distinct benchmark competition type | Guide §0 D-A, §5.2, §10 M0a/M1 | `requirements.md`, `technical-design.md`, `tasks.md` M0a/M1 | Extend current registry, capability truth table, chokepoint characterization |
| Variant snapshot, not division | Guide §5.1, §8.1, §13.5 | `requirements.md`, `technical-design.md` data/write flow, `tasks.md` M3 | Submission integration, leaderboard variant read, missing variant fail-closed |
| Best-to-date v1 | Guide §7, §8.1, §10 M3 | `requirements.md`, `technical-design.md` write flow, `tasks.md` M3 | Keep-best-on-write, worse/equal retest ignored |
| No publish gate for benchmark | Guide §5.2, §7.4, §13.19 | `requirements.md`, `technical-design.md` failure behavior, `tasks.md` M4 | Public visibility without `divisionResults`, invalid rows excluded |
| 55-test training-guide Lite denominator | Guide §2.1, §9, §10 M1 | `requirements.md`, `technical-design.md` data model, `tasks.md` M1/M2 | PDF-derived seed validation, derived denominator, deferred tests excluded |
| Absolute tier scoring | Guide §6.1-§6.5, §10 M2 | `technical-design.md`, `tasks.md` M2 | Tier, direction, half-tier, tiebreak, aggregation unit tests |
| Stats page | Guide §8.3, §10 M4 | `requirements.md`, `technical-design.md`, `tasks.md` M4 | Route/component tests and manual QA |
| V2 boundary | Guide §7, §10 V2 | `requirements.md`, `tasks.md` V2, `assumptions-and-decisions.md` | Migration check excludes `score_attempts` |
| No HillerFit-branded pages | Guide §0 D-D, §12.12 | `requirements.md`, `technical-design.md`, `assumptions-and-decisions.md` | Route/component assertions and manual QA |
| PDF source data | Guide §0 D-D, §12.12 | `requirements.md`, `tasks.md` M1, `test-strategy.md` | Extraction receipt and seed validation |
