import "server-only"

import { eq } from "drizzle-orm"
import { notFound, redirect } from "next/navigation"
import { cache } from "react"
import { getDb } from "@/db"
import { teamTable } from "@/db/schema"
import { getActiveOrPersonalTeamId, getSessionFromCookie } from "@/utils/auth"

/**
 * Get the admin team context from session.
 * Used by all team admin pages to get the active team.
 * Redirects to sign-in if not authenticated.
 * Returns notFound if team doesn't exist.
 */
export const getAdminTeamContext = cache(async () => {
	const session = await getSessionFromCookie()
	if (!session?.userId) {
		redirect("/sign-in")
	}

	const teamId = await getActiveOrPersonalTeamId(session.userId)
	const db = getDb()

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
	})

	if (!team) {
		notFound()
	}

	return { teamId, team, session }
})
