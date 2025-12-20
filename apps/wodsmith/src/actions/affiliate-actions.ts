"use server"

import { createServerAction } from "@repo/zsa"
import { z } from "zod"
import { getTopAffiliates, searchAffiliates } from "@/server/affiliates"

/**
 * Search affiliates by name
 */
export const searchAffiliatesAction = createServerAction()
	.input(z.object({ query: z.string() }))
	.handler(async ({ input }) => {
		const affiliates = await searchAffiliates(input.query)
		return affiliates.map((a) => ({
			id: a.id,
			name: a.name,
			verificationStatus: a.verificationStatus,
			location: a.location,
		}))
	})

/**
 * Get initial affiliates for dropdown
 */
export const getTopAffiliatesAction = createServerAction()
	.input(z.object({}))
	.handler(async () => {
		return await getTopAffiliates()
	})
