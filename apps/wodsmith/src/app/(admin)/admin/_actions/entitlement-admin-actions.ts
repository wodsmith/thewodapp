"use server"

/**
 * Admin actions for managing entitlements system
 * Includes: team entitlements, features, limits, and plans
 * These actions are restricted to site admins only
 *
 * All actions are protected by requireAdmin() checks.
 */

import { and, eq, like, or, sql } from "drizzle-orm"
import { z } from "zod"
import { createServerAction, ZSAError } from "@repo/zsa"
import { getDb } from "@/db"
import {
	featureTable,
	limitTable,
	planTable,
	teamEntitlementOverrideTable,
	teamTable,
} from "@/db/schema"
import { requireAdmin } from "@/utils/auth"
import { invalidateTeamMembersSessions } from "@/utils/kv-session"
import { PAGE_SIZE_OPTIONS } from "../admin-constants"

/**
 * Get all teams with their current plans
 */
export const getAllTeamsWithPlansAction = createServerAction()
	.input(
		z.object({
			page: z.number().min(1).default(1),
			pageSize: z
				.number()
				.min(1)
				.max(Math.max(...PAGE_SIZE_OPTIONS))
				.default(50),
			search: z.string().optional(),
			showPersonalTeams: z.boolean().default(false),
		}),
	)
	.handler(async ({ input }) => {
		await requireAdmin()

		const db = getDb()
		const { page, pageSize, search, showPersonalTeams } = input

		// Calculate offset
		const offset = (page - 1) * pageSize

		// Build where clause
		const conditions = []

		// Filter personal teams if needed
		if (!showPersonalTeams) {
			conditions.push(eq(teamTable.isPersonalTeam, 0))
		}

		// Search filter
		if (search?.trim()) {
			conditions.push(
				or(
					like(teamTable.name, `%${search}%`),
					like(teamTable.slug, `%${search}%`),
				),
			)
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined

		// Fetch total count
		const countResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(teamTable)
			.where(whereClause)

		const totalCount = countResult[0]?.count ?? 0

		// Fetch paginated teams
		const teams = await db.query.teamTable.findMany({
			where: whereClause,
			orderBy: (teams, { desc }) => [desc(teams.createdAt)],
			limit: pageSize,
			offset,
		})

		const data = teams.map((team) => ({
			id: team.id,
			name: team.name,
			slug: team.slug,
			isPersonalTeam: team.isPersonalTeam,
			currentPlanId: team.currentPlanId,
			createdAt: team.createdAt,
		}))

		return {
			success: true,
			data: {
				teams: data,
				totalCount,
				page,
				pageSize,
				totalPages: Math.ceil(totalCount / pageSize),
			},
		}
	})

/**
 * Update a team's plan
 */
export const updateTeamPlanAction = createServerAction()
	.input(
		z.object({
			teamId: z.string(),
			planId: z.string(),
			reason: z.string().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const admin = await requireAdmin()
		if (!admin) throw new ZSAError("UNAUTHORIZED", "Admin access required")

		const db = getDb()

		// Verify plan exists
		const plan = await db.query.planTable.findFirst({
			where: eq(planTable.id, input.planId),
		})

		if (!plan) {
			throw new ZSAError("NOT_FOUND", "Plan not found")
		}

		// Verify team exists
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, input.teamId),
		})

		if (!team) {
			throw new ZSAError("NOT_FOUND", "Team not found")
		}

		// Update team's plan
		await db
			.update(teamTable)
			.set({ currentPlanId: input.planId })
			.where(eq(teamTable.id, input.teamId))

		// Invalidate all team members' sessions to refresh plan data
		await invalidateTeamMembersSessions(input.teamId)

		console.log(
			`[Admin] ${admin.user.email} changed team ${team.name} plan to ${plan.name}${input.reason ? `: ${input.reason}` : ""}`,
		)

		return {
			success: true,
			message: `Team plan updated to ${plan.name}`,
		}
	})

/**
 * Add an entitlement override for a team
 */
export const addEntitlementOverrideAction = createServerAction()
	.input(
		z.object({
			teamId: z.string(),
			type: z.enum(["feature", "limit"]),
			key: z.string(),
			value: z.string(),
			reason: z.string(),
			expiresAt: z.date().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const admin = await requireAdmin()
		if (!admin) throw new ZSAError("UNAUTHORIZED", "Admin access required")

		const db = getDb()

		// Verify team exists
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, input.teamId),
		})

		if (!team) {
			throw new ZSAError("NOT_FOUND", "Team not found")
		}

		// Create override
		await db.insert(teamEntitlementOverrideTable).values({
			teamId: input.teamId,
			type: input.type,
			key: input.key,
			value: input.value,
			reason: input.reason,
			expiresAt: input.expiresAt,
			createdBy: admin.userId,
		})

		// Invalidate all team members' sessions to refresh entitlements
		await invalidateTeamMembersSessions(input.teamId)

		console.log(
			`[Admin] ${admin.user.email} added ${input.type} override for team ${team.name}: ${input.key}=${input.value} (${input.reason})`,
		)

		return {
			success: true,
			message: "Entitlement override added successfully",
		}
	})

/**
 * Get entitlement overrides for a team
 */
export const getTeamOverridesAction = createServerAction()
	.input(z.object({ teamId: z.string() }))
	.handler(async ({ input }) => {
		await requireAdmin()

		const db = getDb()

		const overrides = await db.query.teamEntitlementOverrideTable.findMany({
			where: eq(teamEntitlementOverrideTable.teamId, input.teamId),
			orderBy: (overrides, { desc }) => [desc(overrides.createdAt)],
		})

		return { success: true, data: overrides }
	})

/**
 * Remove an entitlement override
 */
