import {Hono} from 'hono'
import {ulid} from 'ulid'
import type {Env} from '../types'
import {getDb} from '../db'
import {generateEmbedding} from '../services/embedding'
import {jaccardDedup} from '../services/dedup'
import {storeObservation} from '../services/observation'
import type {Category, Priority} from '../db/schema'

const CATEGORIES: Category[] = [
	'convention',
	'gotcha',
	'debugging',
	'architecture',
	'workflow',
]
const PRIORITIES: Priority[] = ['critical', 'moderate', 'ephemeral']

export const observationRoutes = new Hono<{Bindings: Env}>()

observationRoutes.post('/', async (c) => {
	const body = await c.req.json<{
		content?: string
		category?: string
		priority?: string
		userId?: string
		sessionId?: string
	}>()

	if (!body.content || typeof body.content !== 'string') {
		return c.json({error: 'content is required'}, 400)
	}
	if (!body.category || !CATEGORIES.includes(body.category as Category)) {
		return c.json({error: `category must be one of: ${CATEGORIES.join(', ')}`}, 400)
	}
	if (!body.priority || !PRIORITIES.includes(body.priority as Priority)) {
		return c.json({error: `priority must be one of: ${PRIORITIES.join(', ')}`}, 400)
	}

	const db = getDb(c.env.DB)

	const dedup = await jaccardDedup(db, body.content)
	if (dedup.isDuplicate) {
		return c.json(
			{error: 'Duplicate observation', existingId: dedup.existingId},
			409,
		)
	}

	const embedding = await generateEmbedding(c.env.AI, body.content)

	const observation = await storeObservation(
		db,
		c.env.VECTORIZE,
		{
			id: ulid(),
			content: body.content,
			category: body.category as Category,
			priority: body.priority as Priority,
			userId: body.userId ?? null,
			sessionId: body.sessionId ?? null,
		},
		embedding,
	)

	return c.json(observation, 201)
})
