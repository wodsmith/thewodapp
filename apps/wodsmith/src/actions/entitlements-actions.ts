"use server"

import { z } from "zod"
import { createServerAction } from "@repo/zsa"
import {
	checkCanUseAI,
	checkCanInviteMember,
	checkCanCreateProgrammingTrack,
} from "@/server/entitlements-checks"

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