export const removeEntitlementOverrideAction = createServerAction()
	.input(z.object({ overrideId: z.string() }))
	.handler(async ({ input }) => {
		const admin = await requireAdmin()
		if (!admin) throw new ZSAError("UNAUTHORIZED", "Admin access required")

		const db = getDb()

		// Get override to find team
		const override = await db.query.teamEntitlementOverrideTable.findFirst({
			where: eq(teamEntitlementOverrideTable.id, input.overrideId),
		})

		if (!override) {
			throw new ZSAError("NOT_FOUND", "Override not found")
		}

		// Delete override
		await db
			.delete(teamEntitlementOverrideTable)
			.where(eq(teamEntitlementOverrideTable.id, input.overrideId))

		// Invalidate all team members' sessions
		await invalidateTeamMembersSessions(override.teamId)

		console.log(
			`[Admin] ${admin.user.email} removed ${override.type} override: ${override.key}`,
		)

		return {
			success: true,
			message: "Override removed successfully",
		}
	})

/**
 * Get all available plans
 */
export const getAllPlansAction = createServerAction().handler(async () => {
	await requireAdmin()

	const db = getDb()

	const plans = await db.query.planTable.findMany({
		where: eq(planTable.isActive, 1),
		orderBy: (plans, { asc }) => [asc(plans.sortOrder)],
	})

	return { success: true, data: plans }
})

// ============================================================================
// Feature Management Actions
// ============================================================================

/**
 * Get all features
 */
export const getAllFeaturesAction = createServerAction().handler(async () => {
	await requireAdmin()

	const db = getDb()

	const features = await db.query.featureTable.findMany({
		orderBy: (features, { asc }) => [asc(features.category), asc(features.name)],
	})

	return { success: true, data: features }
})

/**
 * Create a new feature
 */
export const createFeatureAction = createServerAction()
	.input(
		z.object({
			key: z.string().min(1),
			name: z.string().min(1),
			description: z.string().optional(),
			category: z.enum([
				"workouts",
				"programming",
				"scaling",
				"ai",
				"team",
				"integration",
				"analytics",
			]),
			priority: z.enum(["high", "medium", "low"]).default("medium"),
		}),
	)
	.handler(async ({ input }) => {
		const admin = await requireAdmin()
		if (!admin) throw new ZSAError("UNAUTHORIZED", "Admin access required")

		const db = getDb()

		await db.insert(featureTable).values({
			...input,
			isActive: 1,
		})

		console.log(
			`[Admin] ${admin.user.email} created feature: ${input.name} (${input.key})`,
		)

		return { success: true, message: "Feature created successfully" }
	})

/**
 * Update a feature
 */
export const updateFeatureAction = createServerAction()
	.input(
		z.object({
			id: z.string(),
			name: z.string().min(1),
			description: z.string().optional(),
			category: z.enum([
				"workouts",
				"programming",
				"scaling",
				"ai",
				"team",
				"integration",
				"analytics",
			]),
			priority: z.enum(["high", "medium", "low"]),
			isActive: z.boolean(),
		}),
	)
	.handler(async ({ input }) => {
		const admin = await requireAdmin()
		if (!admin) throw new ZSAError("UNAUTHORIZED", "Admin access required")

		const db = getDb()

		const { id, ...updateData } = input

		await db
			.update(featureTable)
			.set({
				...updateData,
				isActive: updateData.isActive ? 1 : 0,
			})
			.where(eq(featureTable.id, id))

		console.log(`[Admin] ${admin.user.email} updated feature: ${id}`)

		return { success: true, message: "Feature updated successfully" }
	})

// ============================================================================
// Limit Management Actions
// ============================================================================

/**
 * Get all limits
 */
export const getAllLimitsAction = createServerAction().handler(async () => {
	await requireAdmin()

	const db = getDb()

	const limits = await db.query.limitTable.findMany({
		orderBy: (limits, { asc }) => [asc(limits.name)],
	})

	return { success: true, data: limits }
})

/**
 * Create a new limit
 */
export const createLimitAction = createServerAction()
	.input(
		z.object({
			key: z.string().min(1),
			name: z.string().min(1),
			description: z.string().optional(),
			unit: z.string().min(1),
			resetPeriod: z.enum(["monthly", "yearly", "never"]).default("never"),
			priority: z.enum(["high", "medium", "low"]).default("medium"),
		}),
	)
	.handler(async ({ input }) => {
		const admin = await requireAdmin()
		if (!admin) throw new ZSAError("UNAUTHORIZED", "Admin access required")

		const db = getDb()

		await db.insert(limitTable).values({
			...input,
			isActive: 1,
		})

		console.log(
			`[Admin] ${admin.user.email} created limit: ${input.name} (${input.key})`,
		)

		return { success: true, message: "Limit created successfully" }
	})

/**
 * Update a limit
 */
export const updateLimitAction = createServerAction()
	.input(
		z.object({
			id: z.string(),
			name: z.string().min(1),
			description: z.string().optional(),
			unit: z.string().min(1),
			resetPeriod: z.enum(["monthly", "yearly", "never"]),
			priority: z.enum(["high", "medium", "low"]),
			isActive: z.boolean(),
		}),
	)
	.handler(async ({ input }) => {
		const admin = await requireAdmin()
		if (!admin) throw new ZSAError("UNAUTHORIZED", "Admin access required")

		const db = getDb()

		const { id, ...updateData} = input

		await db
			.update(limitTable)
			.set({
				...updateData,
				isActive: updateData.isActive ? 1 : 0,
			})
			.where(eq(limitTable.id, id))

		console.log(`[Admin] ${admin.user.email} updated limit: ${id}`)

		return { success: true, message: "Limit updated successfully" }
	})
