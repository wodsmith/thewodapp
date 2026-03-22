/**
 * Auth helper for cohost routes.
 * Separate from requireTeamPermission — checks cohost role on competition_event team.
 */
import type { CohostMembershipMetadata } from "@/db/schemas/cohost"
import { ROLES_ENUM } from "@/db/schemas/users"
import { getCohostPermissions } from "@/server/cohost"
import { getSessionFromCookie } from "@/utils/auth"

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
  permissionKey?: keyof CohostMembershipMetadata,
): Promise<CohostMembershipMetadata> {
  const session = await getSessionFromCookie()
  if (!session) {
    throw new Error("NOT_AUTHORIZED: Not authenticated")
  }

  // Site admin bypass
  if (session.user.role === ROLES_ENUM.ADMIN) {
    return {
      canViewRevenue: true,
      canEditCapacity: true,
      canEditScoring: true,
      canEditRotation: true,
      canManagePricing: true,
    }
  }

  const permissions = await getCohostPermissions(session, competitionTeamId)
  if (!permissions) {
    throw new Error("FORBIDDEN: Not a cohost for this competition")
  }

  if (permissionKey && !permissions[permissionKey]) {
    throw new Error(
      "FORBIDDEN: This action is not enabled for your cohost role",
    )
  }

  return permissions
}
