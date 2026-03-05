import { inArray } from "drizzle-orm"
import type { Database } from "../db"
import type {
	Category,
	Maturity,
	Observation,
	Priority,
	Reflection,
} from "../db/schema"
import { observations, reflections } from "../db/schema"

interface SearchFilters {
	category?: Category
	priority?: Priority
	maturity?: Maturity
}

export async function semanticSearch(
	db: Database,
	vectorize: VectorizeIndex,
	embedding: number[],
	filters?: SearchFilters,
	limit = 10,
): Promise<(Observation | Reflection)[]> {
	const vectorFilter: VectorizeVectorMetadataFilter = {}
	if (filters?.category) vectorFilter.category = filters.category
	if (filters?.priority) vectorFilter.priority = filters.priority
	if (filters?.maturity) vectorFilter.maturity = filters.maturity

	const matches = await vectorize.query(embedding, {
		topK: limit,
		filter: Object.keys(vectorFilter).length > 0 ? vectorFilter : undefined,
	})

	if (!matches.matches.length) return []

	const obsIds: string[] = []
	const refIds: string[] = []

	for (const m of matches.matches) {
		const type = (m.metadata?.type as string) ?? "observation"
		if (type === "reflection") {
			refIds.push(m.id)
		} else {
			obsIds.push(m.id)
		}
	}

	const results: (Observation | Reflection)[] = []

	if (obsIds.length > 0) {
		const obs = await db
			.select()
			.from(observations)
			.where(inArray(observations.id, obsIds))
		results.push(...obs)
	}

	if (refIds.length > 0) {
		const refs = await db
			.select()
			.from(reflections)
			.where(inArray(reflections.id, refIds))
		results.push(...refs)
	}

	// Sort by vectorize score order
	const scoreMap = new Map(matches.matches.map((m) => [m.id, m.score]))
	results.sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0))

	return results
}
