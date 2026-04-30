/**
 * Pure entitlement-state computation for organizer routes.
 *
 * Given a session and the active-team cookie, decides whether the user has
 * a hosting team, which team is "active" for organizing, and whether the
 * active team is pending platform approval or fully approved.
 *
 * Kept side-effect free so it can be unit tested without the surrounding
 * server fn / cookie / KV machinery.
 */

import type { SessionValidationResult } from "@/types"

const HOST_COMPETITIONS_FEATURE = "host_competitions"
const PUBLISHED_COMP_LIMIT_KEY = "max_published_competitions"

export interface OrganizerEntitlementState {
  hasHostCompetitions: boolean
  isPendingApproval: boolean
  isApproved: boolean
  activeOrganizingTeamId: string | null
}

const NO_ENTITLEMENT: OrganizerEntitlementState = {
  hasHostCompetitions: false,
  isPendingApproval: false,
  isApproved: false,
  activeOrganizingTeamId: null,
}

/**
 * Compute the organizer entitlement state for a session.
 *
 * @param session - Validated session, or null when not authenticated.
 * @param cookieTeamId - Active-team cookie value, or null when unset.
 *   When the cookie points at a team that has HOST_COMPETITIONS, that team
 *   wins. Otherwise the first hosting team is used.
 */
export function computeOrganizerEntitlements(
  session: SessionValidationResult | null,
  cookieTeamId: string | null,
): OrganizerEntitlementState {
  if (!session?.teams?.length) {
    return NO_ENTITLEMENT
  }

  const teamsWithHostCompetitions = session.teams
    .filter((team) => team.plan?.features.includes(HOST_COMPETITIONS_FEATURE))
    .map((t) => t.id)

  const firstHostingTeam = teamsWithHostCompetitions[0]
  if (!firstHostingTeam) {
    return NO_ENTITLEMENT
  }

  const activeOrganizingTeamId =
    cookieTeamId && teamsWithHostCompetitions.includes(cookieTeamId)
      ? cookieTeamId
      : firstHostingTeam

  const activeTeam = session.teams.find((t) => t.id === activeOrganizingTeamId)
  const limit = activeTeam?.plan?.limits[PUBLISHED_COMP_LIMIT_KEY] ?? 0
  const isPendingApproval = limit === 0
  const isApproved = limit === -1 || limit > 0

  return {
    hasHostCompetitions: true,
    isPendingApproval,
    isApproved,
    activeOrganizingTeamId,
  }
}
