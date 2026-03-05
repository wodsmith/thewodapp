import { Hono } from "hono"
import { getDb } from "../db"
import type { Category, Priority } from "../db/schema"
import { getTopContext } from "../services/context"
import type { Env } from "../types"

export const contextRoutes = new Hono<{ Bindings: Env }>()

const VALID_CATEGORIES = ['convention', 'gotcha', 'debugging', 'architecture', 'workflow'] as const
const VALID_PRIORITIES = ['critical', 'moderate', 'ephemeral'] as const

contextRoutes.get("/", async (c) => {
	const categoryParam = c.req.query("category")
	const category = categoryParam && VALID_CATEGORIES.includes(categoryParam as Category) ? categoryParam as Category : undefined
	const priorityParam = c.req.query("priority")
	const priority = priorityParam && VALID_PRIORITIES.includes(priorityParam as Priority) ? priorityParam as Priority : undefined
	const limitParam = c.req.query("limit")
	const parsed = limitParam ? Number.parseInt(limitParam, 10) : undefined
	const limit = parsed && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined

	const db = getDb(c.env.DB)
	const result = await getTopContext(db, { category, priority, limit })

	return c.json(result)
})
