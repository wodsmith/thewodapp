# Admin Training Seed

The additive training seed fills missing published days on an administrator's team default track. It preserves existing programming and creates no athlete sessions or scores.

`apps/wodsmith-start/scripts/seed-admin-training.ts` previews by default; `--apply` writes to the explicitly configured `DATABASE_URL`. The default range is September 12 through November 11, 2026, with `--start` and `--days` overrides.

The target is resolved by email and current owner/admin membership. `--team-id` selects a specific managed gym or personal workspace. With no existing default, the seed creates a private team-owned Everyday Training track. Existing defaults must remain eligible.

## Dry-run safety

Previewing a seed reports the target, track, dates, and proposed counts without creating a track, updating a default, or inserting any sessions.

## Existing programming and retries

Occupied dates retain their complete draft and publication state. Running the same seed twice creates no duplicates and never replaces a coach's work.

## Default creation

A team without a default receives a private team-owned track only on explicit application. Published canonical workouts include warm-up and cool-down blocks, with separate rest days.

## Source and target boundaries

Missing or ambiguous managed teams and inaccessible or competition defaults fail before writes. The seed never selects another team's private track or authorizes an outsider by knowing a team ID.
