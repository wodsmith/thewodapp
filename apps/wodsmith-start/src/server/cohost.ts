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
    divisions: metadata.divisions ?? DEFAULT_COHOST_PERMISSIONS.divisions,
    editEvents: (metadata as any).editEvents ?? (metadata as any).events ?? DEFAULT_COHOST_PERMISSIONS.editEvents,
    scoringConfig: metadata.scoringConfig ?? metadata.scoring ?? DEFAULT_COHOST_PERMISSIONS.scoringConfig,
    viewRegistrations: metadata.viewRegistrations ?? (metadata as any).registrations ?? DEFAULT_COHOST_PERMISSIONS.viewRegistrations,
    editRegistrations: metadata.editRegistrations ?? (metadata as any).registrations ?? DEFAULT_COHOST_PERMISSIONS.editRegistrations,
    waivers: metadata.waivers ?? DEFAULT_COHOST_PERMISSIONS.waivers,
    schedule: metadata.schedule ?? DEFAULT_COHOST_PERMISSIONS.schedule,
    locations: metadata.locations ?? DEFAULT_COHOST_PERMISSIONS.locations,
    volunteers: metadata.volunteers ?? DEFAULT_COHOST_PERMISSIONS.volunteers,
    results: metadata.results ?? DEFAULT_COHOST_PERMISSIONS.results,
    pricing: metadata.pricing ?? DEFAULT_COHOST_PERMISSIONS.pricing,
    revenue: metadata.revenue ?? DEFAULT_COHOST_PERMISSIONS.revenue,
    coupons: metadata.coupons ?? DEFAULT_COHOST_PERMISSIONS.coupons,
    sponsors: metadata.sponsors ?? DEFAULT_COHOST_PERMISSIONS.sponsors,
    inviteNotes: metadata.inviteNotes,
  }
}
