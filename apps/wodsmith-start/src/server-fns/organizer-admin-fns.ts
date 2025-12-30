/**
 * Admin Server Functions for Organizer Request Management (TanStack Start)
 * These functions are restricted to site admins only
 */

import { ZSAError } from "@repo/zsa"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import {
	approveOrganizerRequest,
	getAllOrganizerRequests,
	getPendingOrganizerRequests,
	rejectOrganizerRequest,
} from "@/server/organizer-onboarding"
import { requireAdmin } from "@/utils/auth"

// ============================================================================
// Input Schemas
// ============================================================================

// Empty input schema - not currently used but kept for reference
// const emptyInputSchema = z.object({})

const approveRequestInputSchema = z.object({
	requestId: z.string().min(1, "Request ID is required"),
	adminNotes: z.string().max(2000, "Notes are too long").optional(),
})

const rejectRequestInputSchema = z.object({
	requestId: z.string().min(1, "Request ID is required"),
	adminNotes: z.string().max(2000, "Notes are too long").optional(),
	revokeFeature: z.boolean().default(false),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all pending organizer requests (admin only)
 */
export const getPendingOrganizerRequestsFn = createServerFn({
	method: "GET",
}).handler(async () => {
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

/**
 * Get all organizer requests with optional status filter (admin only)
 */
export const getAllOrganizerRequestsFn = createServerFn({
	method: "GET",
}).handler(async () => {
	await requireAdmin()

	try {
		const requests = await getAllOrganizerRequests({ statusFilter: "all" })
		return { success: true, data: requests }
	} catch (error) {
		console.error("Failed to get all organizer requests:", error)

		if (error instanceof ZSAError) {
			throw error
		}

		throw new ZSAError(
			"INTERNAL_SERVER_ERROR",
			"Failed to get all organizer requests",
		)
	}
})

/**
 * Approve an organizer request (admin only)
 */
export const approveOrganizerRequestFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => approveRequestInputSchema.parse(data))
	.handler(
		async ({ data }: { data: { requestId: string; adminNotes?: string } }) => {
			const admin = await requireAdmin()
			if (!admin) throw new ZSAError("FORBIDDEN", "Admin access required")

			try {
				const result = await approveOrganizerRequest({
					requestId: data.requestId,
					adminUserId: admin.user.id,
					adminNotes: data.adminNotes,
				})

				// Note: revalidatePath is Next.js specific, TanStack has different patterns
				// for cache invalidation if needed

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
		},
	)

/**
 * Reject an organizer request (admin only)
 */
export const rejectOrganizerRequestFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => rejectRequestInputSchema.parse(data))
	.handler(
		async ({
			data,
		}: {
			data: { requestId: string; adminNotes?: string; revokeFeature?: boolean }
		}) => {
			const admin = await requireAdmin()
			if (!admin) throw new ZSAError("FORBIDDEN", "Admin access required")

			try {
				const result = await rejectOrganizerRequest({
					requestId: data.requestId,
					adminUserId: admin.user.id,
					adminNotes: data.adminNotes,
					revokeFeature: data.revokeFeature ?? false,
				})

				// Note: revalidatePath is Next.js specific, TanStack has different patterns
				// for cache invalidation if needed

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
		},
	)
