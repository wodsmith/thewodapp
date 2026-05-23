import "server-only"

import { and, eq } from "drizzle-orm"
import { FEATURES } from "@/config/features"
import { getDb } from "@/db"
import {
  competitionsTable,
  programmingTracksTable,
  ROLES_ENUM,
  SYSTEM_ROLES_ENUM,
  teamMembershipTable,
  teamRoleTable,
  trackWorkoutsTable,
  userTable,
} from "@/db/schema"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { hasFeature } from "@/server/entitlements"

export interface AiSchedulingScope {
  competitionId: string
  trackWorkoutId: string
  organizingTeamId: string
  competitionTeamId: string | null
}

/**
 * Resolve the competition/workout pair and prove the workout belongs to it.
 */
export async function loadAiSchedulingScope({
  competitionId,
  trackWorkoutId,
}: {
  competitionId: string
  trackWorkoutId: string
}): Promise<AiSchedulingScope> {
  const db = getDb()

  const [row] = await db
    .select({
      competitionId: competitionsTable.id,
      organizingTeamId: competitionsTable.organizingTeamId,
      competitionTeamId: competitionsTable.competitionTeamId,
      workoutCompetitionId: programmingTracksTable.competitionId,
      trackWorkoutId: trackWorkoutsTable.id,
    })
    .from(competitionsTable)
    .innerJoin(
      programmingTracksTable,
      eq(programmingTracksTable.competitionId, competitionsTable.id),
    )
    .innerJoin(
      trackWorkoutsTable,
      eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
    )
    .where(
      and(
        eq(competitionsTable.id, competitionId),
        eq(trackWorkoutsTable.id, trackWorkoutId),
      ),
    )

  if (!row || row.trackWorkoutId !== trackWorkoutId) {
    throw new Error("Track workout does not belong to this competition")
  }

  if (row.workoutCompetitionId !== competitionId) {
    throw new Error("Track workout does not belong to this competition")
  }

  return {
    competitionId: row.competitionId,
    trackWorkoutId: row.trackWorkoutId,
    organizingTeamId: row.organizingTeamId,
    competitionTeamId: row.competitionTeamId,
  }
}

/**
 * Authorize the current request for the organizer team that owns the event.
 */
export async function requireAiSchedulingTeamAccess({
  teamId,
  scope,
}: {
  teamId: string
  scope: AiSchedulingScope
}): Promise<void> {
  if (scope.organizingTeamId !== teamId) {
    throw new Error("Competition does not belong to this team")
  }

  const { requireTeamPermission } = await import("@/utils/team-auth")
  await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_COMPETITIONS)

  const entitled = await hasFeature(teamId, FEATURES.AI_JUDGE_SCHEDULING)
  if (!entitled) {
    throw new Error("Your plan does not include AI Judge Scheduling")
  }
}

/**
 * Agent entrypoint authorization: infer the organizer team from trusted DB
 * rows, then require the current request to manage that team.
 */
export async function requireAiSchedulingRequestAccess(input: {
  competitionId: string
  trackWorkoutId: string
}): Promise<AiSchedulingScope> {
  const scope = await loadAiSchedulingScope(input)
  await requireAiSchedulingTeamAccess({
    teamId: scope.organizingTeamId,
    scope,
  })
  return scope
}

/**
 * Durable Object agent authorization.
 *
 * Agent callables do not run inside TanStack Start's request AsyncLocalStorage,
 * so they cannot use requireTeamPermission/getSessionFromCookie. The Worker
 * WebSocket route already validates that the agent name ends in the current
 * session's user id; this function receives that user id and performs the same
 * team permission + entitlement checks directly from persistent data.
 */
export async function requireAiSchedulingAgentAccess(
  input: {
    competitionId: string
    trackWorkoutId: string
  },
  userId: string,
): Promise<AiSchedulingScope> {
  const scope = await loadAiSchedulingScope(input)
  const db = getDb()
  const user = await db.query.userTable.findFirst({
    where: eq(userTable.id, userId),
    columns: { id: true, role: true },
  })
  if (!user) {
    throw new Error("NOT_AUTHORIZED: Not authenticated")
  }

  if (user.role !== ROLES_ENUM.ADMIN) {
    const hasPermission = await userHasManageCompetitionsPermission({
      userId,
      teamId: scope.organizingTeamId,
    })
    if (!hasPermission) {
      throw new Error(
        "FORBIDDEN: You don't have the required permission in this team",
      )
    }
  }

  const entitled = await hasFeature(
    scope.organizingTeamId,
    FEATURES.AI_JUDGE_SCHEDULING,
  )
  if (!entitled) {
    throw new Error("Your plan does not include AI Judge Scheduling")
  }

  return scope
}

async function userHasManageCompetitionsPermission({
  userId,
  teamId,
}: {
  userId: string
  teamId: string
}): Promise<boolean> {
  const db = getDb()
  const membership = await db.query.teamMembershipTable.findFirst({
    where: and(
      eq(teamMembershipTable.userId, userId),
      eq(teamMembershipTable.teamId, teamId),
      eq(teamMembershipTable.isActive, true),
    ),
    columns: {
      roleId: true,
      isSystemRole: true,
    },
  })

  if (!membership) return false

  if (membership.isSystemRole) {
    return (
      membership.roleId === SYSTEM_ROLES_ENUM.OWNER ||
      membership.roleId === SYSTEM_ROLES_ENUM.ADMIN
    )
  }

  const role = await db.query.teamRoleTable.findFirst({
    where: and(
      eq(teamRoleTable.id, membership.roleId),
      eq(teamRoleTable.teamId, teamId),
    ),
    columns: { permissions: true },
  })

  return (
    role?.permissions.includes(TEAM_PERMISSIONS.MANAGE_COMPETITIONS) ?? false
  )
}
