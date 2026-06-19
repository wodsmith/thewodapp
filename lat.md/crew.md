# Crew

Crew is a concierge-first event operations surface that reuses normal WODsmith competitions while adding thin Crew-specific setup, import, and assignment confirmation records.

## Add Thin Crew Tables

Crew-owned database tables live in `@repo/wodsmith-db` so Start and Crew consume one shared schema source. App DB files remain forwarding shims and do not own `mysqlTable` definitions.

The first Crew schema slice adds [[crew#crew_imports]], [[crew#crew_import_rows]], and [[crew#crew_assignment_confirmations]] through the shared DB package.

## crew_imports

One row per uploaded/imported file or pasted data source for a Crew event. It tracks the import kind, source metadata, mapping state, parser version, aggregate warning/error counts, row counts, apply counts, and who applied the import.

IDs use the `cimp_` prefix.

## crew_import_rows

One row per parsed import row. It stores raw and normalized row payloads, the eventual target type and ID, the planned action, and row-level warnings or errors for preview and auditability.

IDs use the `cimpr_` prefix.

## crew_assignment_confirmations

One row per volunteer or judge assignment confirmation. It tracks the assignment target, optional membership or invitation identity, confirmation status, response timing, reminder state, and only a token hash.

Raw confirmation tokens are generated later for links and must not be persisted. IDs use the `caconf_` prefix.
