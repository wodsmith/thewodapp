"use server"

import { createServerAction, ZSAError } from "@repo/zsa"
import { getAllTags } from "@/server/tags"

/**
 * Get all tags in the system
 */
export const getAllTagsAction = createServerAction().handler(async () => {
	try {
		const tags = await getAllTags()
		return { success: true, data: tags }
	} catch (error) {
		console.error("Failed to get all tags:", error)

		if (error instanceof ZSAError) {
			throw error
		}

		throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get all tags")
	}
})
