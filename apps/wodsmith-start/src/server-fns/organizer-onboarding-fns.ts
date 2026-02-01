/**
 * Organizer Onboarding Server Functions for TanStack Start
 * Handles the workflow for teams to request and receive competition organizing access
 *
 * This file uses top-level imports for server-only modules.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"
import { FEATURES } from "@/config/features"
import { LIMITS } from "@/config/limits"
import { getDb } from "@/db"
import {
	ORGANIZER_REQUEST_STATUS,
	type OrganizerRequest,
	organizerRequestTable,
} from "@/db/schemas/organizer-requests"
import {
	SYSTEM_ROLES_ENUM,
	TEAM_PERMISSIONS,
	teamMembershipTable,
} from "@/db/schemas/teams"
import { ROLES_ENUM } from "@/db/schemas/users"
import {
	grantTeamFeature,
	setTeamLimitOverride,
} from "@/server/organizer-onboarding"
import { getSessionFromCookie } from "@/utils/auth"
import { updateAllSessionsOfUser } from "@/utils/kv-session"
import { validateTurnstileToken } from "@/utils/validate-captcha"

// ============================================================================
// Permission Helpers
// ============================================================================

/**
 * Check if user has permission for a team (or is a site admin)
 */
async function hasTeamPermission(
	teamId: string,
	permission: string,
): Promise<boolean> {
	const session = await getSessionFromCookie()
	if (!session?.userId) return false

	// Site admins have all permissions
	if (session.user?.role === ROLES_ENUM.ADMIN) return true

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
// Server Logic Functions (internal helpers)
// ============================================================================

/**
 * Submit an organizer request for a team
 * Grants HOST_COMPETITIONS feature immediately, but sets MAX_PUBLISHED_COMPETITIONS to 0
 * (pending approval)
 */
async function submitOrganizerRequestInternal({
	teamId,
	userId,
	reason,
}: {
	teamId: string
	userId: string
	reason: string
}): Promise<OrganizerRequest> {
	const db = getDb()

	// Check if there's already a pending request for this team
	const existingRequest = await db.query.organizerRequestTable.findFirst({
		where: and(
			eq(organizerRequestTable.teamId, teamId),
			eq(organizerRequestTable.status, ORGANIZER_REQUEST_STATUS.PENDING),
		),
	})

	if (existingRequest) {
		throw new Error("A pending organizer request already exists for this team")
	}

	// Check if already approved
	const approvedRequest = await db.query.organizerRequestTable.findFirst({
		where: and(
			eq(organizerRequestTable.teamId, teamId),
			eq(organizerRequestTable.status, ORGANIZER_REQUEST_STATUS.APPROVED),
		),
	})

	if (approvedRequest) {
		throw new Error("This team is already approved as an organizer")
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
		throw new Error("Failed to create organizer request")
	}

	// Grant HOST_COMPETITIONS feature (allows creating private competitions)
	await grantTeamFeature(teamId, FEATURES.HOST_COMPETITIONS)

	// Set MAX_PUBLISHED_COMPETITIONS to 0 (pending approval - can't publish yet)
	await setTeamLimitOverride(
		teamId,
		LIMITS.MAX_PUBLISHED_COMPETITIONS,
		0,
		"Organizer request pending approval",
	)

	// Refresh KV session cache to reflect the granted HOST_COMPETITIONS feature
	// This ensures route guards see the updated plan data immediately
	await updateAllSessionsOfUser(userId)

	return request
}

/**
 * Get the organizer request for a team (internal helper)
 */
async function getOrganizerRequestInternal(
	teamId: string,
): Promise<OrganizerRequest | null> {
	const db = getDb()

	// Get the most recent request for this team
	const request = await db.query.organizerRequestTable.findFirst({
		where: eq(organizerRequestTable.teamId, teamId),
		orderBy: desc(organizerRequestTable.createdAt),
	})

	return request ?? null
}

/**
 * Check if a team has a pending organizer request (internal helper)
 */
async function hasPendingOrganizerRequestInternal(
	teamId: string,
): Promise<boolean> {
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
 * Check if a team has an approved organizer request (internal helper)
 */
async function isApprovedOrganizerInternal(teamId: string): Promise<boolean> {
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

const teamIdSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

const submitOrganizerRequestSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	reason: z
		.string()
		.min(10, "Please provide more detail about why you want to organize")
		.max(2000, "Reason is too long"),
	captchaToken: z.string().optional(),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get the organizer request for a team
 */
export const getOrganizerRequest = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => teamIdSchema.parse(data))
	.handler(async ({ data }): Promise<OrganizerRequest | null> => {
		return getOrganizerRequestInternal(data.teamId)
	})

/**
 * Check if a team has a pending organizer request
 */
export const hasPendingOrganizerRequest = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => teamIdSchema.parse(data))
	.handler(async ({ data }): Promise<boolean> => {
		return hasPendingOrganizerRequestInternal(data.teamId)
	})

/**
 * Check if a team has an approved organizer request
 */
export const isApprovedOrganizer = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => teamIdSchema.parse(data))
	.handler(async ({ data }): Promise<boolean> => {
		return isApprovedOrganizerInternal(data.teamId)
	})

/**
 * Submit an organizer request for a team
 */
export const submitOrganizerRequestFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => submitOrganizerRequestSchema.parse(data))
	.handler(
		async ({ data }): Promise<{ success: boolean; data: OrganizerRequest }> => {
			// Validate turnstile token if provided
			if (data.captchaToken) {
				const isValidCaptcha = await validateTurnstileToken(data.captchaToken)
				if (!isValidCaptcha) {
					throw new Error("Invalid captcha. Please try again.")
				}
			}

			const session = await getSessionFromCookie()
			if (!session?.user) {
				throw new Error("You must be logged in")
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

			const result = await submitOrganizerRequestInternal({
				teamId: data.teamId,
				userId: session.user.id,
				reason: data.reason,
			})

			return { success: true, data: result }
		},
	)

/**
 * Get the organizer request status for a team
 */
export const getOrganizerRequestStatusFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => teamIdSchema.parse(data))
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
			const session = await getSessionFromCookie()
			if (!session?.user) {
				throw new Error("You must be logged in")
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
				const request = await getOrganizerRequestInternal(data.teamId)
				const isPending = await hasPendingOrganizerRequestInternal(data.teamId)
				const isApproved = await isApprovedOrganizerInternal(data.teamId)

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
				throw new Error("Failed to get organizer request status")
			}
		},
	)
