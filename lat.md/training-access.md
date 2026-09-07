# Training Access

Training server boundaries authorize against stored resource ownership and current membership, independently of active-team cookies and client controls.

## Private reads

Public workouts and tracks remain readable. Private resources require active, unexpired membership in their owning team. A public track does not publish its private workout children.

Workout detail, movement associations, remix lineage and counts apply the same visibility predicate. Team-scoped requests validate the supplied team ID before querying private data. Missing owner teams never imply access.

## Owner writes

Track CRUD, visibility and workout membership require manage-programming permission on the stored owner team. Workout creation and remix destinations require create-components; editing requires edit-components on the persisted owner.

The existing current-membership permission guard remains shared with workout import. CrossFit.com retains its site-admin management rule. Public templates can be remixed into authorized destinations without granting permission to edit the source.

Track edit, visibility, add and remove controls use the server-resolved management capability; hiding a control never replaces server authorization.
