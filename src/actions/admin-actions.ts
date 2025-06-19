"use server"

import { getAdminStats } from "@/server/admin-stats"
import { createServerAction } from "zsa"

/**
 * Server action to get admin dashboard statistics
 */
export const getAdminStatsAction = createServerAction().handler(async () => {
	const stats = await getAdminStats()
	return { success: true, data: stats }
})
