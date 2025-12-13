/**
 * Utilities for batching SQL queries to avoid SQLite/D1 variable limits
 * Based on: https://github.com/drizzle-team/drizzle-orm/issues/2479#issuecomment-2544001471
 */

/**
 * D1/SQLite has a 999 variable limit, but we use 100 to leave room for other params.
 * For simple ID arrays, each ID = 1 parameter.
 */
export const SQL_BATCH_SIZE = 100
const MAX_PARAMETERS = SQL_BATCH_SIZE

/**
 * Simple chunk helper for manual batching with Promise.all
 * Use autochunk for most cases; this is for parallel execution patterns
 */
export function chunk<T>(arr: T[], size: number): T[][] {
	const chunks: T[][] = []
	for (let i = 0; i < arr.length; i += size) {
		chunks.push(arr.slice(i, i + size))
	}
	return chunks
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		Object.getPrototypeOf(value) === Object.prototype
	)
}

/**
 * Automatically chunks items for batched queries respecting D1's parameter limit.
 * Calculates actual parameter count based on item structure.
 *
 * @param options.items - Array of items to process (IDs or objects)
 * @param options.otherParametersCount - Number of other params in query (WHERE conditions, etc.)
 * @param cb - Callback executed for each chunk, receives chunk of items
 * @returns Flattened array of all results
 *
 * @example
 * // Simple ID array
 * const results = await autochunk({ items: userTeamIds }, async (chunk) => {
 *   return db.query.registrationsTable.findMany({
 *     where: inArray(registrationsTable.teamId, chunk),
 *   })
 * })
 *
 * @example
 * // With other parameters in query
 * const results = await autochunk(
 *   { items: userTeamIds, otherParametersCount: 2 }, // 2 extra params: competitionId, status
 *   async (chunk) => {
 *     return db.query.registrationsTable.findMany({
 *       where: and(
 *         eq(registrationsTable.competitionId, competitionId),
 *         eq(registrationsTable.status, 'active'),
 *         inArray(registrationsTable.teamId, chunk),
 *       ),
 *     })
 *   }
 * )
 */
export async function autochunk<
	T extends Record<string, unknown> | string | number,
	U,
>(
	{
		items,
		otherParametersCount = 0,
	}: {
		items: T[]
		otherParametersCount?: number
	},
	cb: (chunk: T[]) => Promise<U[]>,
): Promise<U[]> {
	if (items.length === 0) return []

	const chunks: T[][] = []
	let chunk: T[] = []
	let chunkParameters = 0

	if (otherParametersCount >= MAX_PARAMETERS) {
		throw new Error(`otherParametersCount cannot be >= ${MAX_PARAMETERS}`)
	}

	for (const item of items) {
		const itemParameters = isPlainObject(item) ? Object.keys(item).length : 1

		if (itemParameters > MAX_PARAMETERS) {
			throw new Error(`Item has too many parameters (${itemParameters})`)
		}

		if (
			chunkParameters + itemParameters + otherParametersCount >
			MAX_PARAMETERS
		) {
			chunks.push(chunk)
			chunkParameters = itemParameters
			chunk = [item]
			continue
		}

		chunk.push(item)
		chunkParameters += itemParameters
	}

	if (chunk.length) {
		chunks.push(chunk)
	}

	const results: U[] = []

	for (const chunkItems of chunks) {
		const result = await cb(chunkItems)
		results.push(...result)
	}

	return results
}

/**
 * Autochunk variant for findFirst-style queries.
 * Returns first match found across all chunks.
 *
 * @param options.items - Array of items to process
 * @param options.otherParametersCount - Number of other params in query
 * @param cb - Callback that returns single result or undefined
 * @returns First matching result or null
 */
export async function autochunkFirst<
	T extends Record<string, unknown> | string | number,
	U,
>(
	{
		items,
		otherParametersCount = 0,
	}: {
		items: T[]
		otherParametersCount?: number
	},
	cb: (chunk: T[]) => Promise<U | undefined>,
): Promise<U | null> {
	if (items.length === 0) return null

	const chunks: T[][] = []
	let chunk: T[] = []
	let chunkParameters = 0

	if (otherParametersCount >= MAX_PARAMETERS) {
		throw new Error(`otherParametersCount cannot be >= ${MAX_PARAMETERS}`)
	}

	for (const item of items) {
		const itemParameters = isPlainObject(item) ? Object.keys(item).length : 1

		if (itemParameters > MAX_PARAMETERS) {
			throw new Error(`Item has too many parameters (${itemParameters})`)
		}

		if (
			chunkParameters + itemParameters + otherParametersCount >
			MAX_PARAMETERS
		) {
			chunks.push(chunk)
			chunkParameters = itemParameters
			chunk = [item]
			continue
		}

		chunk.push(item)
		chunkParameters += itemParameters
	}

	if (chunk.length) {
		chunks.push(chunk)
	}

	for (const chunkItems of chunks) {
		const result = await cb(chunkItems)
		if (result !== undefined) return result
	}

	return null
}
