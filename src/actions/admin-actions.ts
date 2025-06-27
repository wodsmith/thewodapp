"use server"

import { createServerAction } from "zsa"
import { getAdminStats } from "@/server/admin-stats"

/**
 * Server action to get admin dashboard statistics
 */
export const getAdminStatsAction = createServerAction().handler(async () => {
	const stats = await getAdminStats()
	return { success: true, data: stats }
})
