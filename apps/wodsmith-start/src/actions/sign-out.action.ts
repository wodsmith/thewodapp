"use server"

import {
	deleteSessionTokenCookie,
	getSessionFromCookie,
	invalidateSession,
} from "~/utils/auth"

export const signOutAction = async () => {
	const session = await getSessionFromCookie()

	if (!session) return

	await invalidateSession(session.id, session.userId)

	deleteSessionTokenCookie()
}
