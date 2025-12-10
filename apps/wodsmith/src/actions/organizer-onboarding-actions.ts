"use server"

import { z } from "zod"
import { createServerAction, ZSAError } from "@repo/zsa"
import { revalidatePath } from "next/cache"
import {
	getOrganizerRequest,
	hasPendingOrganizerRequest,
	isApprovedOrganizer,
	submitOrganizerRequest,
} from "@/server/organizer-onboarding"
import { getSessionFromCookie } from "@/utils/auth"
import { hasTeamPermission } from "@/utils/team-auth"
import { TEAM_PERMISSIONS } from "@/db/schema"

const submitOrganizerRequestSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	reason: z
		.string()
		.min(10, "Please provide more detail about why you want to organize")
		.max(2000, "Reason is too long"),
})

const getOrganizerRequestStatusSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

/**
 * Submit an organizer request for a team
 */
export const submitOrganizerRequestAction = createServerAction()
	.input(submitOrganizerRequestSchema)
	.handler(async ({ input }) => {
		try {
			const session = await getSessionFromCookie()
			if (!session?.user) {
				throw new ZSAError("UNAUTHORIZED", "You must be logged in")
			}

			// Check if user has permission to manage the team
			const hasPermission = await hasTeamPermission(
				session.user.id,
				input.teamId,
				TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS,
			)

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
				throw new ZSAError("UNAUTHORIZED", "You must be logged in")
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
