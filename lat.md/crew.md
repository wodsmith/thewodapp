# Crew

Crew is a concierge-first event operations surface that reuses normal WODsmith competitions while adding thin Crew-specific setup, import, and assignment confirmation records.

## Crew Billing Catalog

Crew billing catalog rows live in the existing billing seed and entitlement config surfaces while paid event access remains separate from WODsmith team subscription state.

[[apps/wodsmith-start/scripts/seed/seeders/02-billing.ts]] and [[apps/crew/scripts/seed/seeders/02-billing.ts]] seed Crew plan, feature, and limit catalog rows for launch pricing. The Crew plan IDs are event-level catalog entries and must not be assigned to `teams.currentPlanId` for one-event purchases.

Public launch catalog entries are `crew_starter`, `crew_basic`, and `crew_pro`. Manual/private entries are `crew_concierge` and `crew_founding_2026` so concierge and founder pricing can be granted and audited later without exposing founder pricing publicly.

## Crew Billing State And Audit

Crew event billing is stored on the event settings row and remains separate from WODsmith team subscription state.

[[packages/wodsmith-db/src/schemas/crew-event-settings.ts]] stores event-level billing state, source, Crew catalog plan ID, amount, currency, Stripe references, founder override, credit, and refund totals. Crew one-event plan IDs must not be copied into `teams.currentPlanId`.

[[packages/wodsmith-db/src/schemas/crew-billing-events.ts]] stores append-only audit rows for manual sales, Payment Link reconciliation, checkout completion, founder overrides, credit set/applied, refunds, and comped events.

[[apps/crew/src/lib/crew/billing-state.ts]] owns deterministic billing state normalization, audit event construction, settings patching, private founder/credit metadata handling, and idempotency-key deduping for reconciliation events.

[[apps/crew/src/server/crew-billing.server.ts]] keeps Crew billing read/write operations server-only and local-operator guarded. It scopes audit rows by competition and organizing team, appends audit rows before updating event settings, and does not mutate team subscription billing.

## Manual Paid And Founder Grants

Manual Crew paid states are private operator/server actions that assign an event-level Crew catalog plan, append a billing audit row, and patch only `crew_event_settings`.

[[apps/crew/src/lib/crew/billing-state.ts]] resolves event-level Crew entitlements from the paid/comped/credited/refunded billing state plus the event plan ID. It mirrors the launch catalog limits for Starter, Basic, Pro, Concierge, and Founding grants without reading or writing `teams.currentPlanId`.

[[apps/crew/src/server/crew-billing.server.ts]] and [[apps/crew/src/server-fns/crew-billing-fns.ts]] expose the local-operator-only manual paid, founder grant, comp, refund, and full-platform credit actions. Founder pricing, credit notes, invoices, and Stripe references stay in server-only audit rows/private metadata; public Crew or volunteer surfaces should consume only derived access/limit signals.

Full-platform upgrade credit is single-use per Crew event. Setting or applying credit uses stable idempotency keys and rejects old credit audit rows without a tested reversal path.

## Billing Page And Upgrade CTA

The private Crew billing page shows organizer-safe event billing state without exposing operator-only audit metadata.

[[apps/crew/src/routes/events/$eventId/billing.tsx]] renders event plan, billing status/source, fulfillment state, upgrade credit, refund state, and the narrow upgrade CTA for the selected Crew event.

[[apps/crew/src/lib/crew/billing-page.ts]] derives public page labels and CTA state from normalized event-level Crew billing state. It does not read team subscription state, expose founder pricing, or pass Stripe IDs through to the route view model.

[[apps/crew/src/server/crew-billing.server.ts]] and [[apps/crew/src/server-fns/crew-billing-fns.ts]] keep the organizer billing loader server-only, scoped to the event organizing team's billing permission with local operator fallback. Payment Link buttons only use an already configured safe URL from event settings, and Checkout remains a disabled flag-gated slot until a later slice creates sessions.

## Stripe Payment Link Sales

Stripe Payment Link sales are recorded manually by private Crew operators without calling Stripe APIs, creating Checkout Sessions, or wiring webhooks.

[[apps/crew/src/lib/crew/payment-link-sales.ts]] normalizes operator-provided Payment Link references and organizer-safe URLs, stores safe URLs under `crew_event_settings.settings`, derives stable reconciliation idempotency keys, and builds server-scoped manual reconciliation inputs from the event ID plus organizing team ID resolved on the server.

