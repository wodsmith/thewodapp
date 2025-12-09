# Scoring Library Reference

Authoritative reference for `@/lib/scoring` (workout score encoding, decoding, parsing, formatting, sorting, aggregation, and validation). All values are encoded for sorting and storage: time in milliseconds, load in grams, distance in millimeters, rounds+reps as `rounds * 100000 + reps`, counts as integers, pass/fail as `1` or `0`.

## Schemes, Statuses, and Constants
- `WORKOUT_SCHEMES`: `time`, `time-with-cap`, `rounds-reps`, `reps`, `emom`, `load`, `calories`, `meters`, `feet`, `points`, `pass-fail`.
- `SCORE_STATUSES`: `scored`, `cap`, `dq`, `withdrawn`; `STATUS_ORDER` maps to 0–3 for sort priority.
- `SCORE_TYPES`: `min`, `max`, `sum`, `average`, `first`, `last`; `DEFAULT_SCORE_TYPES` maps scheme → default type.
- `TIEBREAK_SCHEMES`: `time`, `reps`.
- Units: `WEIGHT_UNITS` (`lbs`, `kg`), `DISTANCE_UNITS` (`m`, `km`, `ft`, `mi`); conversion constants `GRAMS_PER_UNIT`, `MM_PER_UNIT`.
- Encoding helpers: `ROUNDS_REPS_MULTIPLIER = 100000`, `MAX_SCORE_VALUE = 2^60 - 1`, time constants `MS_PER_SECOND`, `MS_PER_MINUTE`, `MS_PER_HOUR`.
- Scheme classifiers: `TIME_BASED_SCHEMES`, `LOAD_BASED_SCHEMES`, `DISTANCE_BASED_SCHEMES`, `COUNT_BASED_SCHEMES` with guards `isTimeBasedScheme`, `isLoadBasedScheme`, `isDistanceBasedScheme`, `isCountBasedScheme`.

## Types
- `Score`: primary score record with `scheme`, `scoreType`, `value` (encoded or `null`), `status`, optional `rounds`, optional `tiebreak`, optional `timeCap`, optional `sortKey`.
- `ScoreRound`: per-round encoded value with optional `schemeOverride`, `status`, `secondaryValue`, `notes`.
- `ScoreInput`, `RoundInput`: raw user inputs (`raw` strings, optional units, optional overrides).
- `ParseOptions`: time precision (`auto` | `seconds` | `ms`), unit overrides, strict flag.
- `ParseResult`: `isValid`, `encoded`, `formatted`, optional `error`, optional `warnings`.
- `FormatOptions`: `compact`, `includeUnit`, `weightUnit`, `distanceUnit`, `showStatus`.
- `EncodeOptions`: `unit` for load/distance.
- `EncodeRoundsResult`: `rounds` (encoded per round), `aggregated` (per `scoreType`).
- `ValidationResult`: `isValid`, `errors`, `warnings`.
- Database: `ScoreRecord`, `ScoreRoundRecord` map to stored schema fields.

## Encoding
- `encodeScore(input, scheme, options?)`: trims input; routes to scheme encoder; returns encoded integer or `null` on invalid/empty.
  - Time schemes: `encodeTime` (MM:SS, HH:MM:SS, optional milliseconds, or raw seconds when no colon).
  - `rounds-reps`: `encodeRoundsReps` (`rounds + reps`, requires non-negative, reps < 100000).
  - Load: `encodeLoad` (defaults `lbs`), uses grams.
  - Distance: `encodeDistance` (defaults `m`, `ft` for `feet` scheme).
  - Count schemes: parses non-negative integer.
  - Pass/fail: accepts `pass/p/1` → 1, `fail/f/0` → 0.
- `encodeRounds(rounds, scheme, scoreType, options?)`: encodes each `RoundInput` (respects per-round unit/scheme override), aggregates via `aggregateValues`.
- `encodeNumericScore(value, scheme, options?)`: encodes already-parsed numbers (time seconds → ms; load/distance with unit; rounds-reps pass-through; counts/pass-fail rounded).
- Time helpers: `encodeTimeFromSeconds`, `encodeTimeFromMs`.
- Rounds+reps helpers: `encodeRoundsRepsFromParts`, `extractRoundsReps`.
- Load helpers: `encodeLoadFromNumber`, `gramsToUnit`.
- Distance helpers: `encodeDistanceFromNumber`, `mmToUnit`.

