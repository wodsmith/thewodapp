import { z } from "zod"

/**
 * Schema for creating a waiver
 */
export const createWaiverSchema = z.object({
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	teamId: z.string().startsWith("team_", "Invalid team ID"),
	title: z.string().min(1, "Title is required").max(255, "Title is too long"),
	content: z
		.string()
		.min(1, "Content is required")
		.max(50000, "Content is too long"),
	required: z.boolean().default(true),
})

/**
 * Schema for updating a waiver
 */
export const updateWaiverSchema = z.object({
	waiverId: z.string().startsWith("waiv_", "Invalid waiver ID"),
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	teamId: z.string().startsWith("team_", "Invalid team ID"),
	title: z
		.string()
		.min(1, "Title is required")
		.max(255, "Title is too long")
		.optional(),
	content: z
		.string()
		.min(1, "Content is required")
		.max(50000, "Content is too long")
		.optional(),
	required: z.boolean().optional(),
})

/**
 * Schema for deleting a waiver
 */
export const deleteWaiverSchema = z.object({
	waiverId: z.string().startsWith("waiv_", "Invalid waiver ID"),
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	teamId: z.string().startsWith("team_", "Invalid team ID"),
})

/**
 * Schema for reordering waivers
 */
export const reorderWaiversSchema = z.object({
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	teamId: z.string().startsWith("team_", "Invalid team ID"),
	waivers: z
		.array(
			z.object({
				id: z.string().startsWith("waiv_", "Invalid waiver ID"),
				position: z.number().int().min(0),
			}),
		)
		.min(1, "At least one waiver is required"),
})

/**
 * Schema for signing a waiver
 */
export const signWaiverSchema = z.object({
	waiverId: z.string().startsWith("waiv_", "Invalid waiver ID"),
	registrationId: z
		.string()
		.startsWith("creg_", "Invalid registration ID")
		.optional(),
	ipAddress: z.string().max(45).optional(), // IPv6 max length
})

/**
 * Schema for getting waiver signatures for a registration
 */
export const getWaiverSignaturesForRegistrationSchema = z.object({
	registrationId: z.string().startsWith("creg_", "Invalid registration ID"),
})

/**
 * Type exports
 */
export type CreateWaiverInput = z.infer<typeof createWaiverSchema>
export type UpdateWaiverInput = z.infer<typeof updateWaiverSchema>
export type DeleteWaiverInput = z.infer<typeof deleteWaiverSchema>
export type ReorderWaiversInput = z.infer<typeof reorderWaiversSchema>
export type SignWaiverInput = z.infer<typeof signWaiverSchema>
export type GetWaiverSignaturesForRegistrationInput = z.infer<
	typeof getWaiverSignaturesForRegistrationSchema
>
