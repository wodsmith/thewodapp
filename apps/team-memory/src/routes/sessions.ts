import {Hono} from 'hono'
import type {Env} from '../types'
import {getDb} from '../db'
import {storeSessionMessages} from '../services/session'

export const sessionRoutes = new Hono<{Bindings: Env}>()

sessionRoutes.post('/', async (c) => {
	const body = await c.req.json<{
		userId?: string
		messages: Array<{role: string; content: string}>
		metadata?: Record<string, unknown>
	}>()

	if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
		return c.json({error: 'messages array is required and must not be empty'}, 400)
	}

	const db = getDb(c.env.DB)
	const result = await storeSessionMessages(db, {
		userId: body.userId,
		messages: body.messages as Array<{role: 'user' | 'assistant' | 'system'; content: string}>,
		metadata: body.metadata,
	})

	return c.json(result, 201)
})
