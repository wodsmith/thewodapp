import {getSessionFromCookie} from '@/utils/auth'

// ============================================================================
// Permission Helpers
// ============================================================================
/**
 * Check if user has permission for a team
 */

async function hasTeamPermission(
  teamId: string,
  permission: string,
): Promise<boolean> {
  const session = await getSessionFromCookie()
  if (!session?.userId) return false

  const team = session.teams?.find((t) => t.id === teamId)
  if (!team) return false

  return team.permissions.includes(permission)
}
/**
 * Require team permission or throw error
 */
export async function requireTeamPermission(
  teamId: string,
  permission: string,
): Promise<void> {
  const hasPermission = await hasTeamPermission(teamId, permission)
  if (!hasPermission) {
    throw new Error(`Missing required permission: ${permission}`)
  }
}
/**
 * Require team membership (any role)
 */
export async function requireTeamMembership(teamId: string): Promise<void> {
  const session = await getSessionFromCookie()
  if (!session?.userId) {
    throw new Error('Not authenticated')
  }

  const team = session.teams?.find((t) => t.id === teamId)
  if (!team) {
    throw new Error('Not a member of this team')
  }
}
