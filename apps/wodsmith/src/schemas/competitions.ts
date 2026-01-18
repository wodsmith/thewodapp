import { z } from "zod"

// Competition Group (Series) Schemas

export const createCompetitionGroupSchema = z.object({
	organizingTeamId: z.string().startsWith("team_", "Invalid team ID format"),
	name: z
		.string()
		.min(1, "Series name is required")
		.max(255, "Name is too long"),
	slug: z
		.string()
		.min(2, "Slug must be at least 2 characters")
		.max(255, "Slug is too long")
		.regex(
			/^[a-z0-9-]+$/,
			"Slug must be lowercase letters, numbers, and hyphens only",
		),
	description: z.string().max(1000, "Description is too long").optional(),
})

export const getCompetitionGroupsSchema = z.object({
	organizingTeamId: z.string().min(1, "Team ID is required"),
})

export const getCompetitionGroupSchema = z.object({
	groupId: z.string().startsWith("cgrp_", "Invalid group ID format"),
})

export const updateCompetitionGroupSchema = z.object({
	groupId: z.string().startsWith("cgrp_", "Invalid group ID format"),
	organizingTeamId: z.string().min(1, "Team ID is required"),
	name: z
		.string()
		.min(1, "Series name is required")
		.max(255, "Name is too long")
		.optional(),
	slug: z
		.string()
		.min(2, "Slug must be at least 2 characters")
		.max(255, "Slug is too long")
		.regex(
			/^[a-z0-9-]+$/,
			"Slug must be lowercase letters, numbers, and hyphens only",
		)
		.optional(),
	description: z
		.string()
		.max(1000, "Description is too long")
		.nullable()
		.optional(),
})

export const deleteCompetitionGroupSchema = z.object({
	groupId: z.string().startsWith("cgrp_", "Invalid group ID format"),
	organizingTeamId: z.string().min(1, "Team ID is required"),
})

// Competition Schemas

export const createCompetitionSchema = z
	.object({
		organizingTeamId: z.string().startsWith("team_", "Invalid team ID format"),
		name: z
			.string()
			.min(1, "Competition name is required")
			.max(255, "Name is too long"),
		slug: z
			.string()
			.min(2, "Slug must be at least 2 characters")
			.max(255, "Slug is too long")
			.regex(
				/^[a-z0-9-]+$/,
				"Slug must be lowercase letters, numbers, and hyphens only",
			),
		startDate: z.coerce.date({
			required_error: "Start date is required",
			invalid_type_error: "Invalid start date",
		}),
		endDate: z.coerce.date({
			required_error: "End date is required",
			invalid_type_error: "Invalid end date",
		}),
		description: z.string().max(2000, "Description is too long").optional(),
		registrationOpensAt: z.coerce.date().optional(),
		registrationClosesAt: z.coerce.date().optional(),
		groupId: z
			.string()
			.startsWith("cgrp_", "Invalid group ID format")
			.optional(),
		settings: z.string().max(10000, "Settings are too large").optional(),
	})
	.refine((data) => data.startDate <= data.endDate, {
		message: "End date cannot be before start date",
		path: ["endDate"],
	})
	.refine(
		(data) => {
			if (!data.registrationOpensAt || !data.registrationClosesAt) return true
			return data.registrationOpensAt < data.registrationClosesAt
		},
		{
			message: "Registration opening must be before closing",
			path: ["registrationClosesAt"],
		},
	)

export const getCompetitionsSchema = z.object({
	organizingTeamId: z.string().min(1, "Team ID is required"),
})

export const getCompetitionSchema = z.object({
	idOrSlug: z.string().min(1, "Competition ID or slug is required"),
})

export const updateCompetitionSchema = z
	.object({
		competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
		organizingTeamId: z.string().min(1, "Team ID is required"),
		name: z
			.string()
			.min(1, "Competition name is required")
			.max(255, "Name is too long")
			.optional(),
		slug: z
			.string()
			.min(2, "Slug must be at least 2 characters")
			.max(255, "Slug is too long")
			.regex(
				/^[a-z0-9-]+$/,
				"Slug must be lowercase letters, numbers, and hyphens only",
			)
			.optional(),
		startDate: z.coerce.date().optional(),
		endDate: z.coerce.date().optional(),
		description: z
			.string()
			.max(2000, "Description is too long")
			.nullable()
			.optional(),
		registrationOpensAt: z.coerce.date().nullable().optional(),
		registrationClosesAt: z.coerce.date().nullable().optional(),
		groupId: z
			.string()
			.startsWith("cgrp_", "Invalid group ID format")
			.nullable()
			.optional(),
		settings: z
			.string()
			.max(10000, "Settings are too large")
			.nullable()
			.optional(),
		visibility: z.enum(["public", "private"]).optional(),
		status: z.enum(["draft", "published"]).optional(),
		profileImageUrl: z.string().max(600).nullable().optional(),
		bannerImageUrl: z.string().max(600).nullable().optional(),
	})
	.refine(
		(data) => {
			if (!data.startDate || !data.endDate) return true
			return data.startDate <= data.endDate
		},
		{
			message: "End date cannot be before start date",
			path: ["endDate"],
		},
	)
	.refine(
		(data) => {
			if (!data.registrationOpensAt || !data.registrationClosesAt) return true
			return data.registrationOpensAt < data.registrationClosesAt
		},
		{
			message: "Registration opening must be before closing",
			path: ["registrationClosesAt"],
		},
	)

