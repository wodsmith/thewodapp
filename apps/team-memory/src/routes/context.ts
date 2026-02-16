import { Hono } from "hono"
import { getDb } from "../db"
import type { Category, Priority } from "../db/schema"
import { getTopContext } from "../services/context"
import type { Env } from "../types"

export const contextRoutes = new Hono<{ Bindings: Env }>()

contextRoutes.get("/", async (c) => {
	const category = c.req.query("category") as Category | undefined
	const priority = c.req.query("priority") as Priority | undefined
	const limitParam = c.req.query("limit")
	const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined

	const db = getDb(c.env.DB)
	const result = await getTopContext(db, { category, priority, limit })

	return c.json(result)
})
