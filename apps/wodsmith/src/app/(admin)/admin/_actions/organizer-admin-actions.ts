"use server"

/**
 * Admin actions for managing organizer requests
 * These actions are restricted to site admins only
 */

import { createServerAction, ZSAError } from "@repo/zsa"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import {
	approveOrganizerRequest,
	getPendingOrganizerRequests,
	rejectOrganizerRequest,
} from "@/server/organizer-onboarding"
import { requireAdmin } from "@/utils/auth"

/**
 * Get all pending organizer requests (admin only)
 */
export const getPendingOrganizerRequestsAction = createServerAction()
	.input(z.object({}))
	.handler(async () => {
		await requireAdmin()

		try {
			const requests = await getPendingOrganizerRequests()
			return { success: true, data: requests }
		} catch (error) {
			console.error("Failed to get pending organizer requests:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get pending organizer requests",
			)
		}
	})

const approveRequestSchema = z.object({
	requestId: z.string().min(1, "Request ID is required"),
	adminNotes: z.string().max(2000, "Notes are too long").optional(),
})

/**
 * Approve an organizer request (admin only)
 */
export const approveOrganizerRequestAction = createServerAction()
	.input(approveRequestSchema)
	.handler(async ({ input }) => {
		const admin = await requireAdmin()
		if (!admin) throw new ZSAError("FORBIDDEN", "Admin access required")

		try {
			const result = await approveOrganizerRequest({
				requestId: input.requestId,
				adminUserId: admin.user.id,
				adminNotes: input.adminNotes,
			})

			revalidatePath("/admin/organizer-requests")
			revalidatePath("/compete/organizer")

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to approve organizer request:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			if (error instanceof Error) {
				throw new ZSAError("INTERNAL_SERVER_ERROR", error.message)
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to approve organizer request",
			)
		}
	})

const rejectRequestSchema = z.object({
	requestId: z.string().min(1, "Request ID is required"),
	adminNotes: z.string().max(2000, "Notes are too long").optional(),
	revokeFeature: z.boolean().default(false),
})

/**
 * Reject an organizer request (admin only)
 */
export const rejectOrganizerRequestAction = createServerAction()
	.input(rejectRequestSchema)
	.handler(async ({ input }) => {
		const admin = await requireAdmin()
		if (!admin) throw new ZSAError("FORBIDDEN", "Admin access required")

		try {
			const result = await rejectOrganizerRequest({
				requestId: input.requestId,
				adminUserId: admin.user.id,
				adminNotes: input.adminNotes,
				revokeFeature: input.revokeFeature,
			})

			revalidatePath("/admin/organizer-requests")
			revalidatePath("/compete/organizer")

			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to reject organizer request:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			if (error instanceof Error) {
				throw new ZSAError("INTERNAL_SERVER_ERROR", error.message)
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to reject organizer request",
			)
		}
	})