export const deleteCompetitionSchema = z.object({
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	organizingTeamId: z.string().min(1, "Team ID is required"),
})

// Registration Schemas

// Teammate input schema (for team registration)
export const teammateInputSchema = z.object({
	email: z.string().email("Invalid email address"),
	firstName: z.string().max(255).optional(),
	lastName: z.string().max(255).optional(),
	affiliateName: z.string().max(255).optional(),
})

export const registerForCompetitionSchema = z.object({
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	userId: z.string().startsWith("usr_", "Invalid user ID"),
	divisionId: z.string().startsWith("slvl_", "Invalid division ID"),
	// Team fields (validated based on division.teamSize in server)
	teamName: z.string().min(1).max(255).optional(),
	affiliateName: z.string().max(255).optional(),
	teammates: z.array(teammateInputSchema).optional(),
})

export const acceptTeamInviteSchema = z.object({
	inviteToken: z.string().min(1, "Invite token is required"),
	userId: z.string().startsWith("usr_", "Invalid user ID"),
})

export const getTeammateInviteSchema = z.object({
	inviteToken: z.string().min(1, "Invite token is required"),
})

export const getUserCompetitionRegistrationSchema = z.object({
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	userId: z.string().startsWith("usr_", "Invalid user ID"),
})

export const getCompetitionRegistrationsSchema = z.object({
	competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
	divisionId: z.string().startsWith("slvl_", "Invalid division ID").optional(),
})

export const cancelCompetitionRegistrationSchema = z.object({
	registrationId: z.string().startsWith("creg_", "Invalid registration ID"),
	userId: z.string().startsWith("usr_", "Invalid user ID"),
})

export const updateRegistrationAffiliateSchema = z.object({
	registrationId: z.string().startsWith("creg_", "Invalid registration ID"),
	userId: z.string().startsWith("usr_", "Invalid user ID"),
	affiliateName: z.string().max(255).nullable(),
})

// Type exports

export type CreateCompetitionGroupInput = z.infer<
	typeof createCompetitionGroupSchema
>
export type GetCompetitionGroupsInput = z.infer<
	typeof getCompetitionGroupsSchema
>
export type GetCompetitionGroupInput = z.infer<typeof getCompetitionGroupSchema>
export type UpdateCompetitionGroupInput = z.infer<
	typeof updateCompetitionGroupSchema
>
export type DeleteCompetitionGroupInput = z.infer<
	typeof deleteCompetitionGroupSchema
>

export type CreateCompetitionInput = z.infer<typeof createCompetitionSchema>
export type GetCompetitionsInput = z.infer<typeof getCompetitionsSchema>
export type GetCompetitionInput = z.infer<typeof getCompetitionSchema>
export type UpdateCompetitionInput = z.infer<typeof updateCompetitionSchema>
export type DeleteCompetitionInput = z.infer<typeof deleteCompetitionSchema>

export type TeammateInput = z.infer<typeof teammateInputSchema>
export type RegisterForCompetitionInput = z.infer<
	typeof registerForCompetitionSchema
>
export type AcceptTeamInviteInput = z.infer<typeof acceptTeamInviteSchema>
export type GetTeammateInviteInput = z.infer<typeof getTeammateInviteSchema>
export type GetUserCompetitionRegistrationInput = z.infer<
	typeof getUserCompetitionRegistrationSchema
>
export type GetCompetitionRegistrationsInput = z.infer<
	typeof getCompetitionRegistrationsSchema
>
export type CancelCompetitionRegistrationInput = z.infer<
	typeof cancelCompetitionRegistrationSchema
>
export type UpdateRegistrationAffiliateInput = z.infer<
	typeof updateRegistrationAffiliateSchema
>
