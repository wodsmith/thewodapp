---
status: proposed
date: 2026-03-20
decision-makers: [Ian Jones]
consulted: []
informed: []
---

# ADR-0007: Series Template Events with Selective Competition Sync

## Context and Problem Statement

Series organizers currently define events (workouts) independently for each competition. When a series has 6+ competitions sharing the same event lineup, organizers must manually recreate events, configure scoring, attach resources, and upload judging sheets for every competition. This is tedious and error-prone — a change to event details (e.g., updated workout description, corrected scoring type) must be applied individually to each competition.

We already have a **series template pattern for divisions** (`seriesTemplateDivisionsTable` + `seriesDivisionMappingsTable`) that allows organizers to define divisions once at the series level and sync metadata (fee, description, maxSpots) to competitions. However, events are significantly more complex than divisions:

- Events reference **workouts** with their own schema (name, description, scheme, scoreType, scoreSortOrder, etc.)
- Events have **parent-child relationships** (multi-workout events like "CrossFit Total" with sub-events)
- Events carry **per-division descriptions** (`workoutScalingDescriptionsTable`)
- Events can have attached **resources** and **judging sheets** (files in R2)
- Events have operational settings: `pointsMultiplier`, `heatStatus`, `eventStatus`, `sponsorId`, judge rotation defaults

Additionally, the current division sync model has a UX gap: sync is all-or-nothing across all mapped competitions. Organizers have expressed the need to **selectively choose which competitions receive updates** when a template changes — some competitions may have customized events that shouldn't be overwritten.

How should we implement series-level event templates with support for selective sync to competitions?

## Decision Drivers

* Must follow the established division template pattern for conceptual consistency
* Must handle the complexity of events: workouts, parent-child hierarchy, resources, judging sheets, per-division descriptions
* Must allow competitions to inherit some events from the template while having their own custom events
* Must allow organizers to choose which competitions receive updates when syncing
* Must support preview-before-sync (dry run) like the division sync
* Must not break existing event creation/editing workflows for non-series competitions
* Must work within PlanetScale/MySQL constraints (no FKs, row-size limits)
* Should be incrementally buildable — template creation first, sync later

## Considered Options

* **Option A: Deep clone with origin tracking** — Clone full event trees into each competition with a `sourceTemplateEventId` column to track lineage. Sync diffs the template against each competition's events.
* **Option B: Shared event references with per-competition overrides** — Competitions reference template events directly. A per-competition overrides table stores local customizations.
* **Option C: Template-to-competition mapping table (like divisions) with selective sync** — Template events live on a series-owned programming track. A mapping table links template events to competition events. Sync copies template data into competition events, scoped to selected competitions.

## Decision Outcome

Chosen option: **"Option C: Template-to-competition mapping table with selective sync"**, because it extends the proven division pattern, keeps competition events fully independent (no shared mutable state), and naturally supports the selective sync requirement.

Option A was rejected because deep cloning creates ambiguity about which copy is authoritative and makes it hard to distinguish "organizer customized this" from "organizer hasn't synced yet." Option B was rejected because shared references create coupling — deleting or reordering a template event would directly affect all competitions, and the overrides table adds schema complexity without clear benefits over independent copies.

Option C gives each competition its own fully independent event data (just like divisions today), with the mapping table providing the bridge for sync operations. This means a competition can diverge from the template freely, and sync is always an explicit, previewed action.

### Consequences

* Good, because it extends a pattern organizers already understand (division templates)
* Good, because competition events remain fully independent — no shared mutable state
* Good, because selective sync lets organizers control which competitions get updates
* Good, because preview-before-sync prevents accidental overwrites of customized events
* Good, because incrementally buildable: template CRUD first, mapping + sync later
* Bad, because sync must handle complex nested data (workouts, sub-events, resources, judging sheets) which is more involved than division metadata sync
* Bad, because file-based assets (judging sheets in R2) require copy-on-sync rather than simple row inserts
* Neutral, because template events and competition events are separate copies — changes to a competition event don't propagate back to the template

### Non-Goals

