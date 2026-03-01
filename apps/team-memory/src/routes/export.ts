import { Hono } from "hono"
import { getDb } from "../db"
import { exportCoreMemory } from "../services/export"
import type { Env } from "../types"

export const exportRoutes = new Hono<{ Bindings: Env }>()

exportRoutes.get("/", async (c) => {
	const thresholdParam = c.req.query("scoreThreshold")
	const parsed = thresholdParam ? Number.parseFloat(thresholdParam) : NaN
	const scoreThreshold = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0.5

	const db = getDb(c.env.DB)
	const markdown = await exportCoreMemory(db, scoreThreshold)

	return c.text(markdown, 200, {
		"Content-Type": "text/markdown",
	})
})