[[apps/crew/src/lib/crew/billing-state.ts]] maps Payment Link reconciliation to an event-level paid Crew purchase with source `PAYMENT_LINK`, requiring a Crew event plan and positive amount while keeping the plan separate from `teams.currentPlanId`.

[[apps/crew/src/server/crew-billing.server.ts]] and [[apps/crew/src/server-fns/crew-billing-fns.ts]] expose local-operator-only Payment Link reference recording and sale reconciliation. Reconciliation appends `crew_billing_events` audit rows, patches only the selected event's `crew_event_settings` billing fields, and still works when Stripe metadata is missing because the operator supplies the event, team scope, plan, amount, and currency.

## Crew Checkout Sessions

Crew Checkout Session creation is feature-flagged with `CREW_STRIPE_CHECKOUT_ENABLED` and uses the existing Crew event billing state instead of team subscription billing.

[[apps/crew/src/lib/crew/checkout-sessions.ts]] builds Stripe Checkout Session params for public paid Crew event plans only, with metadata `product=crew`, team/event scope, Crew plan, `crewEventSettingsId`, `billingEventId`, and a stable checkout idempotency key. Private founder/concierge pricing and audit metadata are excluded from session metadata and organizer page view models.

[[apps/crew/src/server/crew-billing.server.ts]] creates sessions through the shared Stripe client, appends a pending `checkout_session_created` Crew billing audit event, and patches only event-level `crew_event_settings` Checkout reference/status fields. The webhook completion path owns the later `checkout_completed` transition, and Crew one-event purchases must not update `teams.currentPlanId`.

## Crew Stripe Webhooks

Crew Stripe webhooks complete the event-level Checkout flow after Stripe verifies payment.

[[apps/crew/src/routes/api/webhooks/stripe.ts]] routes completed Checkout Sessions by `session.metadata.product`. Sessions with `product=crew` are handled by Crew billing completion, while non-Crew registration sessions continue through the existing athlete registration checkout workflow.

[[apps/crew/src/lib/crew/checkout-webhooks.ts]] validates the Crew metadata contract, including team/event scope, public Crew plan, event settings row ID, billing event ID, checkout idempotency key, amount, currency, Checkout Session ID, and Stripe event ID. Duplicate delivery is treated as idempotent by both Stripe event ID and Checkout Session ID.

[[apps/crew/src/server/crew-billing.server.ts]] completes only a matching pending Stripe Checkout event settings row, appends one `checkout_completed` billing audit row, and patches only `crew_event_settings` billing fields. Crew Checkout completion must not mutate WODsmith team subscription state or assign Crew one-event plan IDs to `teams.currentPlanId`.

## Paid Launch Ops Hardening

Crew paid launch remains operator-led unless the Checkout flag is explicitly enabled.

[[apps/crew/docs/guides/paid-launch-ops-runbook.md]] is the day-one runbook for manual paid grants, founder/private pricing, Stripe Payment Link reconciliation, refund and full-platform credit policy, and no-live-Stripe validation before turning on self-serve Checkout.

[[apps/crew/src/lib/crew/billing-state.test.ts]] locks the manual, founder, credit, refund, Payment Link, Checkout creation, and webhook completion plans to event-level `crew_event_settings` patches without `teams.currentPlanId` mutation.

[[apps/crew/src/lib/crew/billing-page.test.ts]] keeps organizer-safe billing view models free of founder pricing, invoices, private audit metadata, and raw Stripe references while preserving the disabled Checkout expectation when `CREW_STRIPE_CHECKOUT_ENABLED` is off.

## Server Function Runtime Boundary

Route and client code import lightweight `createServerFn` wrappers from [[apps/crew/src/server-fns]].

Those wrappers may validate input, but DB and Workers-runtime-backed implementation belongs in server-only `*.server.ts` modules under [[apps/crew/src/server]] and should be loaded inside the wrapper `handler()`.

This prevents Vite client import analysis from walking through [[apps/crew/src/db/index.ts]] to `cloudflare:workers` while preserving stable server-function import paths.

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

## Roster Shifts Assignments

Roster shifts assignments normalize volunteer invitations, memberships, shifts, and heat assignments into one Crew roster model for staffing views.

The pure helpers preserve source identity for invitations and memberships, derive roster status, and keep role, availability, credential, import, and assignment details together so Crew pages can render staffing state without mutating event data.

## Roster Volunteer Editing

Roster volunteer editing lets local Crew operators correct existing volunteer contact and staffing metadata on [[apps/crew/src/routes/events/$eventId/volunteers.tsx|the volunteer roster page]].

