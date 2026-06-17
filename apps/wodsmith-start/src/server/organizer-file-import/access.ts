import "server-only"

import { and, eq } from "drizzle-orm"
import { FEATURES } from "@/config/features"
import { getDb } from "@/db"
import {
  type AgentImportRun,
  agentImportRunsTable,
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

/**
 * Authorization for the organizer file-drop import feature.
 *
 * Mirrors src/server/judge-scheduler/access.ts: a request-context path
 * (`requireFileImportTeamAccess`, uses Start cookie helpers via
 * requireTeamPermission) and a Durable-Object path
 * (`requireFileImportAgentAccess`, DB-direct because DOs have no Start request
 * context). Both enforce competition ownership + MANAGE_COMPETITIONS + the
 * AI_FILE_IMPORT entitlement.
 */

export interface FileImportScope {
  competitionId: string
  organizingTeamId: string
  competitionTeamId: string | null
  routeKind: string
  eventId: string | null
}

export interface FileImportRunScope extends FileImportScope {
  createdByUserId: string
  run: AgentImportRun
}

/**
 * Resolve the competition (and, for event_detail, prove the event belongs to
 * it). Pure DB resolution — no session read, so it is safe to call from both
 * request and Durable Object contexts.
 */
export async function loadFileImportScope(input: {
  competitionId: string
  routeKind: string
  eventId?: string | null
}): Promise<FileImportScope> {
  const db = getDb()

  const [competition] = await db
    .select({
      id: competitionsTable.id,
      organizingTeamId: competitionsTable.organizingTeamId,
      competitionTeamId: competitionsTable.competitionTeamId,
    })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, input.competitionId))

  if (!competition) {
    throw new Error("Competition not found")
  }

  // When targeting a single event, prove the track workout is part of this
  // competition's programming track (prevents cross-competition event ids).
  if (input.eventId) {
    const [eventRow] = await db
      .select({ trackWorkoutId: trackWorkoutsTable.id })
      .from(trackWorkoutsTable)
      .innerJoin(
        programmingTracksTable,
        eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
      )
      .where(
        and(
          eq(trackWorkoutsTable.id, input.eventId),
          eq(programmingTracksTable.competitionId, competition.id),
        ),
      )
    if (!eventRow) {
      throw new Error("Event does not belong to this competition")
    }
  }

  return {
    competitionId: competition.id,
    organizingTeamId: competition.organizingTeamId,
    competitionTeamId: competition.competitionTeamId,
    routeKind: input.routeKind,
    eventId: input.eventId ?? null,
  }
}

/** Load an import run and re-resolve its scope from the competition. */
export async function loadFileImportScopeByRun(
  importRunId: string,
): Promise<FileImportRunScope> {
  const db = getDb()
  const run = await db.query.agentImportRunsTable.findFirst({
    where: eq(agentImportRunsTable.id, importRunId),
  })
  if (!run) {
    throw new Error("Import run not found")
  }
  const scope = await loadFileImportScope({
    competitionId: run.competitionId,
    routeKind: run.routeKind,
    eventId: run.eventId,
  })
  return { ...scope, createdByUserId: run.createdByUserId, run }
}

/**
 * Request-context authorization: the organizing team must match and the caller
 * must hold MANAGE_COMPETITIONS, and the team must be entitled to AI_FILE_IMPORT.
 */
export async function requireFileImportTeamAccess({
  teamId,
  scope,
}: {
  teamId: string
  scope: FileImportScope
}): Promise<void> {
  if (scope.organizingTeamId !== teamId) {
    throw new Error("Competition does not belong to this team")
  }
  const { requireTeamPermission } = await import("@/utils/team-auth")
  await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_COMPETITIONS)

  const entitled = await hasFeature(teamId, FEATURES.AI_FILE_IMPORT)
  if (!entitled) {
    throw new Error("Your plan does not include AI File Import")
  }
}

/**
 * Durable Object agent authorization.
 *
 * Agent callables do not run inside TanStack Start's request AsyncLocalStorage,
 * so they cannot use requireTeamPermission/getSessionFromCookie. The Worker
 * WebSocket route already validates that the agent name ends in the current
 * session's user id; this function receives that user id and performs the same
 * team-permission + entitlement checks directly from persistent data.
 */
export async function requireFileImportAgentAccess(
  input: { competitionId: string; routeKind: string; eventId?: string | null },
  userId: string,
): Promise<FileImportScope> {
  const scope = await loadFileImportScope(input)
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
    FEATURES.AI_FILE_IMPORT,
  )
  if (!entitled) {
    throw new Error("Your plan does not include AI File Import")
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
    columns: { roleId: true, isSystemRole: true },
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
