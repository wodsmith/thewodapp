import "server-only"
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm"
import { getDb } from "@/db"
import {
  programmingTracksTable,
  TEAM_PERMISSIONS,
  teamMembershipTable,
  workouts,
} from "@/db/schema"
import { CROSSFIT_TRACK_ID } from "@/lib/crossfit/source"
import { requireWorkoutTeamWrite } from "@/server/workout-import/access"
import { getSessionFromCookie, requireAdmin } from "@/utils/auth"

function activeMembership(userId: string) {
  return and(
    eq(teamMembershipTable.userId, userId),
    eq(teamMembershipTable.isActive, true),
    or(
      isNull(teamMembershipTable.expiresAt),
      gt(teamMembershipTable.expiresAt, new Date()),
    ),
  )
}

// @lat: [[training-access#Training Access#Private reads]]
export async function workoutVisibilityCondition() {
  const session = await getSessionFromCookie()
  if (!session?.userId) return eq(workouts.scope, "public")
  return or(
    eq(workouts.scope, "public"),
    inArray(
      workouts.teamId,
      getDb()
        .select({ teamId: teamMembershipTable.teamId })
        .from(teamMembershipTable)
        .where(activeMembership(session.userId)),
    ),
  )
}

export async function requireTrainingTeamMember(teamId: string) {
  const session = await getSessionFromCookie()
  if (!session?.userId) throw new Error("Not authenticated")
  const membership = await getDb().query.teamMembershipTable.findFirst({
    where: and(
      activeMembership(session.userId),
      eq(teamMembershipTable.teamId, teamId),
    ),
    columns: { id: true },
  })
  if (!membership) throw new Error("Team access required")
}

export async function requireTrackRead(trackId: string) {
  const track = await getDb().query.programmingTracksTable.findFirst({
    where: eq(programmingTracksTable.id, trackId),
  })
  if (!track) throw new Error("Programming track not found")
  if (track.isPublic !== 1) {
    if (!track.ownerTeamId) throw new Error("Track access required")
    await requireTrainingTeamMember(track.ownerTeamId)
  }
  return track
}

// @lat: [[training-access#Training Access#Owner writes]]
export async function requireTrackWrite(trackId: string) {
  const session = await getSessionFromCookie()
  if (!session?.userId) throw new Error("Not authenticated")
  const db = getDb()
  const track = await db.query.programmingTracksTable.findFirst({
    where: eq(programmingTracksTable.id, trackId),
  })
  if (!track) throw new Error("Programming track not found")
  if (trackId === CROSSFIT_TRACK_ID) await requireAdmin()
  else {
    if (!track.ownerTeamId) throw new Error("Track has no editable owner team")
    await requireWorkoutTeamWrite(
      session.userId,
      track.ownerTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
      db,
    )
  }
  return track
}

export async function canReadWorkout(workoutId: string): Promise<boolean> {
  const workout = await getDb().query.workouts.findFirst({
    where: and(eq(workouts.id, workoutId), await workoutVisibilityCondition()),
    columns: { id: true },
  })
  return !!workout
}

export async function getActiveTrainingTeamIds(requestedIds: string[]) {
  const session = await getSessionFromCookie()
  if (!session?.userId) throw new Error("Not authenticated")
  if (!requestedIds.length) return []
  const memberships = await getDb()
    .select({ teamId: teamMembershipTable.teamId })
    .from(teamMembershipTable)
    .where(
      and(
        activeMembership(session.userId),
        inArray(teamMembershipTable.teamId, requestedIds),
      ),
    )
  return [...new Set(memberships.map((membership) => membership.teamId))]
}
