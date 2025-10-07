import "server-only"
import { eq } from "drizzle-orm"
import { ZSAError } from "@repo/zsa"
import { getDd } from "@/db"
import { tags } from "@/db/schema"
import { createTagId } from "@/db/schemas/common"
import { requireVerifiedEmail } from "@/utils/auth"

/**
 * Get all tags available in the system
 */
export async function getAllTags() {
	const session = await requireVerifiedEmail()

	if (!session) {
		throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
	}

	const db = getDd()

	const allTags = await db.select().from(tags)

	return allTags
}

/**
 * Create a new tag if it doesn't exist, or return the existing one
 */
export async function findOrCreateTag(tagName: string) {
	const db = getDd()

	// First check if tag exists
	const existingTags = await db
		.select()
		.from(tags)
		.where(eq(tags.name, tagName))
		.limit(1)

	if (existingTags.length > 0) {
		return existingTags[0]
	}

	// Create new tag
	const newTag = await db
		.insert(tags)
		.values({
			id: createTagId(),
			name: tagName,
			// Let database defaults handle timestamps
			updateCounter: 0,
		})
		.returning()
		.get()

	return newTag
}
