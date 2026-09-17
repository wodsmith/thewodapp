import { sql } from "drizzle-orm"
import { workouts } from "@/db/schemas/workouts"

/**
 * Workout identities used exclusively as grouping parents organize scored
 * children and are not themselves scoreable library entries. A workout reused
 * in any standalone or child occurrence remains scoreable elsewhere.
 */
export function scoreableWorkoutCondition() {
  return sql<boolean>`not exists (
    select 1
    from track_workouts parent_link
    where parent_link.workout_id = ${workouts.id}
      and exists (
        select 1
        from track_workouts child_link
        where child_link.parent_event_id = parent_link.id
      )
      and not exists (
        select 1
        from track_workouts scoreable_link
        where scoreable_link.workout_id = ${workouts.id}
          and not exists (
            select 1
            from track_workouts scoreable_child
            where scoreable_child.parent_event_id = scoreable_link.id
          )
      )
  )`
}
