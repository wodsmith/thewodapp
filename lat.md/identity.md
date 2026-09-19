---
lat:
  require-code-mention: true
---
# Competition Identity Boundary

The application identity boundary translates legacy storage aliases into a validated competition topology before domain code can rely on them.

The additive boundary is implemented in `@repo/wodsmith-application/identity`. It does not rename tables or change writes. Callers provide a legacy snapshot through one reader, then receive canonical values or a typed corruption result.

`Organization`, `PersonalWorkspace`, `Competition`, `CompetitionEvent`, `CompetitionDivision`, `Registration`, and `Squad` have distinct branded identities. Event occurrence IDs retain their stored `trwk_*` or seeded `tw_*` values; `cevt_*` identifies only legacy window configuration.

The topology resolver proves organization and synthetic access-team relationships, event ownership through programming tracks, named division ownership through the selected scaling group, registration ownership, and squad roster consistency.

The compiler contract keeps context-owned IDs non-assignable. Runtime decoders reject incorrect prefixes at the legacy boundary, and domain maps require branded keys.

Two P0 fixtures remain outside this pure boundary: event dependency deletion requires a real database fixture, and competition creation atomicity requires fault injection around the current creation transaction. Those must be green before either lifecycle is migrated.

## Canonical identifiers

Canonical IDs name domain concepts rather than storage rows, preventing event-window configuration and event occurrence identities from being interchanged.

### Distinguishes event occurrences from window configuration

The boundary accepts `trwk_*` as `CompetitionEventId`, accepts `cevt_*` only as a legacy configuration ID, and rejects either value in the other's position.

### Normalizes both personal workspace forms

The legacy adapter maps runtime `type=gym` personal rows and seeded `type=personal` rows to the same `PersonalWorkspace` concept when both have an owner and no parent.

### Publishes the identity package subpath

Consumers resolve the boundary through `@repo/wodsmith-application/identity`; package-resolution tests prevent documentation and the export map from drifting apart.

## Topology invariants

Topology validation rejects cross-context joins before projections or command handlers can treat corrupt storage relationships as domain authority.

### Rejects cross-competition event configuration

A submission-window configuration must name the same competition as the programming track that owns its event occurrence.

### Rejects duplicate event identities

Two decoded event rows cannot claim the same occurrence identity; the boundary reports typed corruption instead of allowing map insertion order to choose authority.

### Classifies missing parent topology

A child naming an absent parent reports a missing event, while a present parent whose programming track is absent reports a missing track before competition ownership is compared.

### Rejects foreign divisions

A registration or division configuration can only reference a scaling level from the competition's selected scaling group.

### Preserves independent multi-division participation

Two registrations for one athlete in separate competition divisions remain distinct domain entries instead of collapsing into shared competition membership.

### Rejects duplicate registration identities

Two registration rows cannot claim the same identity; the boundary reports typed corruption before the duplicate can contribute participants or replace the authoritative registration value.

### Retains access while another registration is active

Removing one registration does not remove derived participant access while another registration for the athlete remains active in the competition.

### Restores removed squads without active captains

A removed squad registration remains loadable after removal deactivates its roster; only active squad registrations require an active captain.

### Rejects a reader snapshot for another competition

The store rejects a valid legacy snapshot when its competition identity differs from the identity requested by the caller.

## Legacy producer compatibility

The boundary translates supported database producer shapes into explicit domain values without changing persisted rows or inventing missing registrations.

### Loads competitions before division selection

A newly created competition can have no selected scaling group, divisions, events, or registrations. A null selected group produces no named divisions and never adopts unrelated scaling levels.

### Preserves open registration scope

Null registration division IDs become `division: { kind: "open" }`; named selections carry a validated branded division ID. Open entries remain distinct from named divisions and do not create a synthetic scaling level.

Open participation uses the persisted athlete or squad reference. Without a named division there is no team-size constraint to infer; named division participation modes remain checked.

### Loads active runtime squads

Runtime registration creates one squad registration and captain membership; accepted teammates add active members. Active roster members receive participant access and the declared captain must be present.

### Reconciles transferred squad divisions

Registration division selection is authoritative because existing transfers leave squad metadata unchanged. Supplied metadata still validates competition ownership and identifier shape, but its obsolete division cannot override registrations.

### Normalizes demo squad registrations

Demo squads may lack metadata, use member roles for every athlete, and store one registration per member. Their parent access team proves competition ownership and shared `captainUserId` supplies captain identity.

All member registrations remain distinct and resolve to one squad independent of row order. The canonical roster promotes the declared captain. Older reader projections may omit `captainUserId`; their registration owner must then have captain membership.

### Rejects conflicting squad authority

Registrations sharing a squad must agree on division selection and captain identity. Contradictory rows, malformed supplied metadata, foreign competition metadata, or a missing active captain yield typed corruption instead of guessing.

### Accepts persisted seed identifier aliases

The legacy boundary accepts the persisted `track_*` and `tw_*` prefixes alongside generated `ptrk_*` and `trwk_*` values. Branding preserves stored identity in windows and parent links without renaming IDs or allowing `cevt_*` event occurrences.

Public generated-ID decoders retain strict prefixes; alias acceptance lives only in the legacy adapter. Fixtures use the actual `track_online_qualifier_2026` and `tw_online_event1` IDs from both applications' seed producers.
