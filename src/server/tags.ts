import "server-only"
import { ZSAError } from "zsa"
import { getDd } from "@/db"
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

	const db = getDd()

	const allTags = await db.select().from(tags)

	return allTags
}
