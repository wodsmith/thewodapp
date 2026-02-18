import { Hono } from "hono"
import { getDb } from "../db"
import type { Category, Priority } from "../db/schema"
import { trackRetrieval } from "../services/scoring"
import { semanticSearch } from "../services/search"
import type { Env } from "../types"

export const searchRoutes = new Hono<{ Bindings: Env }>()

searchRoutes.get("/", async (c) => {
	const q = c.req.query("q")
	if (!q) {
		return c.json({ error: "q parameter is required" }, 400)
	}

	const category = c.req.query("category") as Category | undefined
	const priority = c.req.query("priority") as Priority | undefined
	const limitParam = c.req.query("limit")
	const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 10
	const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10

	const response = await c.env.AI.run("@cf/baai/bge-small-en-v1.5", {
		text: [q],
	})
	if (!("data" in response) || !response.data) {
		return c.json({ error: "Failed to generate embedding" }, 500)
	}
	const embedding = response.data[0]

	const db = getDb(c.env.DB)
	const results = await semanticSearch(
		db,
		c.env.VECTORIZE,
		embedding,
		{
			category,
			priority,
		},
		limit,
	)

	const ids = results.map((r) => r.id)
	if (ids.length > 0) {
		await trackRetrieval(db, ids)
	}

	return c.json({ results })
})
