import {desc} from 'drizzle-orm'
import type {Database} from '../db'
import {observations} from '../db/schema'

const DEFAULT_THRESHOLD = 0.7

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

export async function jaccardDedup(
	db: Database,
	content: string,
	threshold = DEFAULT_THRESHOLD,
): Promise<{isDuplicate: boolean; existingId?: string}> {
	const recent = await db
		.select({id: observations.id, content: observations.content})
		.from(observations)
		.orderBy(desc(observations.createdAt))
		.limit(50)

	const inputTokens = tokenize(content)

	for (const row of recent) {
		const similarity = jaccardSimilarity(inputTokens, tokenize(row.content))
		if (similarity >= threshold) {
			return {isDuplicate: true, existingId: row.id}
		}
	}

	return {isDuplicate: false}
}
