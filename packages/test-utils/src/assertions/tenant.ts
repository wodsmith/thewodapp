import type {FakeDatabase} from '../fakes/fake-db'

/**
 * Assert that a query only returns data for the specified team.
 * Use this to verify multi-tenant data isolation.
 *
 * @example
 * ```ts
 * await assertTenantIsolation(
 *   db,
 *   "workouts",
 *   myTeamId,
 *   () => getWorkoutsForTeam(myTeamId)
 * )
 * ```
 */
export async function assertTenantIsolation<T extends {teamId: string}>(
  _db: FakeDatabase<Record<string, Record<string, unknown>>>,
  tableName: string,
  expectedTeamId: string,
  queryFn: () => Promise<T[]> | T[],
): Promise<void> {
  const results = await queryFn()

  const violations = results.filter((r) => r.teamId !== expectedTeamId)

  if (violations.length > 0) {
    throw new Error(
      `Tenant isolation violation in ${tableName}: ` +
        `Found ${violations.length} records with wrong teamId. ` +
        `Expected: ${expectedTeamId}, Got: ${[...new Set(violations.map((v) => v.teamId))].join(', ')}`,
    )
  }
}

/**
 * Assert that a record is not accessible to a different team.
 * Verifies both that the owner CAN access the record and that
 * the attacker CANNOT access it.
 *
 * @example
 * ```ts
 * await assertRecordIsolation(
 *   (teamId) => getWorkoutById(workoutId, teamId),
 *   ownerTeamId,
 *   attackerTeamId
 * )
 * ```
 */
export async function assertRecordIsolation<T>(
  getRecord: (teamId: string) => Promise<T | null> | T | null,
  ownerTeamId: string,
  attackerTeamId: string,
): Promise<void> {
  // First verify the owner CAN access the record (prevents false positives)
  const ownerResult = await getRecord(ownerTeamId)
  if (ownerResult === null) {
    throw new Error(
      `Record isolation test invalid: Owner team ${ownerTeamId} ` +
        `cannot access the record. Ensure the record exists before testing isolation.`,
    )
  }

  // Then verify the attacker CANNOT access it
  const attackerResult = await getRecord(attackerTeamId)
  if (attackerResult !== null) {
    throw new Error(
      `Record isolation violation: Record owned by ${ownerTeamId} ` +
        `was accessible to team ${attackerTeamId}`,
    )
  }
}

/**
 * Assert that all items in a collection belong to the expected team.
 * Simpler version that doesn't require a database reference.
 *
 * @example
 * ```ts
 * const workouts = await getWorkouts(teamId)
 * assertAllBelongToTeam(workouts, teamId)
 * ```
 */
export function assertAllBelongToTeam<T extends {teamId: string}>(
  items: T[],
  expectedTeamId: string,
  entityName = 'records',
): void {
  const violations = items.filter((item) => item.teamId !== expectedTeamId)

  if (violations.length > 0) {
    throw new Error(
      `Tenant isolation violation: ${violations.length} ${entityName} ` +
        `do not belong to team ${expectedTeamId}. ` +
        `Found teams: ${[...new Set(violations.map((v) => v.teamId))].join(', ')}`,
    )
  }
}
