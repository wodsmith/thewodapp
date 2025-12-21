import { createId } from "@paralleldrive/cuid2"

/**
 * Create a tenant context for multi-tenancy testing.
 * Returns team IDs and helpers for verifying isolation.
 * 
 * @example
 * ```ts
 * const { ownTeamId, otherTeamId, isOwnTeam } = createTenantContext()
 * 
 * // Create data for both teams
 * const ownData = createWorkout({ teamId: ownTeamId })
 * const otherData = createWorkout({ teamId: otherTeamId })
 * 
 * // Query should only return own team's data
 * const results = await getWorkouts(ownTeamId)
 * expect(results.every(isOwnTeam)).toBe(true)
 * ```
 */
export function createTenantContext() {
  const ownTeamId = createId()
  const otherTeamId = createId()

  return {
    ownTeamId,
    otherTeamId,
    isOwnTeam: (item: { teamId: string }) => item.teamId === ownTeamId,
    isOtherTeam: (item: { teamId: string }) => item.teamId === otherTeamId
  }
}

/**
 * Generate multiple team IDs for isolation testing.
 * 
 * @example
 * ```ts
 * const [team1, team2, team3] = generateTeamIds(3)
 * ```
 */
export function generateTeamIds(count: number): string[] {
  return Array(count).fill(null).map(() => createId())
}
