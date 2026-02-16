import type {Database} from '../db'
import {observations} from '../db/schema'
import type {NewObservation, Observation} from '../db/schema'
import {eq} from 'drizzle-orm'

export async function storeObservation(
	db: Database,
	vectorize: VectorizeIndex,
	obs: NewObservation,
	embedding: number[],
): Promise<Observation> {
	await db.insert(observations).values(obs)

	const stored = await db
		.select()
		.from(observations)
		.where(eq(observations.id, obs.id!))
		.get()

	await vectorize.upsert([
		{
			id: obs.id!,
			values: embedding,
			metadata: {
				type: 'observation',
				category: obs.category,
				priority: obs.priority,
			},
		},
	])

	return stored!
}
