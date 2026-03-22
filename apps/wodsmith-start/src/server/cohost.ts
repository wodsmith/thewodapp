/**
 * Cohost helper functions.
 *
 * Fetches CohostMembershipMetadata from the database since session teams
 * do not include the metadata field.
 */

import { and, eq } from "drizzle-orm"
import { getDb } from "@/db"
import { SYSTEM_ROLES_ENUM, teamMembershipTable } from "@/db/schema"
import type { CohostMembershipMetadata } from "@/db/schemas/cohost"
import { DEFAULT_COHOST_PERMISSIONS } from "@/db/schemas/cohost"
import type { KVSession } from "@/utils/kv-session"

/**
 * Extract cohost permissions for a given competition team.
 * Checks session teams for cohost role, then queries DB for metadata
 * (session teams don't include the metadata field).
 * Returns null if user is not a cohost on that team.
 */
export async function getCohostPermissions(
  session: KVSession,
  competitionTeamId: string,
): Promise<CohostMembershipMetadata | null> {
  const team = session.teams?.find(
    (t) => t.id === competitionTeamId && t.role.id === "cohost",
  )
  if (!team) return null

  const db = getDb()
  const membership = await db.query.teamMembershipTable.findFirst({
    where: and(
      eq(teamMembershipTable.teamId, competitionTeamId),
      eq(teamMembershipTable.userId, session.userId),
      eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.COHOST),
      eq(teamMembershipTable.isSystemRole, true),
    ),
    columns: { metadata: true },
  })

  if (!membership) return null

  let metadata: Partial<CohostMembershipMetadata> = {}
  try {
    if (membership.metadata) {
      metadata = JSON.parse(membership.metadata) as Partial<CohostMembershipMetadata>
    }
  } catch {
    // Invalid metadata — use defaults
  }

  return {
    canViewRevenue: metadata.canViewRevenue ?? DEFAULT_COHOST_PERMISSIONS.canViewRevenue,
    canEditCapacity: metadata.canEditCapacity ?? DEFAULT_COHOST_PERMISSIONS.canEditCapacity,
    canEditScoring: metadata.canEditScoring ?? DEFAULT_COHOST_PERMISSIONS.canEditScoring,
    canEditRotation: metadata.canEditRotation ?? DEFAULT_COHOST_PERMISSIONS.canEditRotation,
    canManagePricing: metadata.canManagePricing ?? DEFAULT_COHOST_PERMISSIONS.canManagePricing,
    canManageVolunteers: metadata.canManageVolunteers ?? DEFAULT_COHOST_PERMISSIONS.canManageVolunteers,
    canManageEvents: metadata.canManageEvents ?? DEFAULT_COHOST_PERMISSIONS.canManageEvents,
    canManageHeats: metadata.canManageHeats ?? DEFAULT_COHOST_PERMISSIONS.canManageHeats,
    canManageResults: metadata.canManageResults ?? DEFAULT_COHOST_PERMISSIONS.canManageResults,
    canManageRegistrations: metadata.canManageRegistrations ?? DEFAULT_COHOST_PERMISSIONS.canManageRegistrations,
    inviteNotes: metadata.inviteNotes,
  }
}
