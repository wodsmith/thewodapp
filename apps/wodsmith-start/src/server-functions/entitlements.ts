import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { FEATURES, LIMITS } from "@/constants"
import { requireTeamPermission } from "@/utils/team-auth.server"
import {
	checkCanUseAI,
	checkCanInviteMember,
	checkCanCreateProgrammingTrack,
} from "@/server/entitlements-checks.server"
import { grantTeamFeature, hasFeature } from "@/server/entitlements.server"
import type { TeamMembership } from "@/db/schemas/teams.server"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams.server"

/* -------------------------------------------------------------------------- */
/*                        Entitlements Schemas                                */
/* -------------------------------------------------------------------------- */

const checkCanInviteMemberSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

const checkCanCreateProgrammingTrackSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

const checkCanUseAISchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

const enableCompetitionOrganizingSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

const checkCompetitionOrganizingSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

/* -------------------------------------------------------------------------- */
/*                        Entitlements Functions                              */
/* -------------------------------------------------------------------------- */

/**
 * Check if team can invite more members
 */
export const checkCanInviteMemberFn = createServerFn({ method: "POST" })
	// @ts-ignore - validator method exists at runtime
	.validator(checkCanInviteMemberSchema)
	.handler(async ({ data: input }) => {
		try {
			const result = await checkCanInviteMember(input.teamId)
			return { success: true, data: result }
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error"
			return { success: false, error: message }
		}
	})

/**
 * Check if team can create more programming tracks
 */
export const checkCanCreateProgrammingTrackFn = createServerFn({
	method: "POST",
})
	// @ts-ignore - validator method exists at runtime
	.validator(checkCanCreateProgrammingTrackSchema)
	.handler(async ({ data: input }) => {
		try {
			const result = await checkCanCreateProgrammingTrack(input.teamId)
			return { success: true, data: result }
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error"
			return { success: false, error: message }
		}
	})

/**
 * Check if team can use AI features and get remaining usage
 */
export const checkCanUseAIFn = createServerFn({ method: "POST" })
	// @ts-ignore - validator method exists at runtime
	.validator(checkCanUseAISchema)
	.handler(async ({ data: input }) => {
		try {
			const result = await checkCanUseAI(input.teamId)
			return { success: true, data: result }
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error"
			return { success: false, error: message }
		}
	})

/**
 * Enable competition organizing for a team
 * Grants the HOST_COMPETITIONS feature to the team
 */
export const enableCompetitionOrganizingFn = createServerFn({
	method: "POST",
})
	// @ts-ignore - validator method exists at runtime
	.validator(enableCompetitionOrganizingSchema)
	.handler(async ({ data: input }) => {
		try {
			// Verify user has permission to manage this team
			const canManage = await requireTeamPermission(
				input.teamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (!canManage) {
				return {
					success: false,
					error: "You don't have permission to manage this team",
				}
			}

			// Grant the HOST_COMPETITIONS feature
			await grantTeamFeature(
				input.teamId,
				FEATURES.HOST_COMPETITIONS,
				"override",
			)

			return { success: true }
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error"
			return { success: false, error: message }
		}
	})

/**
 * Check if a team has competition organizing enabled
 */
export const checkCompetitionOrganizingFn = createServerFn({
	method: "POST",
})
	// @ts-ignore - validator method exists at runtime
	.validator(checkCompetitionOrganizingSchema)
	.handler(async ({ data: input }) => {
		try {
			const isEnabled = await hasFeature(
				input.teamId,
				FEATURES.HOST_COMPETITIONS,
			)
			return { success: true, data: { isEnabled } }
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error"
			return { success: false, error: message }
		}
	})
