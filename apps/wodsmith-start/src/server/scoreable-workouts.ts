import { sql } from "drizzle-orm"
import { workouts } from "@/db/schemas/workouts"

/**
 * Grouping parents organize scored child track workouts and are not themselves
 * scoreable library entries.
 */
export function scoreableWorkoutCondition() {
  return sql<boolean>`not exists (
    select 1
    from track_workouts parent_link
    inner join track_workouts child_link
      on child_link.parent_event_id = parent_link.id
    where parent_link.workout_id = ${workouts.id}
  )`
}
