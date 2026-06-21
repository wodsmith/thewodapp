---
status: "accepted"
date: 2026-06-21
decision-makers: "WODsmith Crew engineering"
consulted: "Crew Phase 5 source plan"
informed: "WODsmith engineering team"
---

# Strategic moat privacy model

LAT: [[crew#Strategic Moat Privacy Model]]

## Context and Problem Statement

Crew Phase 5 turns the product from one-event operations into a permissioned volunteer memory layer. The strategic value is that organizers can re-invite known volunteers with useful context, run a series-wide crew pool, convert a Crew event into a full WODsmith competition, and eventually request opt-in regional judges without treating people like searchable inventory.

This privacy model must be decided before schema, ingestion, reliability summaries, returning volunteer UI, consent center, series crew pool, conversion assistant, or regional discovery work begins.

## Decision Drivers

* Help same-organizer teams remember factual volunteer history without rebuilding trust from scratch every event
* Allow future cross-organizer discovery only when a volunteer explicitly opts in
* Keep raw contact details and private organizer context out of discovery, analytics, audit previews, and regional summaries
* Preserve volunteer agency through consent versioning, revocation, and clear source tracking
* Keep reliability useful for operations while avoiding ratings, rankings, negative badges, or global reputation
* Keep Phase 5 intelligence, series, conversion, and discovery work behind privacy review and feature flags

## Decision Outcome

Crew will model volunteer memory as scoped, consented, factual event history. Same-organizer returning volunteer history may summarize prior events owned by the same organizing team. Cross-organizer visibility requires explicit volunteer opt-in and stays limited to blind intro-request flows until the volunteer accepts.

Crew will not create public profiles, global volunteer search, star ratings, rankings, top-judge lists, negative badges, or imported-by-default discovery records. Imported volunteers are not regionally discoverable by import alone.

### Identity Matching

Prefer stable `userId` whenever a volunteer has a WODsmith account. For no-password or invitation-only volunteers, match through normalized contact hashes derived from email and phone values already held in existing user, invitation, membership, or communication tables.

Name-only matching is not allowed. Display name, role label, affiliate, shirt size, notes, or emergency contact fields may help a same-organizer human recognize a person, but they must never merge identities automatically.

Hash matching must be scoped to the privacy purpose that needs it. Store only the minimum deterministic hash fields needed for same-organizer return detection or explicit opt-in discovery eligibility. Raw email and phone stay in the existing source tables that already own contact data.

### Consent Model

Consent records for Phase 5 features must capture text/version, source surface, actor, timestamp, scope, and revocation state. Consent cannot be inferred from import, assignment confirmation, email delivery, SMS delivery, roster membership, or prior volunteer participation.

Communication history consent covers organizer-visible delivery facts for the same organizer only, such as sent, bounced, replied, confirmed, declined, change-requested, no-show, or replaced. It does not grant cross-organizer discovery.

Regional discovery consent is separate. A volunteer may opt into receiving intro requests from other organizers and may revoke that consent later. Revocation removes them from future discovery and intro-request eligibility, while preserving audit facts needed to explain past actions.

Intro requests are blind until accepted. The requesting organizer may describe the event, role, dates, and why they are requesting help, but they do not receive raw contact details or private volunteer metadata unless the volunteer accepts.

SMS remains blocked for Phase 5 discovery and communication history until STOP handling, consent logging, carrier requirements, and operational readiness are complete.

Minors are excluded from regional discovery unless a later accepted policy defines guardian consent, data handling, and age-verification boundaries.

### Reliability Model

Reliability summaries are auditable factual event history only. Acceptable facts include event participation, assigned roles, confirmed shifts, completed shifts, no-shows, declines, replacements, response timestamps, credential checks, and organizer-owned attendance outcomes.

Reliability must remain scoped. Same-organizer summaries can help an organizer understand their own prior history with a volunteer. Cross-organizer discovery may use only volunteer-approved, minimal factual indicators needed to route intro requests, and only after privacy review.

Reliability must not become a public score. Crew must not expose ratings, rankings, top-judge lists, negative badges, global reputation, organizer sentiment, private notes, or inferred quality labels.

Internal organizer notes stay scoped to the organizer/team that wrote them. They never leave that organizing team, never feed cross-organizer discovery, and never appear in regional summaries.

### Data Minimization

Raw contact details stay in the existing user, invitation, membership, assignment confirmation, and communication tables that already own them. Phase 5 discovery, search, analytics, and audit previews must not expose raw email, phone, emergency contact, internal notes, or private metadata.

Organizer-facing previews may show masked contact hints only when needed to help the organizer distinguish same-team records they already own. Discovery previews should prefer role, broad region, credential or experience labels, availability intent, and opt-in status over contact data.

Analytics must use aggregate counts and privacy-safe dimensions. Cohorts, conversion rates, invite-response rates, and reliability rollups must avoid small-cell or raw-record exports that let an organizer infer private person-level details outside their scope.

Audit logs must prove consent, matching, intro requests, revocation, and organizer access decisions without becoming a raw-contact export path.

### Organizer Scoping

Same-organizer history can show factual prior event history owned by that organizer or team, including roles, assignments, confirmations, attendance outcomes, and communication delivery facts where consent permits.

Cross-organizer visibility requires explicit volunteer opt-in. Without opt-in, another organizer may not discover the volunteer, infer their contact details, see their prior organizer-specific notes, or view private metadata.

Series crew pools are constrained to the selected `competition_group` and the organizing team that owns it. Series membership does not create regional discovery eligibility and does not allow one organizer to browse another organizer's people.

### Series, Conversion, and Discovery Guardrails

Series crew pools must operate only inside the selected `competition_group`. They can help reuse assignments, availability, and factual event history for events in that group, but they must not create a global pool.

Crew-to-WODsmith conversion enriches an existing competition and related Crew setup. It must not clone volunteer identities, duplicate private notes, or create new discoverable people records. Conversion should preserve source links and audit facts so later WODsmith surfaces know which data came from Crew.

Regional discovery is a blind intro request until the volunteer accepts. Search and recommendation surfaces may help an organizer describe a need, but they must not expose raw contact details, private notes, negative reliability facts, or unaccepted volunteer identities.

### Analytics, Review, and Feature Flags

Each Phase 5 intelligence, series, conversion, or discovery slice must include a privacy review note that explains data sources, person-level fields shown, aggregation thresholds, consent checks, revocation behavior, and audit records.

Feature flags are required for returning volunteer intelligence, communication history summaries, series crew pool behavior, Crew-to-WODsmith conversion assistance, regional discovery, and any analytics surface that includes person-level or small-cohort data.

Rollout should start with same-organizer returning volunteer memory, then consent center and revocation support, then series-scoped reuse, then conversion assistance, and only then opt-in regional discovery. Later slices may not skip the consent and audit prerequisites.

## Non-Goals

This decision does not add schema, migrations, feature flags, routes, server functions, matching code, consent UI, series crew pool implementation, conversion assistant, discovery UI, analytics implementation, production data mutation, deploy work, queue/email/SMS behavior, public profiles, search behavior, or billing changes.

## Consequences

* Good, because Crew can build a durable volunteer memory layer without making volunteers feel like inventory
* Good, because same-organizer memory and cross-organizer discovery have separate consent and visibility boundaries
* Good, because future schema work has clear matching, consent, reliability, minimization, and audit requirements before implementation
* Bad, because discovery and analytics require more review and consent infrastructure before they can ship
* Bad, because no-password volunteers need careful hash-based identity handling before returning-volunteer intelligence can be trusted

## Verification Expectations

Docs-only slices that reference this decision should validate the LAT anchor with `pnpm dlx lat.md locate 'crew#Strategic Moat Privacy Model'` and run `git diff --check`.
