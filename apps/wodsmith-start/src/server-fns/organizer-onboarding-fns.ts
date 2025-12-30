/**
 * Organizer Onboarding Server Functions for TanStack Start
 * Handles the workflow for teams to request and receive competition organizing access
 *
 * IMPORTANT: All functions that access @/db must use dynamic imports to avoid
 * bundling cloudflare:workers into the client bundle.
 */

import {createServerFn} from '@tanstack/react-start'
import {z} from 'zod'
import {FEATURES} from '@/config/features'
import {LIMITS} from '@/config/limits'
import {
  ORGANIZER_REQUEST_STATUS,
  type OrganizerRequest,
} from '@/db/schemas/organizer-requests'
import {TEAM_PERMISSIONS} from '@/db/schemas/teams'

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
  const {getSessionFromCookie} = await import('@/utils/auth')
  const session = await getSessionFromCookie()
  if (!session?.userId) return false

  const team = session.teams?.find((t) => t.id === teamId)
  if (!team) return false

  return team.permissions.includes(permission)
}

/**
 * Check if user is team owner directly from database
 * This bypasses the cached session which may not include newly created teams
 */
async function isTeamOwnerFromDb(
  userId: string,
  teamId: string,
): Promise<boolean> {
  const {getDb} = await import('@/db')
  const {and, eq} = await import('drizzle-orm')
  const {SYSTEM_ROLES_ENUM, teamMembershipTable} = await import(
    '@/db/schemas/teams'
  )
  const db = getDb()
  const membership = await db.query.teamMembershipTable.findFirst({
    where: and(
      eq(teamMembershipTable.userId, userId),
      eq(teamMembershipTable.teamId, teamId),
      eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.OWNER),
      eq(teamMembershipTable.isSystemRole, 1),
    ),
  })
  return !!membership
}

// ============================================================================
// Server Logic Functions
// ============================================================================

/**
 * Submit an organizer request for a team
 * Grants HOST_COMPETITIONS feature immediately, but sets MAX_PUBLISHED_COMPETITIONS to 0
 * (pending approval)
 */
export async function submitOrganizerRequest({
  teamId,
  userId,
  reason,
}: {
  teamId: string
  userId: string
  reason: string
}): Promise<OrganizerRequest> {
  const {getDb} = await import('@/db')
  const {and, eq} = await import('drizzle-orm')
  const {organizerRequestTable} = await import(
    '@/db/schemas/organizer-requests'
  )
  const {grantTeamFeature, setTeamLimitOverride} = await import(
    '@/server/organizer-onboarding'
  )

  const db = getDb()

  // Check if there's already a pending request for this team
  const existingRequest = await db.query.organizerRequestTable.findFirst({
    where: and(
      eq(organizerRequestTable.teamId, teamId),
      eq(organizerRequestTable.status, ORGANIZER_REQUEST_STATUS.PENDING),
    ),
  })

  if (existingRequest) {
    throw new Error('A pending organizer request already exists for this team')
  }

  // Check if already approved
  const approvedRequest = await db.query.organizerRequestTable.findFirst({
    where: and(
      eq(organizerRequestTable.teamId, teamId),
      eq(organizerRequestTable.status, ORGANIZER_REQUEST_STATUS.APPROVED),
    ),
  })

  if (approvedRequest) {
    throw new Error('This team is already approved as an organizer')
  }

  // Create the request
  const [request] = await db
    .insert(organizerRequestTable)
    .values({
      teamId,
      userId,
      reason,
      status: ORGANIZER_REQUEST_STATUS.PENDING,
    })
    .returning()

  if (!request) {
    throw new Error('Failed to create organizer request')
  }

  // Grant HOST_COMPETITIONS feature (allows creating private competitions)
  await grantTeamFeature(teamId, FEATURES.HOST_COMPETITIONS)

  // Set MAX_PUBLISHED_COMPETITIONS to 0 (pending approval - can't publish yet)
  await setTeamLimitOverride(
    teamId,
    LIMITS.MAX_PUBLISHED_COMPETITIONS,
    0,
    'Organizer request pending approval',
  )

  return request
}

/**
 * Get the organizer request for a team
 */
