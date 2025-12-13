"use server"

import "server-only"
import { createServerAction, ZSAError } from "@repo/zsa"
import { getPostHogClient } from "@/lib/posthog-server"
import { teamInviteSchema } from "@/schemas/team-invite.schema"
import { acceptTeamInvitation } from "@/server/team-members"
import { getSessionFromCookie } from "@/utils/auth"
import { RATE_LIMITS, withRateLimit } from "@/utils/with-rate-limit"

export const acceptTeamInviteAction = createServerAction()
	.input(teamInviteSchema)
	.handler(async ({ input }) => {
		return withRateLimit(async () => {
			// Check if user is logged in
			const session = await getSessionFromCookie()

			if (!session) {
				throw new ZSAError(
					"NOT_AUTHORIZED",
					"You must be logged in to accept an invitation",
				)
			}

			try {
				const result = await acceptTeamInvitation(input.token)

				// Track team invite accepted event server-side
				if (session?.userId) {
					const posthog = getPostHogClient()
					posthog.capture({
						distinctId: session.userId,
						event: "team_invite_accepted",
						properties: {
							team_id: result.teamId,
							team_name: result.teamName,
						},
					})
				}

				return result
			} catch (error) {
				console.error("Error accepting team invitation:", error)

				if (error instanceof ZSAError) {
					throw error
				}

				throw new ZSAError(
					"INTERNAL_SERVER_ERROR",
					"An unexpected error occurred while accepting the invitation",
				)
			}
		}, RATE_LIMITS.EMAIL)
	})
