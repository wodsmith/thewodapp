import {eq, sql} from 'drizzle-orm'
import type {Database} from '../db'
import {observations} from '../db/schema'
import type {FeedbackSignal, Observation} from '../db/schema'

export async function recordFeedback(
	db: Database,
	id: string,
	signal: FeedbackSignal,
	note?: string,
): Promise<Observation> {
	const existing = await db
		.select()
		.from(observations)
		.where(eq(observations.id, id))
		.get()

	if (!existing) throw new Error(`Observation ${id} not found`)

	const feedbackLog = existing.feedbackLog ?? []
	feedbackLog.push({signal, note, at: new Date().toISOString()})

	let newScore = existing.score
	if (signal === 'helpful') {
		newScore = Math.min(newScore + 0.3, 2.0)
	} else if (signal === 'harmful') {
		newScore = Math.max(newScore - 0.3, 0)
	}

	await db
		.update(observations)
		.set({
			feedbackLog,
			score: newScore,
			updatedAt: sql`(datetime('now'))`,
		})
		.where(eq(observations.id, id))

	const updated = await db
		.select()
		.from(observations)
		.where(eq(observations.id, id))
		.get()

	return updated!
}
