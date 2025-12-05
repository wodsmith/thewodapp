import { z } from "zod"

// Sponsor Group schemas
export const createSponsorGroupSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	name: z.string().min(1, "Name is required").max(100),
	displayOrder: z.number().int().min(0).optional(),
})

export const updateSponsorGroupSchema = z.object({
	groupId: z.string().min(1, "Group ID is required"),
	competitionId: z.string().min(1, "Competition ID is required"),
	name: z.string().min(1, "Name is required").max(100).optional(),
	displayOrder: z.number().int().min(0).optional(),
})

export const deleteSponsorGroupSchema = z.object({
	groupId: z.string().min(1, "Group ID is required"),
	competitionId: z.string().min(1, "Competition ID is required"),
})

export const reorderSponsorGroupsSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	groupIds: z.array(z.string()).min(1, "Group IDs are required"),
})

// Sponsor schemas
export const createSponsorSchema = z.object({
	// One of these is required
	competitionId: z.string().optional(),
	userId: z.string().optional(),
	// Optional group (only for competition sponsors)
	groupId: z.string().optional(),
	name: z.string().min(1, "Name is required").max(255),
	logoUrl: z.string().max(600).optional(),
	website: z.string().url().max(600).optional().or(z.literal("")),
	displayOrder: z.number().int().min(0).optional(),
})

export const updateSponsorSchema = z.object({
	sponsorId: z.string().min(1, "Sponsor ID is required"),
	// For authorization
	competitionId: z.string().optional(),
	userId: z.string().optional(),
	// Updateable fields
	groupId: z.string().nullable().optional(),
	name: z.string().min(1, "Name is required").max(255).optional(),
	logoUrl: z.string().max(600).nullable().optional(),
	website: z.string().url().max(600).optional().or(z.literal("")).nullable(),
	displayOrder: z.number().int().min(0).optional(),
})

export const deleteSponsorSchema = z.object({
	sponsorId: z.string().min(1, "Sponsor ID is required"),
	// For authorization
	competitionId: z.string().optional(),
	userId: z.string().optional(),
})

export const reorderSponsorsSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	// Map of sponsorId -> { groupId (nullable), displayOrder }
	sponsorOrders: z.array(
		z.object({
			sponsorId: z.string().min(1),
			groupId: z.string().nullable(),
			displayOrder: z.number().int().min(0),
		}),
	),
})

// Workout sponsor assignment
export const assignWorkoutSponsorSchema = z.object({
	trackWorkoutId: z.string().min(1, "Track Workout ID is required"),
	competitionId: z.string().min(1, "Competition ID is required"),
	sponsorId: z.string().nullable(), // null to remove sponsor
})

// Type exports
export type CreateSponsorGroupInput = z.infer<typeof createSponsorGroupSchema>
export type UpdateSponsorGroupInput = z.infer<typeof updateSponsorGroupSchema>
export type DeleteSponsorGroupInput = z.infer<typeof deleteSponsorGroupSchema>
export type ReorderSponsorGroupsInput = z.infer<
	typeof reorderSponsorGroupsSchema
>

export type CreateSponsorInput = z.infer<typeof createSponsorSchema>
export type UpdateSponsorInput = z.infer<typeof updateSponsorSchema>
export type DeleteSponsorInput = z.infer<typeof deleteSponsorSchema>
export type ReorderSponsorsInput = z.infer<typeof reorderSponsorsSchema>

export type AssignWorkoutSponsorInput = z.infer<
	typeof assignWorkoutSponsorSchema
>
