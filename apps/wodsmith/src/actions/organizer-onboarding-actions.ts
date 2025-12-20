"use server"

import { createServerAction, ZSAError } from "@repo/zsa"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getDb } from "@/db"
import {
	SYSTEM_ROLES_ENUM,
	TEAM_PERMISSIONS,
	teamMembershipTable,
} from "@/db/schema"
import {
	getOrganizerRequest,
	hasPendingOrganizerRequest,
	isApprovedOrganizer,
	submitOrganizerRequest,
} from "@/server/organizer-onboarding"
import { getSessionFromCookie } from "@/utils/auth"
import { hasTeamPermission } from "@/utils/team-auth"
import { validateTurnstileToken } from "@/utils/validate-captcha"

const submitOrganizerRequestSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	reason: z
		.string()
		.min(10, "Please provide more detail about why you want to organize")
		.max(2000, "Reason is too long"),
	captchaToken: z.string().optional(),
})

const getOrganizerRequestStatusSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

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

/**
 * Submit an organizer request for a team
 */
export const submitOrganizerRequestAction = createServerAction()
	.input(submitOrganizerRequestSchema)
	.handler(async ({ input }) => {
		try {
			// Validate turnstile token
			if (input.captchaToken) {
				const isValidCaptcha = await validateTurnstileToken(input.captchaToken)
				if (!isValidCaptcha) {
					throw new ZSAError("FORBIDDEN", "Invalid captcha. Please try again.")
				}
			}

			const session = await getSessionFromCookie()
			if (!session?.user) {
				throw new ZSAError("NOT_AUTHORIZED", "You must be logged in")
			}

			// First try cached session permissions (fast path)
			let hasPermission = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
			)

			// If cached session doesn't have permission, check DB directly
			// This handles newly created teams where session hasn't refreshed yet
			if (!hasPermission) {
				hasPermission = await isTeamOwnerFromDb(session.user.id, input.teamId)
			}

			if (!hasPermission) {
				throw new ZSAError(
					"FORBIDDEN",
					"You don't have permission to submit an organizer request for this team",
				)
			}

			const result = await submitOrganizerRequest({
				teamId: input.teamId,
				userId: session.user.id,
				reason: input.reason,
			})

			revalidatePath("/compete/organizer")
			revalidatePath("/compete/organizer/onboard")

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to submit organizer request:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			if (error instanceof Error) {
				throw new ZSAError("INTERNAL_SERVER_ERROR", error.message)
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to submit organizer request",
			)
		}
	})

/**
 * Get the organizer request status for a team
 */
export const getOrganizerRequestStatusAction = createServerAction()
	.input(getOrganizerRequestStatusSchema)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session?.user) {
				throw new ZSAError("NOT_AUTHORIZED", "You must be logged in")
			}

			// Verify user has permission to access this team's data
			const hasPermission = await hasTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)
			if (!hasPermission) {
				throw new ZSAError(
					"FORBIDDEN",
					"You don't have permission to access this team",
				)
			}

			const request = await getOrganizerRequest(input.teamId)
			const isPending = await hasPendingOrganizerRequest(input.teamId)
			const isApproved = await isApprovedOrganizer(input.teamId)

			return {
				success: true,
				data: {
					request,
					isPending,
					isApproved,
					hasNoRequest: !request,
				},
			}
		} catch (error) {
			console.error("Failed to get organizer request status:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get organizer request status",
			)
		}
	})
