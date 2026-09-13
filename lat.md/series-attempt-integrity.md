---
lat:
  require-code-mention: true
---
# Series Attempts and Guest Waivers

Series rankings select each athlete's best eligible attempt per shared workout and series division. Waiver reminders recognize accepted guest proof on the same invitation without changing invitation or signature lifecycles.

## Best performance across competitions

Repeated appearances in separate competitions contribute one best result per shared workout and series division. Score query order cannot change the result, and individual and team divisions remain separate entries.

## Ties and score direction

Selection and event ranking reuse the shared sort-key rules for score direction, status, secondary reps and tiebreaks. Equal performance keeps equal ranks; score ID breaks only the selection tie, never the sporting tie.

## Exact registration eligibility

An attempt must match the athlete's active registration in the event's competition and exact division. Active registration elsewhere cannot admit removed or mismatched attempts into the series leaderboard.

## Cap ordering and missing results

Current round-cap counts are loaded in one batch and used to recompute sort keys, so fewer capped rounds beat faster totals with more caps. Missing scored values stay absent, while athletes without scores retain the existing no-result treatment.

## Accepted guest pre-signatures

A valid pre-signature on the same unclaimed, guest-accepted invitation satisfies the corresponding required athlete waiver for broadcast filtering. Registered users continue to use user signatures. Preview and send share the same filter.

## Missing proof remains unsigned

Malformed metadata, missing names or timestamps, another waiver or invitation, and pending/cancelled/claimed invitations do not prove signature. One guest's evidence cannot satisfy another person's requirement.

## Reminder access and waiver scope

Broadcast previews continue to require authentication and organizer permission. Selected waivers must still be required athlete waivers in the same competition before any signature matching occurs.