* Bidirectional sync (competition → template) — template is always the source of truth for sync
* Automatic sync on template save — sync is always an explicit, previewed action
* Versioning or change history for template events — use git/audit logs if needed
* Templating heat schedules or submission windows — those are competition-specific operational concerns

## Detailed Design

### Database Schema

#### 1. Series Template Programming Track

Reuse the existing `programming_tracks` table. A series template's events live on a track owned by the series group, identified by a new field on `competition_groups`:

```
competition_groups.settings.templateTrackId: string | null
```

This mirrors how `settings.scalingGroupId` stores the template's scaling group for divisions.

#### 2. Template Events

Template events are regular `track_workouts` rows on the series template track. They use the same schema as competition events — no new table needed for the template events themselves. This means the existing event editor UI can be reused for template editing with minimal changes.

Template events support parent-child relationships (multi-workout events) using the existing `parentEventId` field.

#### 3. Series Event Mappings Table

New table: `series_event_mappings`

| Column | Type | Description |
|--------|------|-------------|
| `id` | varchar(255) PK | CUID2 |
| `groupId` | varchar(255) | Series group ID |
| `competitionId` | varchar(255) | Target competition |
| `competitionEventId` | varchar(255) | Competition's track_workout ID |
| `templateEventId` | varchar(255) | Template's track_workout ID |

Indexes:
- Unique on `(groupId, competitionId, competitionEventId)` — each competition event maps to at most one template event
- Index on `(groupId, templateEventId)` — find all competitions using a template event

This follows the same structure as `series_division_mappings`.

#### 4. What Gets Synced

Events are complex, so we need to be explicit about what sync copies from template → competition:

**Always synced (template is authoritative):**
- Workout definition (`workouts` table): `name`, `description`, `scheme`, `scoreType`, `scoreSortOrder`, `timeCap`, `reps`
- Event settings (`track_workouts` table): `pointsMultiplier`, `notes`, `trackOrder` (relative ordering preserved)
- Parent-child structure: `parentEventId` relationships — sub-events are synced as a group with their parent
- Per-division descriptions: `workoutScalingDescriptionsTable` rows (matched via division mappings)

**Optionally synced (organizer chooses per-sync):**
- Resources: `event_resources` rows (copies content, not references)
- Judging sheets: `event_judging_sheets` rows (copies R2 files to competition-scoped keys)

**Never synced (competition-specific):**
- `heatStatus` / `eventStatus` — publication state is per-competition
- `sponsorId` — sponsors may differ per competition
- Heat/judge rotation settings (`defaultHeatsCount`, `defaultLaneShiftPattern`, `minHeatBuffer`)
- Submission windows (`competition_events` table)

#### 5. Selective Sync Flow

The current division sync applies to all mapped competitions. For events, we change this to a **per-competition selection** model:

1. Organizer edits the series event template (add/remove/reorder events, edit workout details)
2. Organizer clicks "Sync to Competitions"
3. **Competition selection step**: Organizer sees a checklist of all series competitions with their current sync status:
   - "In sync" — competition events match template
   - "Behind" — template has changes not yet applied
   - "Custom" — competition has events not in the template or has diverged
4. Organizer selects which competitions to sync
5. **Preview step**: For selected competitions, show a diff of what will change (new events, updated fields, removed events)
6. Organizer confirms sync

This two-step selection (which competitions → preview changes → confirm) gives organizers full control.

#### 6. Sync Operations