## Decoding
- `decodeScore(value, scheme, options?)`: returns display string for encoded value; time shows milliseconds only when non-zero; rounds+reps supports `compact`; load/distance apply unit preferences; count schemes optionally append suffix; pass/fail → `Pass`/`Fail`.
- `decodeToNumber(value, scheme, options?)`: returns numeric in requested unit (time → seconds).
- Time helpers: `decodeTime`, `decodeTimeToSeconds`.
- Rounds+reps helpers: `decodeRoundsReps`, `extractRoundsReps`.
- Load helpers: `decodeLoad`, `gramsToUnit`.
- Distance helpers: `decodeDistance`, `mmToUnit`.

## Parsing
- `parseScore(input, scheme, options?)`: trims input; returns `ParseResult` with encoded value and formatted string or error/warnings. Scheme-aware:
  - Time schemes → `parseTime` with smart precision or explicit `seconds`/`ms`.
  - `rounds-reps` → `rounds+reps` format; plain number treated as full rounds, optional warning unless `strict`.
  - Load/distance parse numeric, then encode/decode for formatted string.
  - Count schemes parse non-negative integer.
  - Pass/fail accepts `pass/p/1/yes` and `fail/f/0/no`.
- `parseTime(input, options?)`: smart parsing without colons (`auto` digit folding), supports decimal milliseconds, returns formatted time.
- `validateTimeInput(encodedMs)`: warnings for >24h.
- `parseTiebreak(input, scheme, options?)`: time uses `parseTime`; reps uses count parser.

## Formatting
- `formatScore(score, options?)`: handles special statuses; `showStatus` defaults true; returns decoded value or status text (`N/A` when `value` is `null` and status is `scored`).
- `formatScoreCompact`: `formatScore` with `compact: true`.
- `formatRounds(rounds, scheme, options?)`: per-round display; honors `schemeOverride`; special statuses show status text, include `secondaryValue` when present.
- `formatScoreWithTiebreak(score, options?)`: appends `(TB: ...)` using compact time for time tiebreaks.
- `formatScoreForList(score, options?)`: same as `formatScore`, includes tiebreak when present.
- Status formatting: `formatStatus` (short), `formatStatusFull` (long), `isSpecialStatus`.
- Unit helpers: `getWeightUnitLabel`, `getDistanceUnitLabel`, `convertWeight`, `convertDistance`, `formatNumber` (trims trailing zeros, defaults 0 decimals).

## Sorting and Sort Keys
- Direction helpers: `getSortDirection(scheme, scoreType?)` (defaults from scheme unless `scoreType` forces), `isLowerBetter`, `getDefaultScoreType`.
- Sort key encoding:
  - `computeSortKey(score)`: uses scheme direction; combines `STATUS_ORDER` (bits 62–60) with normalized value (bits 59–0).
  - `computeSortKeyWithDirection(value, status, direction)`: `null` values become `MAX_SCORE_VALUE`.
  - `extractFromSortKey(sortKey, direction)`: returns `statusOrder` and denormalized value (descending is lossy).
  - `statusFromOrder(order)`: maps status order integer back to `ScoreStatus`.
- Comparators:
  - `compareScores(a, b)`: status order, capped secondary value, primary value (directional), then tiebreak (`time` lower-first, `reps` higher-first).
  - `createComparator(scheme, scoreType)`: returns `compareScores`.
  - `sortScores(scores)`: in-place sort using `compareScores`.
  - `findRank(score, allScores)`: 1-indexed position after sorting copy with `compareScores`.

## Aggregation
- `aggregateValues(values, scoreType)`: `min`/`max`/`sum`/`average` (rounded) / `first` / `last`; returns `null` on empty.
- `aggregateWithSummary(values, scoreType)`: returns `{ aggregated, operation, count }`.
- `getDefaultScoreType(scheme)`: scheme → default aggregation.
- `isLowerBetter(scoreType)`: true for `min`.

## Validation
- `validateScoreInput(input)`: checks presence of scheme and value/rounds, parses value and rounds, validates tiebreak, time caps, status membership; returns aggregated `errors`/`warnings`.
- `validateTime(ms)`: negative check, warning over 24h.
- `validateRoundsReps(encoded)`: negative check, reps cap (<100000), warnings for unusually high rounds/reps.
- `validateLoad(grams)`: negative check, warning above ~2000 lbs.
- `validateDistance(mm)`: negative check, warning above marathon distance.
- `isOutlier(value, otherValues)`: returns true when >2 standard deviations from mean (requires at least 3 comparison values).

## Scheme and Status Behavior
- Sort direction defaults: time/time-with-cap → ascending; rounds-reps/reps/emom/load/calories/meters/feet/points/pass-fail → descending.
- Status priority: `scored` before `cap` before `dq` before `withdrawn`; capped scores compare by `secondaryValue` before tiebreak.
- Tiebreak rules: time lower-better; reps higher-better.
