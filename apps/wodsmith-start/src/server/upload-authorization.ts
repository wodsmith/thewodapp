/**
 * Upload Authorization Logic
 *
 * Handles permission checks for file uploads based on purpose and entity.
 */

import { eq } from "drizzle-orm"
import { getDb } from "@/db"
import { competitionsTable } from "@/db/schema"
import { competitionGroupsTable } from "@/db/schemas/competitions"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { hasTeamPermission } from "@/utils/team-auth"

export interface UploadAuthorizationResult {
  authorized: boolean
  error?: string
}

/**
 * Check if user has permission to upload for the given entity
 */
export async function checkUploadAuthorization(
  purpose: string,
  entityId: string | null,
  userId: string,
): Promise<UploadAuthorizationResult> {
  // Competition uploads require team permission
  if (purpose.startsWith("competition-") && entityId) {
    const db = getDb()
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, entityId),
    })
    if (!competition) {
      return { authorized: false, error: "Competition not found" }
    }
    const hasPermission = await hasTeamPermission(
      competition.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )
    if (!hasPermission) {
      return {
        authorized: false,
        error: "Not authorized to upload for this competition",
      }
    }
    return { authorized: true }
  }

  // Judging sheet uploads require team permission (entityId is competitionId or groupId)
  if (purpose === "judging-sheet") {
    if (!entityId) {
      return {
        authorized: false,
        error: "Competition or series group ID is required for judging sheet uploads",
      }
    }
    const db = getDb()

    // Try competition first
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, entityId),
    })

    let organizingTeamId: string | null = null

    if (competition) {
      organizingTeamId = competition.organizingTeamId
    } else {
      // Try series group (for template event judging sheets)
      const [group] = await db
        .select({ organizingTeamId: competitionGroupsTable.organizingTeamId })
        .from(competitionGroupsTable)
        .where(eq(competitionGroupsTable.id, entityId))
        .limit(1)
      if (group) {
        organizingTeamId = group.organizingTeamId
      }
    }

    if (!organizingTeamId) {
      return { authorized: false, error: "Competition or series group not found" }
    }

    const hasPermission = await hasTeamPermission(
      organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )
    if (!hasPermission) {
      return {
        authorized: false,
        error: "Not authorized to upload judging sheets",
      }
    }
    return { authorized: true }
  }

  // Athlete uploads can only be for the current user
  if (purpose.startsWith("athlete-") && entityId) {
    if (entityId !== userId) {
      return {
        authorized: false,
        error: "Not authorized to upload for this athlete",
      }
    }
    return { authorized: true }
  }

  // Sponsor uploads require entityId to be the user's own or not provided
  if (purpose === "sponsor-logo" && entityId && entityId !== userId) {
    return {
      authorized: false,
      error: "Not authorized to upload sponsor logo",
    }
  }

  return { authorized: true }
}
