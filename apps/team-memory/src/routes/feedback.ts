import {Hono} from 'hono'
import type {Env} from '../types'
import {getDb} from '../db'
import {recordFeedback} from '../services/feedback'
import {checkPromotion} from '../services/maturity'

export const feedbackRoutes = new Hono<{Bindings: Env}>()

feedbackRoutes.post('/', async (c) => {
	const body = await c.req.json<{
		id: string
		signal: 'helpful' | 'harmful' | 'irrelevant'
		note?: string
	}>()

	if (!body.id || !body.signal) {
		return c.json({error: 'id and signal are required'}, 400)
	}

	if (!['helpful', 'harmful', 'irrelevant'].includes(body.signal)) {
		return c.json({error: 'signal must be helpful, harmful, or irrelevant'}, 400)
	}

	const db = getDb(c.env.DB)

	try {
		const observation = await recordFeedback(db, body.id, body.signal, body.note)
		const maturity = await checkPromotion(db, body.id)
		return c.json({...observation, maturity})
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Unknown error'
		if (msg.includes('not found')) {
			return c.json({error: msg}, 404)
		}
		throw e
	}
})
