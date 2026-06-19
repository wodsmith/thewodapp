/**
 * Auth helper for cohost routes.
 * Separate from requireTeamPermission — checks cohost role on competition_event team.
 */
import type { CohostMembershipMetadata } from "@/db/schemas/cohost"
import { competitionsTable } from "@/db/schemas/competitions"
import { ROLES_ENUM } from "@/db/schemas/users"
import { getDb } from "@/db"
import { getCohostPermissions } from "@/server/cohost"
import { getSessionFromCookie } from "@/utils/auth"
import { and, eq } from "drizzle-orm"

/**
 * Require cohost access to a competition.
 * - Site admins bypass all checks
 * - Checks for cohost membership on the competition_event team
 * - If permissionKey provided, checks that specific permission is true
 * - Returns the cohost permissions metadata
 *
 * Throws FORBIDDEN if not authorized.
 */
export async function requireCohostPermission(
  competitionTeamId: string,
  permissionKey?:
    | keyof CohostMembershipMetadata
    | Array<keyof CohostMembershipMetadata>,
): Promise<CohostMembershipMetadata> {
  const session = await getSessionFromCookie()
  if (!session) {
    throw new Error("NOT_AUTHORIZED: Not authenticated")
  }

  // Site admin bypass
  if (session.user.role === ROLES_ENUM.ADMIN) {
    return {
      divisions: true,
      editEvents: true,
      scoringConfig: true,
      viewRegistrations: true,
      editRegistrations: true,
      waivers: true,
      schedule: true,
      locations: true,
      volunteers: true,
      results: true,
      leaderboardPreview: true,
      pricing: true,
      revenue: true,
      coupons: true,
      sponsors: true,
    }
  }

  const permissions = await getCohostPermissions(session, competitionTeamId)
  if (!permissions) {
    throw new Error("FORBIDDEN: Not a cohost for this competition")
  }

  if (permissionKey) {
    const keys = Array.isArray(permissionKey) ? permissionKey : [permissionKey]
    const hasAny = keys.some((k) => permissions[k])
    if (!hasAny) {
      throw new Error(
        "FORBIDDEN: This action is not enabled for your cohost role",
      )
    }
  }

  return permissions
}

/**
 * Verify that a competitionId actually belongs to the given competitionTeamId.
 * Call this after requireCohostPermission when the handler receives both IDs.
 * Throws FORBIDDEN if the competition doesn't belong to the team.
 */
export async function requireCohostCompetitionOwnership(
  competitionTeamId: string,
  competitionId: string,
): Promise<void> {
  const db = getDb()
  const [competition] = await db
    .select({ id: competitionsTable.id })
    .from(competitionsTable)
    .where(
      and(
        eq(competitionsTable.id, competitionId),
        eq(competitionsTable.competitionTeamId, competitionTeamId),
      ),
    )
    .limit(1)

  if (!competition) {
    throw new Error(
      "FORBIDDEN: Competition does not belong to this team",
    )
  }
}
