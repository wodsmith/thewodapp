import { createId } from "@paralleldrive/cuid2"
import { sql } from "drizzle-orm"
import { integer } from "drizzle-orm/sqlite-core"

export const commonColumns = {
	createdAt: integer({
		mode: "timestamp",
	})
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: integer({
		mode: "timestamp",
	})
		.$onUpdateFn(() => new Date())
		.notNull(),
	updateCounter: integer()
		.default(0)
		.$onUpdate(() => sql`updateCounter + 1`),
}

export const createDocumentId = () => `doc_${createId()}`
