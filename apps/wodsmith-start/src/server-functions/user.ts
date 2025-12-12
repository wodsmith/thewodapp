import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { getDb } from "~/db/index.server"
import { userTable } from "~/db/schema.server"
import { getUserFromDB, requireVerifiedEmail } from "~/utils/auth.server"

/**
 * Get the current user's profile data
 */
export const getUserFn = createServerFn("GET", async () => {
	try {
		// Get the current session and ensure user is authenticated
		const session = await requireVerifiedEmail()

		if (!session?.user?.id) {
			throw new Error("Not authenticated")
		}

		// Get the user data from the database
		const user = await getUserFromDB(session.user.id)

		if (!user) {
			throw new Error("User not found")
		}

		return { success: true, data: user }
	} catch (error) {
		console.error("Failed to get user:", error)
		throw error
	}
})
