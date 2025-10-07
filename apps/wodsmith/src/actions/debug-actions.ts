"use server"

import { createServerAction, ZSAError } from "@repo/zsa"
import { requireVerifiedEmail } from "@/utils/auth"

export const debugUserSessionAction = createServerAction().handler(async () => {
	try {
		const session = await requireVerifiedEmail()

		if (!session) {
			throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
		}

		// Return session data for debugging
		return {
			userId: session.user.id,
			userEmail: session.user.email,
			teams:
				session.teams?.map((team) => ({
					id: team.id,
					name: team.name,
					slug: team.slug,
					role: team.role,
					permissions: team.permissions,
				})) || [],
		}
	} catch (error) {
		console.error("Error in debugUserSessionAction:", error)
		throw error
	}
})
