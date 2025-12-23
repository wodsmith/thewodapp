/**
 * Entitlements Service Stub for TanStack Start PoC
 * This is a minimal implementation for auth flow testing.
 * Full implementation will be migrated from wodsmith app.
 */

import {getDb} from '@/db'
import {entitlementTable} from '@/db/schema'
import {and, eq, gt, isNull, or} from 'drizzle-orm'

export interface Entitlement {
  id: string
  entitlementTypeId: string
  metadata: Record<string, any> | null
  expiresAt: Date | null
}

/**
 * Get user's active entitlements
 * Active = not soft-deleted (deletedAt is null) and not expired
 */
export async function getUserEntitlements(
  userId: string,
): Promise<Entitlement[]> {
  const db = getDb()

  const now = new Date()

  // entitlementTable uses deletedAt for soft deletes, not isActive
  const entitlements = await db.query.entitlementTable.findMany({
    where: and(
      eq(entitlementTable.userId, userId),
      isNull(entitlementTable.deletedAt),
      or(
        isNull(entitlementTable.expiresAt),
        gt(entitlementTable.expiresAt, now),
      ),
    ),
  })

  return entitlements.map((e) => ({
    id: e.id,
    entitlementTypeId: e.entitlementTypeId,
    metadata: e.metadata as Record<string, any> | null,
    expiresAt: e.expiresAt,
  }))
}

/**
 * Get team's plan with features and limits
 * Stub implementation - returns null for PoC (no plan)
 */
export async function getTeamPlan(teamId: string): Promise<{
  id: string
  name: string
  entitlements: {
    features: string[]
    limits: Record<string, number>
  }
} | null> {
  // For PoC, return a basic free plan
  return {
    id: 'free',
    name: 'Free',
    entitlements: {
      features: ['basic_access'],
      limits: {
        max_workouts: 100,
        max_team_members: 5,
      },
    },
  }
}
