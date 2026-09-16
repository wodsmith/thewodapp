import {
  programmingTracksTable,
  teamMembershipTable,
  workouts,
} from "@repo/wodsmith-db/schema"
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm"
import type {
  TrainingDatabase,
  TrainingTransaction,
} from "./training-service-contract"

export function createTrainingReadAccess(
  db: TrainingDatabase | TrainingTransaction,
  userId?: string,
  allowedTeamIds?: readonly string[],
) {
  function activeMembership(userId: string) {
    return and(
      eq(teamMembershipTable.userId, userId),
      allowedTeamIds
        ? inArray(teamMembershipTable.teamId, [...allowedTeamIds])
        : undefined,
      eq(teamMembershipTable.isActive, true),
      or(
        isNull(teamMembershipTable.expiresAt),
        gt(teamMembershipTable.expiresAt, new Date()),
      ),
    )
  }

  // @lat: [[training-access#Training Access#Private reads]]
  async function workoutVisibilityCondition(includeArchived = false) {
    if (!userId)
      return and(
        includeArchived ? undefined : isNull(workouts.archivedAt),
        eq(workouts.scope, "public"),
      )
    return and(
      includeArchived ? undefined : isNull(workouts.archivedAt),
      or(
        eq(workouts.scope, "public"),
        inArray(
          workouts.teamId,
          db
            .select({ teamId: teamMembershipTable.teamId })
            .from(teamMembershipTable)
            .where(activeMembership(userId)),
        ),
      ),
    )
  }

  async function requireTrainingTeamMember(teamId: string) {
    if (!userId) throw new Error("Not authenticated")
    const membership = await db.query.teamMembershipTable.findFirst({
      where: and(
        activeMembership(userId),
        eq(teamMembershipTable.teamId, teamId),
      ),
      columns: { id: true },
    })
    if (!membership) throw new Error("Team access required")
  }

  async function requireTrackRead(trackId: string) {
    const track = await db.query.programmingTracksTable.findFirst({
      where: eq(programmingTracksTable.id, trackId),
    })
    if (!track) throw new Error("Programming track not found")
    if (track.isPublic !== 1) {
      if (!track.ownerTeamId) throw new Error("Track access required")
      await requireTrainingTeamMember(track.ownerTeamId)
    }
    return track
  }

  return {
    workoutVisibilityCondition,
    requireTrainingTeamMember,
    requireTrackRead,
  }
}
