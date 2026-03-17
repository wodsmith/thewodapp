import { createServerFn } from "@tanstack/react-start"
import { and, desc, eq, gte, lte, sql } from "drizzle-orm"
import { z } from "zod"
import { getPsDb } from "../db/planetscale"
import {
	commercePurchaseTable,
	financialEventTable,
	teamTable,
} from "../db/ps-schema"
import { requireAuth } from "./auth"

function defaultDateRange(startDate?: string, endDate?: string) {
	const end = endDate ? new Date(endDate) : new Date()
	const start = startDate
		? new Date(startDate)
		: new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
	return { start, end }
}

export const getFinancialEvents = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				eventType: z.string().optional(),
				teamId: z.string().optional(),
				startDate: z.string().optional(),
				endDate: z.string().optional(),
				page: z.number().default(1),
				pageSize: z.number().default(50),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireAuth()
		const db = getPsDb()

		const { start, end } = defaultDateRange(data.startDate, data.endDate)
		const offset = (data.page - 1) * data.pageSize

		const conditions = [
			gte(financialEventTable.createdAt, start),
			lte(financialEventTable.createdAt, end),
		]
		if (data.eventType) {
			conditions.push(eq(financialEventTable.eventType, data.eventType as never))
		}
		if (data.teamId) {
			conditions.push(eq(financialEventTable.teamId, data.teamId))
		}

		const where = and(...conditions)

		const [events, countResult] = await Promise.all([
			db
				.select({
					id: financialEventTable.id,
					purchaseId: financialEventTable.purchaseId,
					teamId: financialEventTable.teamId,
					teamName: teamTable.name,
					eventType: financialEventTable.eventType,
					amountCents: financialEventTable.amountCents,
					currency: financialEventTable.currency,
					stripePaymentIntentId: financialEventTable.stripePaymentIntentId,
					stripeRefundId: financialEventTable.stripeRefundId,
					stripeDisputeId: financialEventTable.stripeDisputeId,
					reason: financialEventTable.reason,
					metadata: financialEventTable.metadata,
					actorId: financialEventTable.actorId,
					stripeEventTimestamp: financialEventTable.stripeEventTimestamp,
					createdAt: financialEventTable.createdAt,
				})
				.from(financialEventTable)
				.leftJoin(teamTable, eq(financialEventTable.teamId, teamTable.id))
				.where(where)
				.orderBy(desc(financialEventTable.createdAt))
				.limit(data.pageSize)
				.offset(offset),
			db
				.select({ total: sql<number>`COUNT(*)` })
				.from(financialEventTable)
				.where(where),
		])

		const total = Number(countResult[0]?.total ?? 0)

		return {
			events,
			total,
			page: data.page,
			pageSize: data.pageSize,
			totalPages: Math.ceil(total / data.pageSize),
		}
	})

export const getPurchaseEvents = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				purchaseId: z.string().optional(),
				teamId: z.string().optional(),
				startDate: z.string().optional(),
				endDate: z.string().optional(),
				page: z.number().default(1),
				pageSize: z.number().default(50),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireAuth()
		const db = getPsDb()

		const { start, end } = defaultDateRange(data.startDate, data.endDate)
		const offset = (data.page - 1) * data.pageSize

		const eventConditions = [
			gte(financialEventTable.createdAt, start),
			lte(financialEventTable.createdAt, end),
		]
		if (data.purchaseId) {
			eventConditions.push(eq(financialEventTable.purchaseId, data.purchaseId))
		}
		if (data.teamId) {
			eventConditions.push(eq(financialEventTable.teamId, data.teamId))
		}

		const eventWhere = and(...eventConditions)

		// Get distinct purchase IDs with pagination, ordered by most recent event
		const [purchaseIdRows, countResult] = await Promise.all([
			db
				.select({
					purchaseId: financialEventTable.purchaseId,
					latestEvent: sql<Date>`MAX(${financialEventTable.createdAt})`,
				})
				.from(financialEventTable)
				.where(eventWhere)
				.groupBy(financialEventTable.purchaseId)
				.orderBy(desc(sql`MAX(${financialEventTable.createdAt})`))
				.limit(data.pageSize)
				.offset(offset),
			db
				.select({
					total: sql<number>`COUNT(DISTINCT ${financialEventTable.purchaseId})`,
				})
				.from(financialEventTable)
				.where(eventWhere),
		])

		const total = Number(countResult[0]?.total ?? 0)
		const purchaseIds = purchaseIdRows.map((r) => r.purchaseId)

		if (purchaseIds.length === 0) {
			return {
				purchases: [],
				total,
				page: data.page,
				pageSize: data.pageSize,
				totalPages: Math.ceil(total / data.pageSize),
			}
		}

		// Fetch all events and purchases for these IDs
		const [events, purchases] = await Promise.all([
			db
				.select({
					id: financialEventTable.id,
					purchaseId: financialEventTable.purchaseId,
					teamId: financialEventTable.teamId,
					eventType: financialEventTable.eventType,
					amountCents: financialEventTable.amountCents,
					currency: financialEventTable.currency,
					stripePaymentIntentId: financialEventTable.stripePaymentIntentId,
					stripeRefundId: financialEventTable.stripeRefundId,
					stripeDisputeId: financialEventTable.stripeDisputeId,
					reason: financialEventTable.reason,
					createdAt: financialEventTable.createdAt,
				})
				.from(financialEventTable)
				.where(
					and(
						sql`${financialEventTable.purchaseId} IN (${sql.join(
							purchaseIds.map((id) => sql`${id}`),
							sql`, `,
						)})`,
						eventWhere,
					),
				)
				.orderBy(desc(financialEventTable.createdAt)),
			db
				.select()
				.from(commercePurchaseTable)
				.where(
					sql`${commercePurchaseTable.id} IN (${sql.join(
						purchaseIds.map((id) => sql`${id}`),
						sql`, `,
					)})`,
				),
		])

		const purchaseMap = new Map(purchases.map((p) => [p.id, p]))
		const eventsByPurchase = new Map<string, typeof events>()
		for (const event of events) {
			const list = eventsByPurchase.get(event.purchaseId) ?? []
			list.push(event)
			eventsByPurchase.set(event.purchaseId, list)
		}

		const result = purchaseIds.map((purchaseId) => {
			const purchase = purchaseMap.get(purchaseId) ?? null
			const purchaseEvents = eventsByPurchase.get(purchaseId) ?? []
			const netBalance = purchaseEvents.reduce(
				(sum, e) => sum + e.amountCents,
				0,
			)
			const totalCents = purchase?.totalCents ?? 0
			const isMismatched = netBalance !== totalCents && netBalance !== 0

			return { purchase, events: purchaseEvents, netBalance, isMismatched }
		})

		return {
			purchases: result,
			total,
			page: data.page,
			pageSize: data.pageSize,
			totalPages: Math.ceil(total / data.pageSize),
		}
	})

