import type {Env} from '../types'
import {getDb} from '../db'
import {
	queryRecentObservations,
	condenseWithLLM,
	dedupReflections,
	storeReflections,
	markCondensed,
} from '../services/reflection'
import {applyExponentialDecay} from '../services/decay'
import {deprecateHarmful} from '../services/maturity'

export async function handleScheduled(
	event: ScheduledEvent,
	env: Env,
): Promise<void> {
	const db = getDb(env.DB)

	if (event.cron === '0 6 * * *') {
		// Daily: reflection workflow
		const uncondensed = await queryRecentObservations(db)
		if (uncondensed.length === 0) return

		const bullets = await condenseWithLLM(env.AI, uncondensed)
		if (bullets.length === 0) {
			// Still mark as condensed even if LLM produced nothing
			await markCondensed(
				db,
				uncondensed.map((o) => o.id),
			)
			return
		}

		const deduped = await dedupReflections(db, bullets)

		if (deduped.length > 0) {
			const sourceIds = uncondensed.map((o) => o.id)
			await storeReflections(db, env.VECTORIZE, env.AI, deduped, sourceIds)
		}

		await markCondensed(
			db,
			uncondensed.map((o) => o.id),
		)
	}

	if (event.cron === '0 7 * * *') {
		// Nightly: decay + deprecate harmful
		await applyExponentialDecay(db)
		await deprecateHarmful(db)
	}
}
