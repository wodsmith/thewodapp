"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createServerAction } from "@repo/zsa"
import { FEATURES } from "@/config/features"
import {
	checkCanUseAI,
	checkCanInviteMember,
	checkCanCreateProgrammingTrack,
} from "@/server/entitlements-checks"
import { grantTeamFeature, hasFeature } from "@/server/entitlements"
import { hasTeamPermission } from "@/utils/team-auth"
import { TEAM_PERMISSIONS } from "@/db/schema"

/**
 * Check if team can invite more members
 */
export const checkCanInviteMemberAction = createServerAction()
	.input(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
		}),
	)
	.handler(async ({ input }) => {
		const result = await checkCanInviteMember(input.teamId)
		return { success: true, data: result }
	})

/**
 * Check if team can create more programming tracks
 */
export const checkCanCreateProgrammingTrackAction = createServerAction()
	.input(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
		}),
	)
	.handler(async ({ input }) => {
		const result = await checkCanCreateProgrammingTrack(input.teamId)
		return { success: true, data: result }
	})

/**
 * Check if team can use AI features and get remaining usage
 */
export const checkCanUseAIAction = createServerAction()
	.input(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
		}),
	)
	.handler(async ({ input }) => {
		const result = await checkCanUseAI(input.teamId)
		return { success: true, data: result }
	})

/**
 * Enable competition organizing for a team
 * Grants the HOST_COMPETITIONS feature to the team
 */
export const enableCompetitionOrganizingAction = createServerAction()
	.input(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
		}),
	)
	.handler(async ({ input }) => {
		// Verify user has permission to manage this team
		const canManage = await hasTeamPermission(
			input.teamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		if (!canManage) {
			throw new Error("You don't have permission to manage this team")
		}

		// Grant the HOST_COMPETITIONS feature
		await grantTeamFeature(input.teamId, FEATURES.HOST_COMPETITIONS, "override")

		revalidatePath("/settings/teams")
		revalidatePath("/compete/organizer")

		return { success: true }
	})

/**
 * Check if a team has competition organizing enabled
 */
export const checkCompetitionOrganizingAction = createServerAction()
	.input(
		z.object({
			teamId: z.string().min(1, "Team ID is required"),
		}),
	)
	.handler(async ({ input }) => {
		const isEnabled = await hasFeature(input.teamId, FEATURES.HOST_COMPETITIONS)
		return { success: true, data: { isEnabled } }
	})
