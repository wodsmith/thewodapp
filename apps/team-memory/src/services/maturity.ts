import {eq, ne, sql} from 'drizzle-orm'
import type {Database} from '../db'
import {observations} from '../db/schema'
import type {Maturity} from '../db/schema'

export async function checkPromotion(
	db: Database,
	id: string,
): Promise<Maturity> {
	const obs = await db
		.select()
		.from(observations)
		.where(eq(observations.id, id))
		.get()

	if (!obs) throw new Error(`Observation ${id} not found`)

	const log = obs.feedbackLog ?? []
	const helpful = log.filter((e) => e.signal === 'helpful').length
	const harmful = log.filter((e) => e.signal === 'harmful').length
	const total = log.length

	let newMaturity = obs.maturity

	// Deprecation check takes priority
	if (total > 0 && harmful / total > 0.3) {
		newMaturity = 'deprecated'
	} else if (
		obs.maturity === 'established' &&
		helpful >= 5 &&
		obs.score > 1.0
	) {
		newMaturity = 'proven'
	} else if (obs.maturity === 'candidate' && helpful >= 3) {
		newMaturity = 'established'
	}

	if (newMaturity !== obs.maturity) {
		await db
			.update(observations)
			.set({
				maturity: newMaturity,
				updatedAt: sql`(datetime('now'))`,
			})
			.where(eq(observations.id, id))
	}

	return newMaturity
}

export async function deprecateHarmful(
	db: Database,
	harmThreshold = 0.3,
): Promise<number> {
	const rows = await db
		.select()
		.from(observations)
		.where(ne(observations.maturity, 'deprecated'))

	let count = 0

	for (const obs of rows) {
		const log = obs.feedbackLog ?? []
		if (log.length === 0) continue

		const harmful = log.filter((e) => e.signal === 'harmful').length
		if (harmful / log.length > harmThreshold) {
			await db
				.update(observations)
				.set({
					maturity: 'deprecated',
					updatedAt: sql`(datetime('now'))`,
				})
				.where(eq(observations.id, obs.id))
			count++
		}
	}

	return count
}