export const getFinancialSummary = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				groupBy: z.enum(["team", "month", "eventType"]).default("month"),
				startDate: z.string().optional(),
				endDate: z.string().optional(),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireAuth()
		const db = getPsDb()

		const { start, end } = defaultDateRange(data.startDate, data.endDate)
		const where = and(
			gte(financialEventTable.createdAt, start),
			lte(financialEventTable.createdAt, end),
		)

		if (data.groupBy === "month") {
			const rows = await db
				.select({
					year: sql<number>`YEAR(${financialEventTable.createdAt})`,
					month: sql<number>`MONTH(${financialEventTable.createdAt})`,
					totalAmountCents: sql<number>`SUM(${financialEventTable.amountCents})`,
					count: sql<number>`COUNT(*)`,
				})
				.from(financialEventTable)
				.where(where)
				.groupBy(
					sql`YEAR(${financialEventTable.createdAt})`,
					sql`MONTH(${financialEventTable.createdAt})`,
				)
				.orderBy(
					desc(sql`YEAR(${financialEventTable.createdAt})`),
					desc(sql`MONTH(${financialEventTable.createdAt})`),
				)

			return {
				groupBy: data.groupBy,
				groups: rows.map((r) => ({
					label: `${Number(r.year)}-${String(Number(r.month)).padStart(2, "0")}`,
					totalAmountCents: Number(r.totalAmountCents),
					count: Number(r.count),
				})),
			}
		}

		if (data.groupBy === "team") {
			const rows = await db
				.select({
					teamId: financialEventTable.teamId,
					teamName: teamTable.name,
					totalAmountCents: sql<number>`SUM(${financialEventTable.amountCents})`,
					count: sql<number>`COUNT(*)`,
				})
				.from(financialEventTable)
				.leftJoin(teamTable, eq(financialEventTable.teamId, teamTable.id))
				.where(where)
				.groupBy(financialEventTable.teamId, teamTable.name)
				.orderBy(desc(sql`SUM(${financialEventTable.amountCents})`))

			return {
				groupBy: data.groupBy,
				groups: rows.map((r) => ({
					label: r.teamName ?? r.teamId,
					teamId: r.teamId,
					totalAmountCents: Number(r.totalAmountCents),
					count: Number(r.count),
				})),
			}
		}

		// groupBy === "eventType"
		const rows = await db
			.select({
				eventType: financialEventTable.eventType,
				totalAmountCents: sql<number>`SUM(${financialEventTable.amountCents})`,
				count: sql<number>`COUNT(*)`,
			})
			.from(financialEventTable)
			.where(where)
			.groupBy(financialEventTable.eventType)
			.orderBy(desc(sql`SUM(${financialEventTable.amountCents})`))

		return {
			groupBy: data.groupBy,
			groups: rows.map((r) => ({
				label: r.eventType,
				totalAmountCents: Number(r.totalAmountCents),
				count: Number(r.count),
			})),
		}
	})
