---
lat:
  require-code-mention: true
---
# Training Access Tests

Real MySQL regressions exercise server validators, queries, and permission checks using owner, member, outsider, inactive, expired and anonymous fixtures.

## Movement visibility

Movement associations return only public workouts and workouts owned by current member teams, including when the session has no active team.

## Known workout reads

Known private workout IDs stay hidden from anonymous and unrelated users and from inactive or expired members; public reads remain available.

## Track reads

Private track detail, contents and team lists require membership; public track reads filter private workout children while retaining public content.

## Track writes

Track CRUD, visibility and membership reject outsiders and members without management permission, preserve owner changes, and reject foreign private workout associations.

## Workout writes

Workout creation and editing use stored ownership and current permissions. Authorized writes succeed, while spoofed destinations, private sources and invalid inputs are rejected.

## Remix boundaries

Remix metadata and counts cannot disclose private sources or copies. Public template copying succeeds only into a destination with creation permission.

## Indirect reads

Schedule joins hide inaccessible private workout details; schedule writes require destination management and an available workout. Filter and subscription metadata requests validate supplied team IDs.

## Custom permissions

Custom-role permissions authorize owner-team writes only while the role belongs to that team. Subscription and public visibility never imply management access.

## Source lineage authorization

Listing or counting public remixes requires access to their source workout. Owner reads and public source workflows retain their visible children and counts.

## Legacy schedule metadata

Legacy cross-team schedule rows expose neither occurrence dates nor attached scores after access to the referenced workout is lost; making the source public restores both allowed paths.

## Bounded subscription filtering

Subscription lookups batch current membership filtering, discard stale and foreign team IDs, preserve the public catalog and authorized subscriptions, and reject more than 100 requested IDs.