**Initial sync (no existing mapping):**
- For each template event (parents first, then children):
  - Clone the workout row (new ID, competition's track)
  - Clone the track_workout row (new ID, competition's track, link to cloned workout)
  - Clone per-division descriptions (mapped via division mappings)
  - Optionally clone resources and judging sheets
  - Create mapping row linking template event → competition event

**Update sync (mapping exists):**
- For each mapped template event:
  - Update the competition's workout row with template values (only synced fields)
  - Update the competition's track_workout row with template values
  - Upsert per-division descriptions
  - Optionally add new resources/judging sheets (don't remove competition-added ones)

**Template event added:**
- Clone into selected competitions (same as initial sync for that event)

**Template event removed:**
- Show in preview as "will be unmapped" — the competition event stays but loses its mapping
- Organizer can choose to also delete the competition event, or keep it as a custom event

#### 7. Per-Division Description Mapping

Events have per-division workout descriptions (e.g., "Rx: 135lb clean" vs "Scaled: 95lb clean"). When syncing, these descriptions must be matched to the correct competition division. This uses the existing `series_division_mappings`:

```
Template event division description (series divisionId)
  → series_division_mappings (seriesDivisionId → competitionDivisionId)
    → Competition event division description (competition divisionId)
```

If a competition doesn't have a mapped division for a template division's description, that description is skipped during sync.

### UI Changes

#### Series Dashboard: New "Events" Tab

Add an "Events" tab to the series organizer dashboard (alongside existing "Divisions" tab):

- **Template Editor**: Reuse the competition event editor components, pointed at the series template track. Supports:
  - Add/remove/reorder events
  - Edit workout details, scoring, descriptions
  - Parent-child (multi-workout) event creation
  - Resource and judging sheet management
- **Sync Controls**: "Sync to Competitions" button opens the selective sync flow
- **Mapping Status**: Per-competition breakdown showing mapped vs. custom events

#### Competition Event Editor: Series Indicators

When a competition is part of a series with event templates:
- Show a badge on mapped events indicating they came from the series template
- Show "last synced" timestamp
- Allow organizers to "unlink" an event from the template (removes mapping, keeps event as custom)

### Migration Path

This can be built incrementally:

1. **Phase 1**: Series template track creation and event template CRUD (no sync)
2. **Phase 2**: Mapping table and initial sync (clone template → competitions)
3. **Phase 3**: Update sync with preview and selective competition targeting
4. **Phase 4**: Resource and judging sheet sync (R2 file copying)

## Pros and Cons of the Options

### Option A: Deep Clone with Origin Tracking

Add a `sourceTemplateEventId` column to `track_workouts`. When cloning from a template, populate this column. Sync finds all events with matching `sourceTemplateEventId` and diffs them.

* Good, because simple to understand — each event knows where it came from
* Good, because no separate mapping table needed
* Bad, because `sourceTemplateEventId` conflates "was cloned from" with "should be kept in sync with" — an organizer who customizes a cloned event still has the origin link
* Bad, because no way to represent "this competition event maps to this template event" if the event wasn't cloned (e.g., pre-existing events that match a template)
* Bad, because deleting a template event leaves orphaned `sourceTemplateEventId` values
* Bad, because selective sync requires additional tracking beyond the column

### Option B: Shared Event References with Per-Competition Overrides

Competitions reference template `track_workouts` directly (no cloning). A `competition_event_overrides` table stores fields that differ from the template.

* Good, because no data duplication — single source of truth
* Good, because changes to template are immediately visible
* Bad, because "immediately visible" means no preview or selective sync — changes propagate instantly
* Bad, because the overrides table must mirror every field in `track_workouts` and `workouts` as nullable columns
* Bad, because deleting or reordering a template event directly affects all competitions
* Bad, because breaks the principle that competitions own their own data
* Bad, because queries become complex (COALESCE every field with override fallback)

### Option C: Template-to-Competition Mapping Table (Chosen)

Template events live on a series-owned track. A `series_event_mappings` table bridges template events to competition events. Sync is an explicit copy operation scoped to selected competitions.

* Good, because competitions remain fully independent — their events are real rows, not references
* Good, because extends the proven division mapping pattern
* Good, because selective sync is natural — just filter the mapping table by selected competition IDs
* Good, because supports mapping pre-existing events to template events (not just cloned ones)
* Good, because preview-before-sync compares template data against competition data via mappings
* Bad, because sync logic is more complex than a simple origin-tracking column
* Bad, because resource/judging sheet sync requires R2 file operations
* Neutral, because data is duplicated across template and competitions (but this is intentional for independence)

## More Information

- Existing division template implementation: `src/server-fns/series-division-mapping-fns.ts`
- Event schema: `src/db/schemas/programming.ts` (`trackWorkoutsTable`)
- Division mapping schema: `src/db/schemas/series.ts`
- Parent-child event support: commit `ad701554`
