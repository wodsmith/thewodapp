/**
 * Cohost helper functions.
 *
 * Reads CohostMembershipMetadata from session team membership data.
 */

import type { CohostMembershipMetadata } from "@/db/schemas/cohost"
import { DEFAULT_COHOST_PERMISSIONS } from "@/db/schemas/cohost"
import type { KVSession } from "@/utils/kv-session"

/**
 * Extract cohost permissions from the session for a given competition team.
 * Returns null if user is not a cohost on that team.
 */
export function getCohostPermissions(
  session: KVSession,
  competitionTeamId: string,
): CohostMembershipMetadata | null {
  const team = session.teams?.find(
    (t) => t.id === competitionTeamId && t.role.id === "cohost",
  )
  if (!team) return null

  // Parse metadata from team membership
  // Cast team to include metadata field (present in KVSession.teams but tsgo may infer narrower type)
  const teamWithMeta = team as typeof team & { metadata?: Record<string, unknown> }
  const metadata = teamWithMeta.metadata as
    | Partial<CohostMembershipMetadata>
    | undefined

  return {
    canViewRevenue: metadata?.canViewRevenue ?? DEFAULT_COHOST_PERMISSIONS.canViewRevenue,
    canEditSettings: metadata?.canEditSettings ?? DEFAULT_COHOST_PERMISSIONS.canEditSettings,
    canManagePricing: metadata?.canManagePricing ?? DEFAULT_COHOST_PERMISSIONS.canManagePricing,
    inviteNotes: metadata?.inviteNotes,
  }
}
