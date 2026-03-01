import {and, eq, ne} from 'drizzle-orm'
import {ulid} from 'ulid'
import type {Database} from '../db'
import {observations, reflections} from '../db/schema'
import type {Category, Observation, Priority} from '../db/schema'
import {generateEmbedding} from './embedding'

interface ReflectionBullet {
	content: string
	category: Category
	priority: Priority
}

const BATCH_SIZE = 20

export async function queryRecentObservations(
	db: Database,
): Promise<Observation[]> {
	return db
		.select()
		.from(observations)
		.where(
			and(
				eq(observations.condensed, false),
				ne(observations.maturity, 'deprecated'),
			),
		)
		.all()
}

export async function condenseWithLLM(
	ai: Ai,
	obs: Observation[],
): Promise<ReflectionBullet[]> {
	const results: ReflectionBullet[] = []

	for (let i = 0; i < obs.length; i += BATCH_SIZE) {
		const batch = obs.slice(i, i + BATCH_SIZE)
		const formatted = batch
			.map(
				(o, idx) =>
					`${idx + 1}. [${o.category}/${o.priority}] ${o.content}`,
			)
			.join('\n')

		const response = await ai.run(
			'@cf/meta/llama-3.1-8b-instruct-fp8',
			{
				messages: [
					{
						role: 'system',
						content: `You are a memory condensation engine. Given a list of observations, produce a JSON array of condensed reflection bullets. Each bullet should:
- Be under 200 characters
- Group related observations into a single insight
- Preserve actionable detail
- Keep the most specific category and highest priority from source observations

Return ONLY a valid JSON array: [{"content": "...", "category": "convention|gotcha|debugging|architecture|workflow", "priority": "critical|moderate|ephemeral"}]`,
					},
					{
						role: 'user',
						content: `Condense these observations:\n${formatted}`,
					},
				],
			},
		)

		const text =
			typeof response === 'object' && 'response' in response
				? (response as {response: string}).response
				: ''
		if (!text) continue

		const VALID_CATEGORIES: Category[] = ['convention', 'gotcha', 'debugging', 'architecture', 'workflow']
		const VALID_PRIORITIES: Priority[] = ['critical', 'moderate', 'ephemeral']

		try {
			// Extract JSON array from response (may have surrounding text)
			const match = text.match(/\[[\s\S]*\]/)
			if (!match) continue
			const parsed = JSON.parse(match[0]) as ReflectionBullet[]
			for (const bullet of parsed) {
				if (
					bullet.content &&
					bullet.category &&
					bullet.priority &&
					bullet.content.length <= 200 &&
					VALID_CATEGORIES.includes(bullet.category) &&
					VALID_PRIORITIES.includes(bullet.priority)
				) {
					results.push(bullet)
				}
			}
		} catch {
			// Skip unparseable batches
		}
	}

	return results
}

function tokenize(text: string): Set<string> {
	return new Set(
		text
			.toLowerCase()
			.replace(/[^\w\s]/g, '')
			.split(/\s+/)
			.filter(Boolean),
	)
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
	let intersection = 0
	for (const token of a) {
		if (b.has(token)) intersection++
	}
	const union = a.size + b.size - intersection
	if (union === 0) return 0
	return intersection / union
}

const DEDUP_THRESHOLD = 0.7

export async function dedupReflections(
	db: Database,
	bullets: ReflectionBullet[],
): Promise<ReflectionBullet[]> {
	const existing = await db
		.select({content: reflections.content})
		.from(reflections)
		.where(ne(reflections.maturity, 'deprecated'))
		.all()

	const existingTokens = existing.map((r) => tokenize(r.content))

	return bullets.filter((bullet) => {
		const bulletTokens = tokenize(bullet.content)
		return !existingTokens.some(
			(et) => jaccardSimilarity(bulletTokens, et) >= DEDUP_THRESHOLD,
		)
	})
}

export async function storeReflections(
	db: Database,
	vectorize: VectorizeIndex,
	ai: Ai,
	bullets: ReflectionBullet[],
	sourceObservationIds: string[],
): Promise<void> {
	for (const bullet of bullets) {
		const id = ulid()

		await db.insert(reflections).values({
			id,
			content: bullet.content,
			category: bullet.category,
			priority: bullet.priority,
			sourceObservationIds,
		})

		const embedding = await generateEmbedding(ai, bullet.content)

		await vectorize.upsert([
			{
				id,
				values: embedding,
				metadata: {
					type: 'reflection',
					category: bullet.category,
					priority: bullet.priority,
				},
			},
		])
	}
}

export async function markCondensed(
	db: Database,
	observationIds: string[],
): Promise<void> {
	for (const id of observationIds) {
		await db
			.update(observations)
			.set({condensed: true})
			.where(eq(observations.id, id))
	}
}
