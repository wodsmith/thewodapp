import {ne, sql} from 'drizzle-orm'
import type {Database} from '../db'
import {observations, reflections} from '../db/schema'

const DEFAULT_HALF_LIFE_DAYS = 30
const DEPRECATION_THRESHOLD = 0.1

export async function applyExponentialDecay(
	db: Database,
	halfLifeDays = DEFAULT_HALF_LIFE_DAYS,
): Promise<{decayed: number; deprecated: number}> {
	let decayed = 0
	let deprecated = 0

	// Process observations
	const obs = await db
		.select()
		.from(observations)
		.where(ne(observations.maturity, 'deprecated'))
		.all()

	for (const row of obs) {
		const daysSince = daysSinceUpdate(row.updatedAt)
		const newScore = row.score * Math.pow(0.5, daysSince / halfLifeDays)

		if (newScore < DEPRECATION_THRESHOLD) {
			await db
				.update(observations)
				.set({
					score: newScore,
					maturity: 'deprecated',
					updatedAt: sql`(datetime('now'))`,
				})
				.where(sql`id = ${row.id}`)
			deprecated++
		} else if (Math.abs(newScore - row.score) > 0.001) {
			await db
				.update(observations)
				.set({score: newScore})
				.where(sql`id = ${row.id}`)
			decayed++
		}
	}

	// Process reflections
	const refs = await db
		.select()
		.from(reflections)
		.where(ne(reflections.maturity, 'deprecated'))
		.all()

	for (const row of refs) {
		const daysSince = daysSinceUpdate(row.updatedAt)
		const newScore = row.score * Math.pow(0.5, daysSince / halfLifeDays)

		if (newScore < DEPRECATION_THRESHOLD) {
			await db
				.update(reflections)
				.set({
					score: newScore,
					maturity: 'deprecated',
					updatedAt: sql`(datetime('now'))`,
				})
				.where(sql`id = ${row.id}`)
			deprecated++
		} else if (Math.abs(newScore - row.score) > 0.001) {
			await db
				.update(reflections)
				.set({score: newScore})
				.where(sql`id = ${row.id}`)
			decayed++
		}
	}

	return {decayed, deprecated}
}

function daysSinceUpdate(updatedAt: string): number {
	const updated = new Date(updatedAt)
	const now = new Date()
	return (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24)
}
