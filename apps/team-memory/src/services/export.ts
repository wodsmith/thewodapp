import { and, desc, gte, inArray } from "drizzle-orm"
import type { Database } from "../db"
import type { Category } from "../db/schema"
import { observations, reflections } from "../db/schema"

const CATEGORY_HEADINGS: Record<Category, string> = {
	convention: "Conventions",
	gotcha: "Gotchas",
	debugging: "Debugging",
	architecture: "Architecture",
	workflow: "Workflow",
}

const CATEGORIES: Category[] = [
	"convention",
	"gotcha",
	"debugging",
	"architecture",
	"workflow",
]

function formatEntry(content: string, score: number, maturity: string): string {
	return `- ${content} (score: ${score}, maturity: ${maturity})`
}

export async function exportCoreMemory(
	db: Database,
	scoreThreshold = 0.5,
): Promise<string> {
	const maturities = ["proven", "established"] as const

	const [obs, refs] = await Promise.all([
		db
			.select()
			.from(observations)
			.where(
				and(
					inArray(observations.maturity, [...maturities]),
					gte(observations.score, scoreThreshold),
				),
			)
			.orderBy(desc(observations.score)),
		db
			.select()
			.from(reflections)
			.where(
				and(
					inArray(reflections.maturity, [...maturities]),
					gte(reflections.score, scoreThreshold),
				),
			)
			.orderBy(desc(reflections.score)),
	])

	const grouped = new Map<Category, string[]>()

	for (const o of obs) {
		const entries = grouped.get(o.category) ?? []
		entries.push(formatEntry(o.content, o.score, o.maturity))
		grouped.set(o.category, entries)
	}

	for (const r of refs) {
		const entries = grouped.get(r.category) ?? []
		entries.push(formatEntry(r.content, r.score, r.maturity))
		grouped.set(r.category, entries)
	}

	const sections: string[] = ["# Team Memory", ""]

	for (const cat of CATEGORIES) {
		const entries = grouped.get(cat)
		if (!entries?.length) continue
		sections.push(`## ${CATEGORY_HEADINGS[cat]}`)
		sections.push(...entries)
		sections.push("")
	}

	return sections.join("\n")
}
