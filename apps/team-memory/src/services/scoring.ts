import { inArray, sql } from "drizzle-orm"
import type { Database } from "../db"
import { observations } from "../db/schema"

export async function trackRetrieval(
	db: Database,
	ids: string[],
): Promise<void> {
	if (ids.length === 0) return

	await db
		.update(observations)
		.set({
			retrievalCount: sql`${observations.retrievalCount} + 1`,
			updatedAt: sql`(datetime('now'))`,
		})
		.where(inArray(observations.id, ids))
}
