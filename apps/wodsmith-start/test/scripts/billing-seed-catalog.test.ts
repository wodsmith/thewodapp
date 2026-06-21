import { describe, expect, it, vi } from "vitest"
import { seed } from "../../scripts/seed/seeders/02-billing"

type SeedRow = Record<string, unknown>

function parseInsertedRows(sql: string, params: unknown[]): {
	tableName: string
	rows: SeedRow[]
} {
	const tableName = /INSERT IGNORE INTO `([^`]+)`/.exec(sql)?.[1]
	const columnList = /\(([^)]+)\) VALUES/.exec(sql)?.[1]

	if (!tableName || !columnList) {
		throw new Error(`Unable to parse seed insert SQL: ${sql}`)
	}

	const columns = [...columnList.matchAll(/`([^`]+)`/g)].map(
		(match) => match[1],
	)
	const rows: SeedRow[] = []

	for (let offset = 0; offset < params.length; offset += columns.length) {
		rows.push(
			Object.fromEntries(
				columns.map((column, index) => [column, params[offset + index]]),
			),
		)
	}

	return { tableName, rows }
}

async function collectBillingSeedRows(): Promise<Record<string, SeedRow[]>> {
	const rowsByTable: Record<string, SeedRow[]> = {}
	const client = {
		execute: vi.fn(async (sql: string, params: unknown[]) => {
			const { tableName, rows } = parseInsertedRows(sql, params)
			rowsByTable[tableName] = [...(rowsByTable[tableName] ?? []), ...rows]
		}),
	}

	await seed(client as never)

	return rowsByTable
}

function valuesForPlan(
	rowsByTable: Record<string, SeedRow[]>,
	planId: string,
): Record<string, number> {
	const limitsById = new Map(
		rowsByTable.limits.map((limit) => [limit.id, limit.key]),
	)

	return Object.fromEntries(
		rowsByTable.plan_limits
			.filter((limit) => limit.plan_id === planId)
			.map((limit) => [
				limitsById.get(limit.limit_id),
				Number(limit.value),
			]),
	)
}

function featuresForPlan(
	rowsByTable: Record<string, SeedRow[]>,
	planId: string,
): string[] {
	return rowsByTable.plan_features
		.filter((feature) => feature.plan_id === planId)
		.map((feature) => String(feature.feature_id))
}

