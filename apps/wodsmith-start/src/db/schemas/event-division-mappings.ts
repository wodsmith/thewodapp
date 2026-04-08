import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { index, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core"
import { commonColumns, createEventDivisionMappingId } from "./common"
import { competitionsTable } from "./competitions"
import { trackWorkoutsTable } from "./programming"
import { scalingLevelsTable } from "./scaling"

/**
 * Event Division Mappings
 *
 * Maps which events (track_workouts) are visible to which divisions (scaling_levels)
 * within a single competition. This enables organizers to create division-specific
 * event variants — e.g., an individual version of "Fran" for solo divisions and
 * a team version with combined scoring for partner divisions.
 *
 * Semantics:
 * - If NO mappings exist for a competition, all events apply to all divisions (backwards compatible).
 * - If mappings exist for an event, only the mapped divisions see/score that event.
 * - An event can be mapped to multiple divisions; a division can have multiple events.
 *
 * NOTE: PlanetScale (Vitess) does not support foreign key constraints.
 * Cascade cleanup is handled at the application level:
 * - Deleting an event cleans up its mappings
 * - Deleting a division cleans up its mappings
 * - saveEventDivisionMappingsFn does a full replace on save
 * Relations below are for Drizzle query builder only (no DB-level enforcement).
 */
export const eventDivisionMappingsTable = mysqlTable(
  "event_division_mappings",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createEventDivisionMappingId())
      .notNull(),
    // The competition this mapping belongs to
    competitionId: varchar({ length: 255 }).notNull(),
    // The event (track_workout) being mapped to a division
    trackWorkoutId: varchar({ length: 255 }).notNull(),
    // The division (scaling_level) this event is assigned to
    divisionId: varchar({ length: 255 }).notNull(),
  },
  (table) => [
    // Each event can only be mapped to a division once per competition
    uniqueIndex("edm_comp_event_div_idx").on(
      table.competitionId,
      table.trackWorkoutId,
      table.divisionId,
    ),
    index("edm_competition_idx").on(table.competitionId),
    index("edm_event_idx").on(table.trackWorkoutId),
    index("edm_division_idx").on(table.divisionId),
  ],
)

// Relations (Drizzle query builder only — no DB-level FK enforcement on PlanetScale)
export const eventDivisionMappingsRelations = relations(
  eventDivisionMappingsTable,
  ({ one }) => ({
    competition: one(competitionsTable, {
      fields: [eventDivisionMappingsTable.competitionId],
      references: [competitionsTable.id],
    }),
    trackWorkout: one(trackWorkoutsTable, {
      fields: [eventDivisionMappingsTable.trackWorkoutId],
      references: [trackWorkoutsTable.id],
    }),
    division: one(scalingLevelsTable, {
      fields: [eventDivisionMappingsTable.divisionId],
      references: [scalingLevelsTable.id],
    }),
  }),
)

// Type exports
export type EventDivisionMapping = InferSelectModel<
  typeof eventDivisionMappingsTable
>