[[apps/crew/src/server-fns/crew-roster-shift-fns.ts]] exposes the route-safe edit wrapper while [[apps/crew/src/server/crew-roster-shift.server.ts]] mutates only the backing `team_invitations` or `team_memberships` metadata for the selected roster row. Pending invitations also keep `team_invitations.email` aligned with edited signup email; membership rows never mutate the linked user account email.

[[apps/crew/src/lib/crew/roster-shifts.ts]] owns deterministic metadata normalization and duplicate email detection so import audit/source metadata, assignments, confirmations, and shift relationships survive roster corrections.

## Shift Board Pilot Ops

Crew shift board pilot ops adapts the existing shift surface into an operator handoff board for real pilot events.

[[apps/crew/src/routes/events/$eventId/shifts.tsx]] keeps Crew-owned shift create, edit, assign, and remove actions while adding role, credential, source, and status filters.

[[apps/crew/src/server/crew-roster-shift.server.ts]] hydrates the board from existing roster, shift, assignment, confirmation, and staffing-matrix inputs without creating schema or mutating judge rows.

[[apps/crew/src/lib/crew/shift-board-pilot-ops.ts]] derives per-shift open-slot, confirmation, availability, role, double-booking, import-source, and ready/blocked status signals for the route.

## Judge Assignment Version Publishing

Published judge assignment edits use the existing `judge_assignment_versions` and `judge_heat_assignments` model.

Editing an active published judge schedule creates a new active version, clones the previous active assignments into that version, applies the edit to the cloned rows, and leaves the prior active version's rows immutable for audit and rollback.

Per-event publishing uses an advisory lock before allocating the next version number so frequent day-of edits do not race the `(trackWorkoutId, version)` uniqueness boundary. Edits against assignment IDs that are not present in the active version fail instead of silently mutating an inactive version or producing an empty revision.

## Judge Rotations

Crew judge rotations adapt the existing judge scheduling model into a local-operator event surface.

[[apps/crew/src/routes/events/$eventId/judges.tsx]] renders workout selection, judge selection, per-judge rotation replacement, coverage preview, active published assignments, and version history.

[[apps/crew/src/server-fns/crew-judge-rotations-fns.ts]] keeps route imports lightweight while [[apps/crew/src/server/crew-judge-rotations.server.ts]] owns Crew event hydration, scoped rotation writes, and publishing through the versioned assignment helper.

[[apps/crew/src/lib/crew/judge-rotations.ts]] keeps rotation expansion, validation, lane conflicts, and coverage summaries deterministic for the route and server.

