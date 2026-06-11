/**
 * Group Competition Events
 *
 * Business logic for retroactively grouping existing top-level competition
 * events under a new parent event. Organizers often create the parts of a
 * multi-part event (Part A, Part B) as separate events and later need to wrap
 * them in a parent so the whole thing is scheduled together as one event.
 */

import { createId } from "@paralleldrive/cuid2"
import { and, asc, eq, inArray, isNull } from "drizzle-orm"
import { getDb } from "@/db"
import { createTrackWorkoutId } from "@/db/schemas/common"
import { competitionHeatsTable } from "@/db/schemas/competitions"
import {
  programmingTracksTable,
  trackWorkoutsTable,
} from "@/db/schemas/programming"
import { workouts } from "@/db/schemas/workouts"

export interface GroupCompetitionEventsInput {
  competitionId: string
  /** Team that owns the new parent container workout (organizing team) */
  organizingTeamId: string
  /** Top-level events to convert into sub-events, at least two */
  trackWorkoutIds: string[]
  /** Name for the new parent event */
  name: string
  description?: string
}

export async function groupCompetitionEvents(
  input: GroupCompetitionEventsInput,
): Promise<{ workoutId: string; trackWorkoutId: string }> {
  const db = getDb()

  const track = await db.query.programmingTracksTable.findFirst({
    where: eq(programmingTracksTable.competitionId, input.competitionId),
  })
  if (!track) {
    throw new Error("Competition track not found")
  }

  const uniqueIds = [...new Set(input.trackWorkoutIds)]
  if (uniqueIds.length < 2) {
    throw new Error("Select at least two events to group")
  }
  // trackOrder is decimal(6,2); sub-events occupy parentOrder + 0.01..0.99,
  // so more than 99 children would collide with the next top-level slot
  if (uniqueIds.length > 99) {
    throw new Error("Can't group more than 99 events under one parent")
  }

  const selected = await db
    .select({
      id: trackWorkoutsTable.id,
      parentEventId: trackWorkoutsTable.parentEventId,
      trackOrder: trackWorkoutsTable.trackOrder,
      eventStatus: trackWorkoutsTable.eventStatus,
      heatStatus: trackWorkoutsTable.heatStatus,
      scheme: workouts.scheme,
    })
    .from(trackWorkoutsTable)
    .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
    .where(
      and(
        inArray(trackWorkoutsTable.id, uniqueIds),
        eq(trackWorkoutsTable.trackId, track.id),
      ),
    )

  if (selected.length !== uniqueIds.length) {
    throw new Error(
      "One or more selected events were not found in this competition",
    )
  }
  if (selected.some((e) => e.parentEventId)) {
    throw new Error(
      "Sub-events can't be grouped — select top-level events only",
    )
  }

  const existingChildren = await db
    .select({ id: trackWorkoutsTable.id })
    .from(trackWorkoutsTable)
    .where(inArray(trackWorkoutsTable.parentEventId, uniqueIds))
    .limit(1)
  if (existingChildren.length > 0) {
    throw new Error(
      "Events that already have sub-events can't be grouped under another event",
    )
  }

  // Heats reference trackWorkoutId and are only scheduled for top-level events.
  // Grouping events with existing heats would orphan those heats.
  const existingHeats = await db
    .select({ id: competitionHeatsTable.id })
    .from(competitionHeatsTable)
    .where(inArray(competitionHeatsTable.trackWorkoutId, uniqueIds))
    .limit(1)
  if (existingHeats.length > 0) {
    throw new Error(
      "One or more selected events already have heats scheduled. Delete their heats first, then group them and schedule the parent event.",
    )
  }

  // Sub-events keep their current relative order
  const ordered = [...selected].sort(
    (a, b) => Number(a.trackOrder) - Number(b.trackOrder),
  )
  const first = ordered[0]
  if (!first) {
    throw new Error("Select at least two events to group")
  }
  // Parent takes the earliest selected event's slot
  const parentOrder = Math.floor(Number(first.trackOrder))

  // Parent status drives cascades, so only publish it when every grouped
  // event is already published
  const allPublished = ordered.every((e) => e.eventStatus === "published")
  const allHeatsPublished = ordered.every((e) => e.heatStatus === "published")

  const workoutId = `workout_${createId()}`
  const trackWorkoutId = createTrackWorkoutId()

  await db.transaction(async (tx) => {
    // Parent container workout — describes the multi-part event as a whole
    await tx.insert(workouts).values({
      id: workoutId,
      name: input.name,
      description: input.description ?? "",
      scheme: first.scheme,
      scoreType: null,
      teamId: input.organizingTeamId,
      scope: "private",
    })

    await tx.insert(trackWorkoutsTable).values({
      id: trackWorkoutId,
      trackId: track.id,
      workoutId,
      trackOrder: parentOrder,
      pointsMultiplier: 100,
      parentEventId: null,
      eventStatus: allPublished ? "published" : "draft",
      heatStatus: allHeatsPublished ? "published" : "draft",
    })

    // Re-parent the selected events as sub-events with decimal orders.
    // Children take the parent's status so a draft parent can't leave
    // previously published children visible in public queries.
    for (let i = 0; i < ordered.length; i++) {
      const child = ordered[i]
      if (!child) continue
      await tx
        .update(trackWorkoutsTable)
        .set({
          parentEventId: trackWorkoutId,
          trackOrder: Number((parentOrder + 0.01 * (i + 1)).toFixed(2)),
          eventStatus: allPublished ? "published" : "draft",
          updatedAt: new Date(),
        })
        .where(eq(trackWorkoutsTable.id, child.id))
    }

    // Renumber remaining top-level events sequentially to close the gaps the
    // grouped events left behind, shifting children with their parent
    const topLevel = await tx
      .select({
        id: trackWorkoutsTable.id,
        trackOrder: trackWorkoutsTable.trackOrder,
      })
      .from(trackWorkoutsTable)
      .where(
        and(
          eq(trackWorkoutsTable.trackId, track.id),
          isNull(trackWorkoutsTable.parentEventId),
        ),
      )
      .orderBy(asc(trackWorkoutsTable.trackOrder))

    for (let i = 0; i < topLevel.length; i++) {
      const event = topLevel[i]
      if (!event) continue
      const newOrder = i + 1
      if (Number(event.trackOrder) === newOrder) continue

      await tx
        .update(trackWorkoutsTable)
        .set({ trackOrder: newOrder, updatedAt: new Date() })
        .where(eq(trackWorkoutsTable.id, event.id))

      const children = await tx
        .select({ id: trackWorkoutsTable.id })
        .from(trackWorkoutsTable)
        .where(eq(trackWorkoutsTable.parentEventId, event.id))
        .orderBy(asc(trackWorkoutsTable.trackOrder))

      for (let j = 0; j < children.length; j++) {
        const child = children[j]
        if (!child) continue
        await tx
          .update(trackWorkoutsTable)
          .set({
            trackOrder: Number((newOrder + 0.01 * (j + 1)).toFixed(2)),
            updatedAt: new Date(),
          })
          .where(eq(trackWorkoutsTable.id, child.id))
      }
    }
  })

  return { workoutId, trackWorkoutId }
}
