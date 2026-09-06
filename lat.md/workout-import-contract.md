# Workout import contract

Shared browser-safe schemas separate incomplete model proposals from validated saves without accepting model ownership or publication authority.

[[apps/wodsmith-start/src/lib/workout-import/schemas.ts]] defines versioned proposals, immutable revision envelopes, targeted questions, source references, and reviewed save inputs. Workout time caps use seconds and separately recorded scores remain distinct from prescription rounds.

## Scoring boundary tests

Contract tests reject missing caps, AMRAP durations encoded as caps, missing aggregation for multiple scores, duplicate movements, and model-supplied ownership or visibility.