describe("billing seed catalog", () => {
	it("keeps existing WODsmith plans and seeds Crew catalog entries", async () => {
		const rowsByTable = await collectBillingSeedRows()

		expect(rowsByTable.plans.map((plan) => plan.id)).toEqual(
			expect.arrayContaining([
				"free",
				"pro",
				"enterprise",
				"crew_starter",
				"crew_basic",
				"crew_pro",
				"crew_concierge",
				"crew_founding_2026",
			]),
		)

		expect(rowsByTable.features).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "feat_crew_events",
					key: "crew_events",
					category: "team",
				}),
				expect.objectContaining({
					id: "feat_crew_imports",
					key: "crew_imports",
					category: "team",
				}),
				expect.objectContaining({
					id: "feat_crew_confirmation_reminders",
					key: "crew_confirmation_reminders",
					category: "team",
				}),
				expect.objectContaining({
					id: "feat_crew_department_leads",
					key: "crew_department_leads",
					category: "team",
				}),
				expect.objectContaining({
					id: "feat_crew_exports",
					key: "crew_exports",
					category: "team",
				}),
				expect.objectContaining({
					id: "feat_crew_concierge",
					key: "crew_concierge",
					category: "team",
				}),
			]),
		)

		expect(rowsByTable.limits).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "lmt_max_crew_events",
					key: "max_crew_events",
				}),
				expect.objectContaining({
					id: "lmt_max_crew_volunteers_per_event",
					key: "max_crew_volunteers_per_event",
				}),
				expect.objectContaining({
					id: "lmt_max_crew_email_sends_per_event",
					key: "max_crew_email_sends_per_event",
				}),
				expect.objectContaining({
					id: "lmt_max_crew_imports_per_event",
					key: "max_crew_imports_per_event",
				}),
			]),
		)
	})

	it("keeps Crew event catalog plans separate from existing team subscription plans", async () => {
		const rowsByTable = await collectBillingSeedRows()
		const planById = new Map(rowsByTable.plans.map((plan) => [plan.id, plan]))

		expect(planById.get("crew_starter")).toEqual(
			expect.objectContaining({
				price: 0,
				interval: null,
				is_public: 1,
			}),
		)
		expect(planById.get("crew_basic")).toEqual(
			expect.objectContaining({
				price: 20000,
				interval: null,
				is_public: 1,
			}),
		)
		expect(planById.get("crew_pro")).toEqual(
			expect.objectContaining({
				price: 80000,
				interval: null,
				is_public: 1,
			}),
		)
		expect(planById.get("crew_concierge")).toEqual(
			expect.objectContaining({
				price: 300000,
				interval: null,
				is_public: 0,
			}),
		)
		expect(planById.get("crew_founding_2026")).toEqual(
			expect.objectContaining({
				price: 9900,
				interval: null,
				is_public: 0,
			}),
		)

		for (const teamPlanId of ["free", "pro", "enterprise"]) {
			expect(featuresForPlan(rowsByTable, teamPlanId)).not.toEqual(
				expect.arrayContaining([
					"feat_crew_events",
					"feat_crew_imports",
					"feat_crew_confirmation_reminders",
					"feat_crew_department_leads",
					"feat_crew_exports",
					"feat_crew_concierge",
				]),
			)
		}
	})

	it("maps Crew features and limits to the expected launch tiers", async () => {
		const rowsByTable = await collectBillingSeedRows()

		expect(featuresForPlan(rowsByTable, "crew_starter")).toEqual([
			"feat_crew_events",
		])
		expect(featuresForPlan(rowsByTable, "crew_basic")).toEqual([
			"feat_crew_events",
			"feat_crew_imports",
			"feat_crew_confirmation_reminders",
		])
		expect(featuresForPlan(rowsByTable, "crew_pro")).toEqual([
			"feat_crew_events",
			"feat_crew_imports",
			"feat_crew_confirmation_reminders",
			"feat_crew_department_leads",
			"feat_crew_exports",
		])
		expect(featuresForPlan(rowsByTable, "crew_concierge")).toEqual([
			"feat_crew_events",
			"feat_crew_imports",
			"feat_crew_confirmation_reminders",
			"feat_crew_department_leads",
			"feat_crew_exports",
			"feat_crew_concierge",
		])
		expect(featuresForPlan(rowsByTable, "crew_founding_2026")).toEqual([
			"feat_crew_events",
			"feat_crew_imports",
			"feat_crew_confirmation_reminders",
			"feat_crew_department_leads",
			"feat_crew_exports",
		])

		expect(valuesForPlan(rowsByTable, "crew_starter")).toEqual({
			max_crew_events: 1,
			max_crew_volunteers_per_event: 50,
			max_crew_email_sends_per_event: 0,
			max_crew_imports_per_event: 0,
		})
		expect(valuesForPlan(rowsByTable, "crew_basic")).toEqual({
			max_crew_events: 1,
			max_crew_volunteers_per_event: -1,
			max_crew_email_sends_per_event: 500,
			max_crew_imports_per_event: 5,
		})
		expect(valuesForPlan(rowsByTable, "crew_pro")).toEqual({
			max_crew_events: 3,
			max_crew_volunteers_per_event: -1,
			max_crew_email_sends_per_event: 2000,
			max_crew_imports_per_event: -1,
		})
		expect(valuesForPlan(rowsByTable, "crew_concierge")).toEqual({
			max_crew_events: -1,
			max_crew_volunteers_per_event: -1,
			max_crew_email_sends_per_event: -1,
			max_crew_imports_per_event: -1,
		})
		expect(valuesForPlan(rowsByTable, "crew_founding_2026")).toEqual({
			max_crew_events: 1,
			max_crew_volunteers_per_event: -1,
			max_crew_email_sends_per_event: 2000,
			max_crew_imports_per_event: -1,
		})
	})
})
