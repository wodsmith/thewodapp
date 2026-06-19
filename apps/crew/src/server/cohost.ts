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
import { parseCohostMetadata } from "@/db/schemas/cohost"
import type { KVSession } from "@/utils/kv-session"

/**
 * Extract cohost permissions for a given competition team.
 * Queries the DB directly because session.teams can be stale immediately after
 * invite acceptance. The DB membership is the source of truth.
 * Returns null if user is not a cohost on that team.
 */
export async function getCohostPermissions(
  session: KVSession,
  competitionTeamId: string,
): Promise<CohostMembershipMetadata | null> {
  const db = getDb()
  const membership = await db.query.teamMembershipTable.findFirst({
    where: and(
      eq(teamMembershipTable.teamId, competitionTeamId),
      eq(teamMembershipTable.userId, session.userId),
      eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.COHOST),
      eq(teamMembershipTable.isSystemRole, true),
      eq(teamMembershipTable.isActive, true),
    ),
    columns: { metadata: true },
  })

  if (!membership) return null

  return parseCohostMetadata(membership.metadata)
}
