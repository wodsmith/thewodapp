# Training Backend Review

Review regressions preserve existing workout text and historical definitions while rejecting partially parsed scores and keeping athlete authoring access separate from programming permission.

## Prescription mirrors normalize whitespace

Source and private workout submissions trim surrounding prescription whitespace before comparing their canonical description. Different content still fails the mirror invariant, and internal formatting remains intact.

## Time inputs reject partial parsing

Time, capped time, EMOM, round scores, and time tiebreaks require complete supported syntax. Colon times, decimal seconds, period-separated times, hours, and fractional seconds remain valid; trailing letters and malformed separators fail.

## Result units follow their scheme

Rich result details store weight units for load and distance units for meters or feet. Other schemes record a null unit instead of misleading weight metadata; the original input remains available for editing.

## Blank library prescriptions remain addable

Existing library workouts with blank descriptions import with the explicit label “No prescription provided.” This keeps the canonical nonempty-description contract without inventing training instructions or losing scoring metadata.

## Stored references survive catalog changes

Draft saves validate newly introduced movement and scaling references against the catalog and selected gym. References already stored on the same block remain valid snapshots after catalog deletion, including copies and publication.

Both source draft saves and private composition saves use [[apps/wodsmith-start/src/server/workout-references.ts#validateChangedWorkoutReferences]] to validate only references absent from their previously stored item.

Publication consumes an already-validated stored draft without rechecking catalog availability. Changing a scaling reference or introducing a new block identity requires current access; preserving a historical reference cannot authorize an arbitrary new reference.

## Athlete catalog access stays team scoped

Private workout authors can read catalog movements and their gym or system scaling groups with current training access. This endpoint grants no programming permission, excludes other gyms' scaling groups, and rejects lost membership or entitlement.

## Private references survive composition edits

Private session edits preserve previously validated references on the same owned item when a catalog entry disappears. Reordering or removing other work succeeds, while changed references and new item identities require current catalog access.