export async function getOrganizerRequest(
  teamId: string,
): Promise<OrganizerRequest | null> {
  const {getDb} = await import('@/db')
  const {desc, eq} = await import('drizzle-orm')
  const {organizerRequestTable} = await import(
    '@/db/schemas/organizer-requests'
  )

  const db = getDb()

  // Get the most recent request for this team
  const request = await db.query.organizerRequestTable.findFirst({
    where: eq(organizerRequestTable.teamId, teamId),
    orderBy: desc(organizerRequestTable.createdAt),
  })

  return request ?? null
}

/**
 * Check if a team has a pending organizer request
 */
export async function hasPendingOrganizerRequest(
  teamId: string,
): Promise<boolean> {
  const {getDb} = await import('@/db')
  const {and, eq} = await import('drizzle-orm')
  const {organizerRequestTable} = await import(
    '@/db/schemas/organizer-requests'
  )

  const db = getDb()

  const request = await db.query.organizerRequestTable.findFirst({
    where: and(
      eq(organizerRequestTable.teamId, teamId),
      eq(organizerRequestTable.status, ORGANIZER_REQUEST_STATUS.PENDING),
    ),
  })

  return !!request
}

/**
 * Check if a team has an approved organizer request
 */
export async function isApprovedOrganizer(teamId: string): Promise<boolean> {
  const {getDb} = await import('@/db')
  const {and, eq} = await import('drizzle-orm')
  const {organizerRequestTable} = await import(
    '@/db/schemas/organizer-requests'
  )

  const db = getDb()

  const request = await db.query.organizerRequestTable.findFirst({
    where: and(
      eq(organizerRequestTable.teamId, teamId),
      eq(organizerRequestTable.status, ORGANIZER_REQUEST_STATUS.APPROVED),
    ),
  })

  return !!request
}

// ============================================================================
// Input Schemas
// ============================================================================

const submitOrganizerRequestSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
  reason: z
    .string()
    .min(10, 'Please provide more detail about why you want to organize')
    .max(2000, 'Reason is too long'),
  captchaToken: z.string().optional(),
})

const getOrganizerRequestStatusSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Submit an organizer request for a team
 */
export const submitOrganizerRequestFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) => submitOrganizerRequestSchema.parse(data))
  .handler(
    async ({data}): Promise<{success: boolean; data: OrganizerRequest}> => {
      const {validateTurnstileToken} = await import('@/utils/validate-captcha')
      const {getSessionFromCookie} = await import('@/utils/auth')

      // Validate turnstile token if provided
      if (data.captchaToken) {
        const isValidCaptcha = await validateTurnstileToken(data.captchaToken)
        if (!isValidCaptcha) {
          throw new Error('Invalid captcha. Please try again.')
        }
      }

      const session = await getSessionFromCookie()
      if (!session?.user) {
        throw new Error('You must be logged in')
      }

      // First try cached session permissions (fast path)
      let permission = await hasTeamPermission(
        data.teamId,
        TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
      )

      // If cached session doesn't have permission, check DB directly
      // This handles newly created teams where session hasn't refreshed yet
      if (!permission) {
        permission = await isTeamOwnerFromDb(session.user.id, data.teamId)
      }

      if (!permission) {
        throw new Error(
          "You don't have permission to submit an organizer request for this team",
        )
      }

      const result = await submitOrganizerRequest({
        teamId: data.teamId,
        userId: session.user.id,
        reason: data.reason,
      })

      return {success: true, data: result}
    },
  )

/**
 * Get the organizer request status for a team
 */
export const getOrganizerRequestStatusFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) =>
    getOrganizerRequestStatusSchema.parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      success: boolean
      data: {
        request: OrganizerRequest | null
        isPending: boolean
        isApproved: boolean
        hasNoRequest: boolean
      }
    }> => {
      const {getSessionFromCookie} = await import('@/utils/auth')

      const session = await getSessionFromCookie()
      if (!session?.user) {
        throw new Error('You must be logged in')
      }

      // Verify user has permission to access this team's data
      const permission = await hasTeamPermission(
        data.teamId,
        TEAM_PERMISSIONS.ACCESS_DASHBOARD,
      )
      if (!permission) {
        throw new Error("You don't have permission to access this team")
      }

      try {
        const request = await getOrganizerRequest(data.teamId)
        const isPending = await hasPendingOrganizerRequest(data.teamId)
        const isApproved = await isApprovedOrganizer(data.teamId)

        return {
          success: true,
          data: {
            request,
            isPending,
            isApproved,
            hasNoRequest: !request,
          },
        }
      } catch (_error) {
        throw new Error('Failed to get organizer request status')
      }
    },
  )
