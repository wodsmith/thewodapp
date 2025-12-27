/**
 * User Service Stub for TanStack Start PoC
 * This is a minimal implementation for auth flow testing.
 * Full implementation will be migrated from wodsmith app.
 */

import {getDb} from '@/db'
import {teamTable, teamMembershipTable} from '@/db/schema'
import {eq, and} from 'drizzle-orm'

/**
 * Get user's personal team ID
 */
export async function getUserPersonalTeamId(userId: string): Promise<string> {
  const db = getDb()

  const personalTeam = await db.query.teamTable.findFirst({
    where: and(
      eq(teamTable.isPersonalTeam, 1),
      eq(teamTable.personalTeamOwnerId, userId),
    ),
  })

  if (!personalTeam) {
    throw new Error('Personal team not found for user')
  }

  return personalTeam.id
}

/**
 * Create a personal team for a user
 * Note: This is now inlined in sign-up.tsx for the PoC
 * This function is kept for compatibility with other code paths
 */
export async function createPersonalTeamForUser(user: {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
}): Promise<{teamId: string}> {
  const db = getDb()

  const personalTeamName = `${user.firstName || 'Personal'}'s Team (personal)`
  const personalTeamSlug = `${
    user.firstName?.toLowerCase() || 'personal'
  }-${user.id.slice(-6)}`

  const personalTeamResult = await db
    .insert(teamTable)
    .values({
      name: personalTeamName,
      slug: personalTeamSlug,
      description:
        'Personal team for individual programming track subscriptions',
      isPersonalTeam: 1,
      personalTeamOwnerId: user.id,
    })
    .returning()

  const personalTeam = personalTeamResult[0]

  if (!personalTeam) {
    throw new Error('Failed to create personal team')
  }

  // Add the user as a member of their personal team
  await db.insert(teamMembershipTable).values({
    teamId: personalTeam.id,
    userId: user.id,
    roleId: 'owner',
    isSystemRole: 1,
    joinedAt: new Date(),
    isActive: 1,
  })

  return {teamId: personalTeam.id}
}
