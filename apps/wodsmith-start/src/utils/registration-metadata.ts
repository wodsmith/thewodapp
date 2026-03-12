import { z } from "zod"

export const registrationMetadataSchema = z
	.object({
		affiliates: z.record(z.string(), z.string()).optional(),
	})
	.passthrough()

/**
 * Extract affiliate from registration metadata with runtime validation
 */
export function getAffiliate(
	metadata: string | null,
	userId: string,
): string | null {
	if (!metadata) return null
	try {
		const result = registrationMetadataSchema.safeParse(JSON.parse(metadata))
		if (!result.success) return null
		return result.data.affiliates?.[userId] ?? null
	} catch {
		return null
	}
}