Publishing rotations creates a new active `judge_assignment_versions` row and materializes `judge_heat_assignments` under the advisory-lock flow from [[crew#Judge Assignment Version Publishing]].

## Manual Volunteer Intake

Manual volunteer intake lets Crew operators build the roster from [[apps/crew/src/routes/events/$eventId/volunteers.tsx|the event volunteer page]] without leaving the existing volunteer primitives.

Single-add and paste flows call [[apps/crew/src/server-fns/crew-roster-shift-fns.ts|route-safe server functions]] backed by [[apps/crew/src/server/crew-roster-shift.server.ts|server-only roster mutations]] to create pending volunteer `team_invitations` with `SYSTEM_ROLES_ENUM.VOLUNTEER`, normalize email casing and whitespace, skip existing volunteer invitations or memberships, and use the same volunteer membership metadata shape consumed by [[crew#Roster Shifts Assignments]], public signup, import, roster display, shifts, and assignment validation.

[[apps/crew/src/lib/crew/manual-volunteer-intake.ts|Manual intake helpers]] parse pasted email batches and default missing role selections through `getCrewRosterRoleTypes()` so manually entered volunteers display as General and stay compatible with shift assignment behavior.

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

## Import Apply

Crew import apply turns previewed rows into persisted volunteer, heat, shift, and assignment records only after an operator confirms the import.

The apply layer consumes parser output from the preview slice, plans create/update/skip/error operations, and returns summaries that can be persisted for audit without re-parsing the uploaded file.

### Confirmed Mutation

The confirmed mutation is the only apply path allowed to create or update Crew roster and scheduling data from parsed import rows.

It keeps the destructive boundary explicit: preview remains read-only, while confirmation can create invitations, update memberships, and attach import metadata to the resulting records.

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

## Self Serve Preset Schema

Self-serve Crew setup keeps reusable setup memory in shared DB tables owned by `@repo/wodsmith-db`, while per-event setup progress remains in `crew_event_settings.settings`.

`crew_template_presets` stores per-team and optional per-event role, shift, and staffing template payloads for later preview/apply flows. Built-in templates stay in typed application code until saved team presets are needed. IDs use the `ctpres_` prefix.

`crew_import_mapping_presets` stores team-scoped CSV/source header fingerprints, original headers, and column mappings by import kind so later import flows can suggest a mapping. Suggestions must remain explicit operator choices, not automatic import application. IDs use the `cimap_` prefix.

`crew_department_leads` stores event-scoped delegation records for role, floor, and time-slice access without expanding the broad team permission model. IDs use the `cdlead_` prefix.

## Department Leads

Department leads let organizers delegate Crew shift-board and roster operations for a role, floor, and time window without adding broad `TEAM_PERMISSIONS`.

[[apps/crew/src/lib/crew/department-leads.ts]] owns deterministic scope normalization, read filtering, and mutation guard helpers. [[apps/crew/src/server/crew-department-lead.server.ts]] loads shared `crew_department_leads` rows and resolves either full organizer/local-operator access or active department-lead scopes. [[apps/crew/src/server-fns/crew-department-lead-fns.ts]] keeps the route-safe wrappers thin.

The setup surface at [[apps/crew/src/routes/events/$eventId/setup.tsx]] manages lead rows through [[apps/crew/src/components/crew-department-leads/crew-department-leads-panel.tsx]]. Existing roster, shift, staffing, day-of, and confirmation server paths apply the same server-side scope before returning data or mutating shift/assignment state.

## Remember Import Mappings

Crew import mapping memory stores confirmed CSV header mappings in `crew_import_mapping_presets` by team, source platform, import kind, and deterministic header fingerprint.

[[apps/crew/src/lib/crew/imports/mapping-memory.ts]] owns pure header fingerprinting, source normalization, scoped suggestion selection, and save-payload sanitization. [[apps/crew/src/server-fns/crew-import-fns.ts]] keeps the route-facing functions thin while [[apps/crew/src/server/crew-imports.server.ts]] loads and upserts presets through the shared table.

[[apps/crew/src/routes/events/$eventId/imports.tsx]] surfaces saved mappings as explicit suggestions. Operators must click to use or remember a mapping; previews and applies continue to use the currently visible mapping and never rewrite historical `crew_import_rows`.

## Guided Setup State

Guided setup turns Crew readiness facts and operator overrides into a per-event self-serve checklist stored in `crew_event_settings.settings`.

[[apps/crew/src/lib/crew/guided-setup.ts]] derives event basics, days/floors, imports, roles, staffing assumptions, schedule publish, reminders, and exports steps from existing setup settings plus readiness facts. Source-data blockers remain blocked even when an operator records a manual override.

[[apps/crew/src/server-fns/crew-guided-setup-fns.ts]] exposes thin route-safe read/update wrappers, while [[apps/crew/src/server/crew-guided-setup.server.ts]] keeps DB and readiness hydration server-only. Updates write only the `guidedSetup` JSON subtree and preserve existing concierge setup notes.

[[apps/crew/src/components/crew-guided-setup/guided-setup-shell.tsx]] renders the compact wizard shell on [[apps/crew/src/routes/events/$eventId/setup.tsx]]. It records an operator status and note per step without taking over import-mapping memory, department-lead enforcement, volunteer self-service, export-packet, queue, or schema work.

## Role And Shift Templates

Crew role and shift templates provide typed built-in staffing patterns plus team-saved presets backed by `crew_template_presets`.

[[apps/crew/src/lib/crew/templates]] owns deterministic built-ins, preset serialization, preview, duplicate detection, and append-only apply planning. [[apps/crew/src/server-fns/crew-template-fns.ts]] keeps route-facing wrappers thin while [[apps/crew/src/server/crew-template.server.ts]] loads saved team presets, fills empty setup assumptions only when requested, and appends only missing `volunteer_shifts`. [[apps/crew/src/components/crew-templates/crew-template-panel.tsx]] integrates preview/apply/save into the event setup page without adding a public marketplace or copy-prior-event flow.

## Copy Prior Event Setup

Crew copy-prior-event setup lets a local operator preview structural setup from an earlier Crew event owned by the same organizing team, then apply only empty-target draft structure into the current event.

[[apps/crew/src/lib/crew/copy-prior-event.ts]] owns deterministic eligibility filtering, date-shift planning, denylist summaries, non-overwrite apply planning, and settings JSON preservation. It copies structural venues/floors, workout/event shells, heat schedule shells, shift templates, and empty setup assumptions only when the target category has no existing rows.

[[apps/crew/src/server-fns/crew-copy-event-fns.ts]] exposes route-safe read/apply wrappers, while [[apps/crew/src/server/crew-copy-event.server.ts]] keeps DB/runtime imports server-only and rechecks target structure inside the apply transaction. Apply creates new target IDs, leaves source rows untouched, records `copyPriorEvent` metadata in `crew_event_settings.settings`, and does not copy volunteers, team invitations, roster memberships, confirmations, assignment responses, import history, registrations, payments, waivers, broadcasts, reminders, queues, check-in/no-show state, analytics, or published judge assignment rows.

[[apps/crew/src/components/crew-copy-event/crew-copy-prior-event-panel.tsx]] renders the setup-page preview and conservative apply action on [[apps/crew/src/routes/events/$eventId/setup.tsx]].

## Volunteer Self Service

Crew volunteer self-service is a no-session, no-password token surface scoped to the volunteer assignment confirmation token.

[[apps/crew/src/routes/e/$slug/schedule/$token.tsx]] renders the token volunteer's own schedule, response entry point, print-friendly schedule view, calendar links, and contact metadata form. [[apps/crew/src/server-fns/crew-confirmation-fns.ts]] keeps route imports thin while [[apps/crew/src/server/crew-confirmation.server.ts]] validates the event slug, token hash, Crew-only event state, assignment row, and volunteer membership before returning or mutating data.

[[apps/crew/src/lib/crew/volunteer-self-service.ts]] owns deterministic schedule shaping, metadata-only contact updates, and calendar snippet helpers. Contact updates write only volunteer roster metadata on `team_memberships`; they do not mutate user account email, assignment rows, confirmation response state, reminder counts, or sent timestamps.

## Assignment Confirmation Responses

Crew assignment confirmation links are token-only volunteer surfaces. Raw tokens are generated only while creating links, stored only as hashes, and used by [[apps/crew/src/routes/e/$slug/confirm/$token.tsx]] and [[apps/crew/src/routes/e/$slug/schedule/$token.tsx]] to show safe confirm, decline, and change-request flows without requiring a session.

[[apps/crew/src/server-fns/crew-confirmation-fns.ts]] owns token lookup, transient email payload construction, and deterministic response transitions. [[apps/crew/src/lib/crew/assignment-confirmations.ts]] keeps the pure token and status helpers testable outside the server function layer.

## Assignment Confirmations

Organizer-facing assignment confirmations reuse `crew_assignment_confirmations` and keep assignments authoritative.

[[apps/crew/src/lib/crew/assignment-confirmations.ts]] normalizes operational states from persisted status plus timestamps: pending, sent, confirmed, declined, change requested, no-show, and replaced. Sent is represented by pending rows with `sentAt`, and replaced is represented by cancelled confirmation rows; checked-in waits for a later first-class primitive.

[[apps/crew/src/server/crew-confirmation.server.ts]] owns guarded organizer status updates for volunteer shift assignments, creating a confirmation row only when an assignment is missing one and never mutating assignment rows as part of status changes. [[apps/crew/src/server-fns/crew-confirmation-fns.ts]] keeps the createServerFn wrapper thin so DB/runtime imports stay out of route module graphs.

[[apps/crew/src/routes/events/$eventId/shifts.tsx]] shows compact assignment-level status controls and summary counts for sent and action-needed confirmations. [[apps/crew/src/lib/crew/staffing/index.ts]], [[apps/crew/src/routes/events/$eventId/staffing.tsx]], and [[apps/crew/src/lib/crew/readiness.ts]] consume the same normalized state so staffing gaps and readiness summaries treat no-shows, change requests, declines, and replacements consistently.

## Confirmation Emails And Reminders

Crew confirmation email operations use `crew_assignment_confirmations` as the source of truth for assignment response status, dispatch timestamps, and reminder counts.

[[apps/crew/src/lib/crew/assignment-confirmations.ts]] plans initial confirmation sends and 48-hour or 24-hour reminders from pending confirmation rows, normalized recipient emails, shift start times, `sentAt`, and `reminderCount`. Idempotency keys use `crew-confirmation-${confirmationId}-${reminderCount}` so queue retries do not double-send a reminder attempt.

[[apps/crew/src/server/crew-confirmation.server.ts]] loads eligible volunteer shift confirmations, mints fresh raw tokens only for the queued payload, stores only the new token hash, and builds rendered Crew email messages from [[apps/crew/src/react-email/crew/assignment-confirmation.tsx]], [[apps/crew/src/react-email/crew/reminder-48-hour.tsx]], and [[apps/crew/src/react-email/crew/reminder-24-hour.tsx]]. If the shared email queue binding is unavailable, the operation only logs preview payloads and returns preview counts.

[[apps/crew/src/server-fns/crew-confirmation-fns.ts]] exposes the route-safe operation wrapper. [[apps/crew/src/routes/events/$eventId/shifts.tsx]] provides quiet operator actions for event-wide confirmation sends and reminder sends, then reports queued, previewed, and failed counts without sending live email during local validation.

## Day Of Operations Board

Crew day-of operations is a compact read-only board for current blocks, response queues, role gaps, no-shows, replacements, and active judge lane coverage.

[[apps/crew/src/routes/events/$eventId/day-of.tsx]] renders the event board. [[apps/crew/src/server-fns/crew-day-of-fns.ts]] keeps the route import light while [[apps/crew/src/server/crew-day-of.server.ts]] reuses staffing hydration without mutating event data.

[[apps/crew/src/lib/crew/day-of-operations.ts]] derives current and next blocks, critical unfilled roles, due-soon no-responses, decision queues, no-show/replaced queues, time-block status, and judge coverage.

The board does not add schema, exports, queue bindings, live email sends, public token changes, assignment automation, or published judge-row mutation. Checked-in remains unavailable until a dedicated primitive exists.

## Pilot Exports

Crew pilot exports turn the active event staffing and judge assignment data into operator-ready packets without creating report-builder schema or mutating published assignments.

[[apps/crew/src/routes/events/$eventId/exports.tsx]] renders the per-event export surface. [[apps/crew/src/server-fns/crew-pilot-export-fns.ts]] keeps the route import light while [[apps/crew/src/server/crew-pilot-exports.server.ts]] reuses server-only staffing hydration and active judge assignment data.

[[apps/crew/src/lib/crew/exports/pilot-exports.ts]] owns deterministic export derivation for master schedule CSV rows, role sheets, judge heat/lane sheets, no-response and decline lists, and printable floor lead sheets. Exports are read-only and must not send reminders, create queues, alter confirmation tokens, or mutate versioned judge assignment rows.

## Event Day Export Packet

The event-day packet extends [[crew#Pilot Exports]] with a print-first index, day schedule, station cards, lane cards, role sheets, and judge cards from [[apps/crew/src/lib/crew/exports/pilot-exports.ts]], rendered at [[apps/crew/src/routes/events/$eventId/exports.tsx]].

The packet is still full local-operator-only through [[apps/crew/src/server/crew-pilot-exports.server.ts]] and [[apps/crew/src/server-fns/crew-pilot-export-fns.ts]]. It does not add PDF runtime infrastructure, schema, queue/email work, public tokens, department-lead subset export access, or assignment/judge-version mutations.

## Strategic Moat Privacy Model

Crew Phase 5 memory is scoped, consented, factual volunteer history before it becomes discovery.

[[apps/crew/docs/decisions/0005-strategic-moat-privacy-model.md]] defines the privacy boundary for returning volunteer history, communication history, reliability summaries, series crew pools, Crew-to-WODsmith conversion assistance, and regional discovery.

Same-organizer returning volunteer history may show factual prior event history owned by that organizing team. Cross-organizer visibility requires explicit volunteer opt-in, supports revocation, and remains a blind intro request until the volunteer accepts.

Identity matching prefers `userId` when present and normalized contact hashes for no-password volunteers. Crew must not merge identities from name-only matches, display labels, internal notes, emergency contacts, or private metadata.

Reliability is auditable fact history only: assignments, confirmations, responses, attendance outcomes, credentials, and replacements. Crew must not expose public ratings, rankings, top-judge lists, negative badges, global reputation, organizer sentiment, or private notes.

Raw email, phone, emergency contacts, internal notes, and private metadata stay in their existing source tables. Discovery, search, analytics, audit previews, and regional summaries must not expose those raw fields.

Series crew pools stay constrained to the selected `competition_group`; conversion enriches an existing competition instead of cloning identities; regional discovery starts as opt-in intro requests only. Intelligence, series, conversion, discovery, and person-level analytics require privacy review notes and feature flags before implementation.
