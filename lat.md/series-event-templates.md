# Series Event Templates

Series event templates let organizers define events once for a competition series, then sync them to all child competitions. This eliminates repetitive setup when running the same workouts across multiple throwdowns.

## Template Track

Each series group can have one event template, stored as a dedicated programming track with type `"series-template"`.

The template track ID is stored in `competition_groups.settings` JSON as `templateTrackId`. Template events are regular `track_workouts` on this track, each referencing a `workouts` row — the same data model as competition events.

## Template Creation

Organizers create a template through one of two flows:

- **Copy from competition** — Select an existing competition in the series, clone its events (workouts + track_workouts) onto the template track. Parent/child relationships are preserved.
- **Start from scratch** — Creates an empty template track. Organizers add events manually.

Both flows first create the programming track via `createSeriesTemplateTrackFn`, then optionally copy events via `copyEventsFromCompetitionFn`. The copy validates that the source competition belongs to the same series group.

## Template Event Editing

Template events support the same editing experience as competition events:

- Full CRUD (add, edit, delete) with `addEventToSeriesTemplateFn`, `updateSeriesTemplateEventFn`, `deleteSeriesTemplateEventFn`
- Drag-and-drop reorder via `@atlaskit/pragmatic-drag-and-drop` with optimistic UI updates
- Parent/child sub-event hierarchy with expand/collapse
- Per-division scaling descriptions (auto-save on blur/tab switch)
- Movement selection (delete all + re-insert on save)
- Event resources (links/URLs) and judging sheets (PDF uploads via R2)

The event list uses `SeriesTemplateEventEditor` with `SeriesEventRow` components matching `CompetitionEventRow`. The full edit page at `/series/{groupId}/events/{eventId}` mirrors the competition event edit page, including a `ParentEventEditPage` variant with tabbed sub-event forms.

## Syncing to Competitions

`syncTemplateEventsToCompetitionsFn` pushes template event data to mapped competitions. For each template event:

- **Existing mapped event** (UPDATE path): Updates workout fields (name, description, scheme, scoreType, timeCap, repsPerRound, tiebreakScheme), track workout fields (pointsMultiplier, notes, trackOrder, parentEventId), division descriptions, movements, resources, and judging sheets.
- **Unmapped template event with an existing match** (MAP path): Matches an unmapped competition event by name, updates it from the template, saves the event mapping, then syncs division descriptions, movements, resources, and judging sheets.
- **Unmapped template event without an existing match** (CLONE path): Creates a new workout + track_workout on the competition's track, creates the event mapping, then syncs division descriptions, movements, resources, and judging sheets.

Sync behavior by data type:
- **Workout/track fields** — Overwritten to match template
- **Division descriptions** — Mapped through `series_division_mappings` (template division ID to competition division ID), then upserted
- **Movements** — Delete all existing + re-insert from template
- **Resources** — Additive only, deduplicated by title match (case-insensitive)
- **Judging sheets** — Additive only, deduplicated by title match (case-insensitive)

