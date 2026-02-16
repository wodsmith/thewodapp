import { and, desc, eq, ne } from "drizzle-orm"
import type { Database } from "../db"
import type { Category, Observation, Priority, Reflection } from "../db/schema"
import { observations, reflections } from "../db/schema"

interface ContextOptions {
	category?: Category
	priority?: Priority
	limit?: number
}

export async function getTopContext(
	db: Database,
	opts?: ContextOptions,
): Promise<{ observations: Observation[]; reflections: Reflection[] }> {
	const limit = opts?.limit ?? 20

	const obsConditions = [ne(observations.maturity, "deprecated")]
	if (opts?.category)
		obsConditions.push(eq(observations.category, opts.category))
	if (opts?.priority)
		obsConditions.push(eq(observations.priority, opts.priority))

	const refConditions = [ne(reflections.maturity, "deprecated")]
	if (opts?.category)
		refConditions.push(eq(reflections.category, opts.category))
	if (opts?.priority)
		refConditions.push(eq(reflections.priority, opts.priority))

	const [obs, refs] = await Promise.all([
		db
			.select()
			.from(observations)
			.where(and(...obsConditions))
			.orderBy(desc(observations.score))
			.limit(limit),
		db
			.select()
			.from(reflections)
			.where(and(...refConditions))
			.orderBy(desc(reflections.score))
			.limit(limit),
	])

	return { observations: obs, reflections: refs }
}
