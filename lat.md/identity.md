---
lat:
  require-code-mention: true
---
# Competition Identity Boundary

The application identity boundary translates legacy storage aliases into a validated competition topology before domain code can rely on them.

The additive boundary is implemented in `@repo/wodsmith-application/identity`. It does not rename tables or change writes. Callers provide a legacy snapshot through one reader, then receive canonical values or a typed corruption result.

`Organization`, `PersonalWorkspace`, `Competition`, `CompetitionEvent`, `CompetitionDivision`, `Registration`, and `Squad` have distinct branded identities. The existing `trwk_*` value is the canonical event ID; `cevt_*` identifies only legacy window configuration.

The topology resolver proves organization and synthetic access-team relationships, event ownership through programming tracks, division ownership through the selected scaling group, registration ownership, and squad metadata/roster consistency.

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

### Rejects foreign divisions

A registration or division configuration can only reference a scaling level from the competition's selected scaling group.

### Preserves independent multi-division participation

Two registrations for one athlete in separate competition divisions remain distinct domain entries instead of collapsing into shared competition membership.

### Retains access while another registration is active

Removing one registration does not remove derived participant access while another registration for the athlete remains active in the competition.

### Restores removed squads without active captains

A removed squad registration remains loadable after removal deactivates its roster; only active squad registrations require an active captain.

### Rejects a reader snapshot for another competition

The store rejects a valid legacy snapshot when its competition identity differs from the identity requested by the caller.
