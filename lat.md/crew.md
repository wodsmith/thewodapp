# Crew

Crew is a concierge-first event operations surface that reuses normal WODsmith competitions while adding thin Crew-specific setup, import, and assignment confirmation records.

## Event Setup Dashboard

Crew event setup pages let an operator create and review a normal competition with one `crew_event_settings` row for lifecycle, source platform URLs, concierge status, crew plan, setup checklist progress, assumptions, and internal handoff notes.

Additional setup dashboard state is stored in the existing `crew_event_settings.settings` JSON text field until a later slice proves that dedicated typed columns or tables are needed.

## Pilot Readiness Checklist

Crew pilot readiness is a read-only operator surface for deciding whether a founding organizer event is ready for handoff.

[[apps/crew/src/routes/events/$eventId/readiness.tsx]] renders the per-event checklist. [[apps/crew/src/server-fns/crew-readiness-fns.ts]] aggregates existing event, setup, venue, workout, heat, import, roster, shift, confirmation, and judge-publishing counts without creating schema or mutating event data. [[apps/crew/src/lib/crew/readiness.ts]] owns deterministic status, severity, progress, and summary derivation for the checklist.

The checklist treats event basics, venues and lanes, workouts and heats, volunteer roster, shifts and assignments, judge publishing, and assignment confirmations as separate readiness categories. Judge publishing is a manual pilot checkpoint until the dedicated Crew judge rotation workflow exists.

## Staffing Matrix Core

Crew staffing matrix core is a pure data-shape layer for deriving event staffing coverage from existing Crew primitives.

[[apps/crew/src/lib/crew/staffing/index.ts]] exports deterministic helpers that normalize venues, workouts, heats, athlete lane assignments, volunteer roster records, time-based shifts, shift assignments, judge heat assignments, and assignment confirmation status into staffing matrix output. The core reports filled and needed counts by role and time block, judge lane gaps, double-booked volunteers, outside-availability assignments, role and credential warnings, confirmation gaps, open capacity, and event-level summary counts.

The matrix core is read-only. It does not create shifts, assign volunteers, publish judge rotations, send reminders, mutate imports, or add Crew schema.

## Staffing Page Gap Report

Crew staffing pages expose the matrix core as a read-only event operations report.

[[apps/crew/src/server-fns/crew-staffing-fns.ts]] exposes a lightweight route-safe server-function wrapper.

[[apps/crew/src/server-fns/crew-staffing-fns.server.ts]] hydrates the matrix from existing event, venue, heat, lane, roster, shift, active judge assignment, and confirmation data.

[[apps/crew/src/routes/events/$eventId/staffing.tsx]] renders coverage, open capacity, judge lane gaps, conflicts, availability warnings, role warnings, confirmation gaps, and source counts without mutating schema or assignments.

[[apps/crew/src/lib/crew/staffing/report.ts]] owns the deterministic event-level status and report summaries used by the page.

## Staffing Calculator

The public Crew calculator route estimates event-day staffing needs from event dimensions and editable role assumptions.

It is deterministic planning math only; it does not create rosters, shifts, assignments, invitations, imports, or persisted setup state.

### Inputs and Role Assumptions

Calculator inputs model the minimum event dimensions operators need before scheduling.

Those dimensions are lanes per floor, floor count, heat count, heat duration, shift length, and role assumptions. Role assumptions are grouped as judges or volunteers and use one of four bases: whole event, floor, lane, or lane per floor.

### Default Assumptions

Default assumptions seed the UI with lane judges, floor leads, score runners, equipment reset, athlete control, and check-in coverage. They are UI defaults only and must not be treated as saved event configuration.

### Role Basis

Lane-per-floor roles scale by `lanes * floors`; floor roles scale by floor count; lane roles scale by lane count; event roles scale once for the whole workout block.

### Shift Coverage

Shift coverage is estimated from `concurrent people * event minutes`, then rounded up by shift length to produce shift slots. The result is a coverage estimate, not a staffed shift board.

### Staffing Groups

Judge and volunteer totals stay separated in the estimate while also rolling up to a total concurrent headcount and total shift-slot count.

### Input Normalization

Calculator inputs are normalized before rendering and calculation: counts are whole numbers with a minimum of one, shift length has a quarter-hour minimum, and role multipliers cannot go below zero.

### Duration Display

Operator-facing durations render in compact hour/minute labels so workout block and shift length summaries stay scannable.

## Import CSV Preview

Crew import preview is a private operator workflow for CSV-only volunteer and heat schedule uploads.

[[apps/crew/src/routes/events/$eventId/imports.tsx]] renders upload, mapping, warnings, and history. [[apps/crew/src/routes/api/crew/import.ts]] accepts private preview uploads, while [[apps/crew/src/lib/crew/imports/preview.ts]] and [[apps/crew/src/server/crew-imports.ts]] parse and persist previews without applying rows.

### Private Upload Route

The Crew import upload route is `/api/crew/import`. It is separate from the existing public file upload path and does not write uploaded files to public object storage.

### Parser Warnings

CSV preview reports file-level errors, malformed rows, missing required fields, duplicate volunteer emails, unknown roles, unknown divisions, unknown workouts, and unknown existing heat references before any apply step exists.

### Preview Records

Preview persistence stores import metadata, headers, column mapping, summary counts, raw row payloads, normalized row payloads, planned actions, warnings, and errors in the Crew import tables.

### No Apply

This slice is preview and history only. Applying volunteer invitations, volunteer memberships, heat schedule rows, roster rows, shifts, and assignment confirmations belongs to later Crew import PRs.

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

## Assignment Confirmation Responses

Crew assignment confirmation links are token-only volunteer surfaces. Raw tokens are generated only while creating links, stored only as hashes, and used by [[apps/crew/src/routes/e/$slug/confirm/$token.tsx]] and [[apps/crew/src/routes/e/$slug/schedule/$token.tsx]] to show safe confirm, decline, and change-request flows without requiring a session.

[[apps/crew/src/server-fns/crew-confirmation-fns.ts]] owns token lookup, transient email payload construction, and deterministic response transitions. [[apps/crew/src/lib/crew/assignment-confirmations.ts]] keeps the pure token and status helpers testable outside the server function layer.
