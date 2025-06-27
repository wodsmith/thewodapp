import "server-only"
import { ZSAError } from "zsa"
import { getDB } from "@/db"
import { tags } from "@/db/schema"
import { requireVerifiedEmail } from "@/utils/auth"

/**
 * Get all tags available in the system
 */
export async function getAllTags() {
	const session = await requireVerifiedEmail()

	if (!session) {
		throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
	}

	const db = getDB()

	const allTags = await db.select().from(tags)

	return allTags
}