Template asset selection uses [[apps/wodsmith-start/src/lib/series-template-asset-sync.ts#selectTemplateAssetsMissingByTitle]] for both resources and judging sheets. The helper filters titles already present in the competition and deduplicates repeated template titles after trim/case normalization, including empty or whitespace-only titles.

### Selective Sync

The `templateEventIds` optional parameter filters which template events to sync. When provided, only those events are synced. If a child event is selected without its parent, the parent is auto-included to maintain the hierarchy.

The `/series/{groupId}/events` page exposes this as a top-of-page event selection toolbar. The toolbar starts with no events selected, and organizers select any number of parent template events before opening the competition picker. Sub-events are displayed under their parent but are not selectable on their own; selecting the parent syncs its sub-events with it.

The competition picker shows selected-workout status for each competition: already synced, will resync, will map an existing unmapped event, or will create a new event. It also lists the competition's existing events so organizers can avoid duplicating individual-only or team-only programming.

The picker starts with no competitions selected so organizers explicitly choose sync targets. Search normalizes case, accents, punctuation, and spacing, then matches whole tokens from competition names, division labels, team/individual aliases, status, existing event names, mapped competition event names, and event action status. "Select Visible with Changes" selects only currently visible matching competitions.

### Sync Status Detection

`getCompetitionEventSyncStatusFn` compares the selected template events against each competition's events to determine status:

- **in-sync** — All mapped events match the template (workout fields, track fields, movements, resources, judging sheets)
- **behind** — At least one mapped event differs from the template
- **custom** — Competition has events not in any mapping
- **unmapped** — Competition has no event mappings for the selected template events, including partial mappings where other template events are already synced

### Sync Preview

`previewSyncEventsToCompetitionsFn` generates a detailed diff showing what would change per competition per event before applying.

Changes include field-level diffs (e.g., "name: Old Name → New Name"), order changes, "movements updated", "N resources to add", "N judging sheets to add", and whether sync will create a new event or save a mapping to an existing unmapped event.

## Competition Workout Publishing

Series workout publishing manages visibility for real competition events, not template events.

The dedicated `/series/{groupId}/publish-workouts` page loads each child competition's top-level `track_workouts` and current `eventStatus` via [[apps/wodsmith-start/src/server-fns/series-event-template-fns.ts#getSeriesCompetitionEventPublishStatusFn]]. Organizers can search by competition or workout name, filter by draft/published status, select visible draft workouts, and bulk publish or unpublish selected parent workouts.

Bulk updates use [[apps/wodsmith-start/src/server-fns/series-event-template-fns.ts#bulkUpdateSeriesCompetitionEventStatusFn]], which validates that every selected event belongs to a competition in the series and is a top-level event. The update writes the selected parent `eventStatus` and cascades the same status to child sub-events so public workout visibility stays aligned with the competition event hierarchy.

## Event Matching

Event matching connects each competition's events to the series template for leaderboard scoring.

The UI lives on the "Event Match" tab of the consolidated events page at `/series/{groupId}/events`, using `SeriesEventMapper` — an interactive matrix with competitions as rows and parent template events as columns.

Parent events are the primary mapping control surface. Sub-events are displayed under their parent column for context, legacy child selections remain visible, and saving a parent event mapping expands it into child mappings only when unclaimed child events match by name under the selected competition parent.

Competition names in the mapper render as wrapping row links so long competition titles remain fully visible while the matrix scrolls horizontally.

### Auto-Matching

`autoMapEvents` uses a three-pass algorithm:
1. **Exact match** — Case-insensitive name comparison
2. **Normalized match** — Strips prefixes ("Event 1:", "WOD 2 -"), parenthesized suffixes, and filler words
3. **Sorted-token match** — Sorts remaining tokens alphabetically for order-independent comparison

Each template event can only be claimed once (no duplicate mappings).

### Persistence

Mappings are stored in `series_event_mappings` with four keys: groupId, competitionId, competitionEventId, templateEventId.

`saveSeriesEventMappingsFn` validates submitted template event IDs against the series template track and competition event IDs against the selected competition in the series before doing a full replace, then deletes all existing mappings for the group and inserts the new set atomically in a transaction.

## Competition Creation Integration

When creating a competition from a series page, the form shows checkboxes for template events (all selected by default). After creation, only selected events are synced via `syncTemplateEventsToCompetitionsFn` with the `templateEventIds` filter.

## Leaderboard Integration

The series leaderboard (`getSeriesLeaderboard`) computes `unmappedCompetitions` — competitions in the group that lack division mappings. The `SeriesLeaderboardPageContent` component renders an orange warning banner listing these competitions.

## Key Server Functions

All defined in `src/server-fns/series-event-template-fns.ts`:

- `getSeriesTemplateEventsFn` — Load template track and all events
- `getSeriesTemplateEventByIdFn` — Load single event with movement IDs
- `createSeriesTemplateTrackFn` — Create the template programming track
- `getSeriesCompetitionsForTemplateFn` — List competitions with event counts (for copy dropdown)
- `copyEventsFromCompetitionFn` — Clone competition events to template (in transaction)
- `addEventToSeriesTemplateFn` — Add new event to template
- `updateSeriesTemplateEventFn` — Update event fields, movements
- `deleteSeriesTemplateEventFn` — Delete event and cleanup mappings (in transaction)
- `reorderSeriesTemplateEventsFn` — Reorder events (in transaction)
- `getSeriesEventMappingsFn` — Load template + all competition mappings
- `saveSeriesEventMappingsFn` — Full-replace all mappings (in transaction)
- `autoMapSeriesEventsFn` — Auto-map competition events to template
- `syncTemplateEventsToCompetitionsFn` — Sync template to competitions
- `previewSyncEventsToCompetitionsFn` — Preview sync changes
- `getCompetitionEventSyncStatusFn` — Per-competition sync status
- `getSeriesCompetitionEventPublishStatusFn` — Load actual competition event publish status for the series
- `bulkUpdateSeriesCompetitionEventStatusFn` — Bulk publish or unpublish actual competition events in the series
- `syncResourcesAndSheetsToCompetitionsFn` — Standalone resource/sheet sync

## Routes

Series event template routes are nested under the organizer series layout at `/compete/organizer/series/{groupId}`, which uses its own sidebar navigation (outside the dashboard layout).

- `/series/{groupId}/events` — Layout route with `<Outlet />`
- `/series/{groupId}/events/` — Single page with event template editor + sync button, followed by the event matching card below
- `/series/{groupId}/events/{eventId}` — Full event edit page (standalone or parent with tabbed sub-events)
- `/series/{groupId}/publish-workouts` — Bulk publish/unpublish page for actual competition event visibility
