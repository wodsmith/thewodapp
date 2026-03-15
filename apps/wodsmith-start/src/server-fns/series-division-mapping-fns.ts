/**
 * Series Division Mapping Server Functions
 *
 * CRUD for mapping competition divisions → series template divisions,
 * plus auto-mapping algorithm using fuzzy label matching.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	competitionGroupsTable,
	competitionsTable,
} from "@/db/schemas/competitions"
import {
	createScalingGroupId,
	createScalingLevelId,
} from "@/db/schemas/common"
import {
	scalingGroupsTable,
	scalingLevelsTable,
} from "@/db/schemas/scaling"
import { seriesDivisionMappingsTable } from "@/db/schemas/series"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { getSessionFromCookie } from "@/utils/auth"
import { requireTeamPermission } from "@/utils/team-auth"
import {
	parseSeriesSettings,
	stringifySeriesSettings,
} from "@/types/competitions"
import { parseCompetitionSettings } from "./competition-divisions-fns"

// ============================================================================
// Types
// ============================================================================

export interface SeriesDivisionMappingData {
	competitionId: string
	competitionName: string
	mappings: Array<{
		competitionDivisionId: string
		competitionDivisionLabel: string
		seriesDivisionId: string | null
		confidence: "exact" | "fuzzy" | "none"
	}>
}

export interface SeriesTemplateData {
	scalingGroupId: string
	scalingGroupTitle: string
	divisions: Array<{
		id: string
		label: string
		position: number
		teamSize: number
	}>
}

// ============================================================================
// Auto-mapping algorithm
// ============================================================================

/**
 * Aggressively normalize a division label for comparison.
 * Handles the real-world variations seen across MWFC competitions:
 * - "Men's Individual RX" vs "Men's Masters 35+ Individual RX (Indy)"
 * - "M35+ Men's Teams RX" vs "Masters 35+ Men's Teams RX"
 *
 * Strategy: strip noise, normalize abbreviations, sort tokens for
 * order-independent comparison. A strict match on this normalized
 * form catches ~95% of real cases without Jaccard/NLP overhead.
 */
function normalizeLabel(label: string): string {
	let n = label.toLowerCase().trim()
	// Remove all parenthesized suffixes: (Indy), (Individual), (Team), etc.
	n = n.replace(/\s*\([^)]*\)\s*/g, " ")
	// Normalize possessives: women's → women, men's → men
	n = n.replace(/\bwomen['']s\b/g, "women")
	n = n.replace(/\bmen['']s\b/g, "men")
	// Normalize masters variants: "Masters 35+", "Master 35+", "M35+" → "m35+"
	n = n.replace(/\bmasters?\s*(\d+)\+?\b/g, "m$1+")
	// Already-abbreviated form: "M35+" → "m35+"
	n = n.replace(/\bm(\d+)\+/g, "m$1+")
	// Normalize "individual" → "indiv"
	n = n.replace(/\bindividual\b/g, "indiv")
	// Strip common filler words
	n = n.replace(/\b(the|and|&|of)\b/g, "")
	// Collapse whitespace, trim
	n = n.replace(/\s+/g, " ").trim()
	return n
}

/**
 * Create a sort-stable key from a label for order-independent matching.
 * "men indiv rx" and "indiv men rx" both produce "indiv men rx".
 */
function sortedKey(label: string): string {
	return normalizeLabel(label).split(" ").sort().join(" ")
}

/**
 * Auto-map competition divisions to series template divisions.
 * Uses a two-pass approach:
 *   1. Exact case-insensitive match
 *   2. Normalized + token-sorted match (catches word-order and abbreviation diffs)
 * No Jaccard / NLP — simple, fast, and right for 95%+ of real data.
 */
function autoMapDivisions(
	compDivisions: Array<{ id: string; label: string }>,
	seriesDivisions: Array<{ id: string; label: string }>,
): Array<{
	competitionDivisionId: string
	competitionDivisionLabel: string
	seriesDivisionId: string | null
	confidence: "exact" | "fuzzy" | "none"
}> {
	// Pre-compute normalized + sorted keys for series divisions
	const seriesKeys = seriesDivisions.map((sd) => ({
		...sd,
		normalized: normalizeLabel(sd.label),
		sorted: sortedKey(sd.label),
	}))

	return compDivisions.map((compDiv) => {
		const compLower = compDiv.label.toLowerCase().trim()

		// 1. Exact match (case-insensitive)
		const exactMatch = seriesDivisions.find(
			(sd) => sd.label.toLowerCase().trim() === compLower,
		)
		if (exactMatch) {
			return {
				competitionDivisionId: compDiv.id,
				competitionDivisionLabel: compDiv.label,
				seriesDivisionId: exactMatch.id,
				confidence: "exact" as const,
			}
		}

		// 2. Normalized match (handles abbreviation/suffix differences)
		const compNormalized = normalizeLabel(compDiv.label)
		const normalizedMatch = seriesKeys.find(
			(sd) => sd.normalized === compNormalized,
		)
		if (normalizedMatch) {
			return {
				competitionDivisionId: compDiv.id,
				competitionDivisionLabel: compDiv.label,
				seriesDivisionId: normalizedMatch.id,
				confidence: "fuzzy" as const,
			}
		}

		// 3. Sorted-token match (handles word-order differences)
		const compSorted = sortedKey(compDiv.label)
		const sortedMatch = seriesKeys.find(
			(sd) => sd.sorted === compSorted,
		)
		if (sortedMatch) {
			return {
				competitionDivisionId: compDiv.id,
				competitionDivisionLabel: compDiv.label,
				seriesDivisionId: sortedMatch.id,
				confidence: "fuzzy" as const,
			}
		}

		// 4. No match
		return {
			competitionDivisionId: compDiv.id,
			competitionDivisionLabel: compDiv.label,
			seriesDivisionId: null,
			confidence: "none" as const,
		}
	})
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get the series division template and all competition mappings.
 * This is the main data loader for the mapping configuration page.
 */
export const getSeriesDivisionMappingsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				groupId: z.string().min(1),
			})
			.parse(data),
	)
	.handler(
		async ({
			data,
		}): Promise<{
			template: SeriesTemplateData | null
			competitionMappings: SeriesDivisionMappingData[]
			availableScalingGroups: Array<{
				id: string
				title: string
				levels: Array<{ id: string; label: string; teamSize: number }>
			}>
		}> => {
			const db = getDb()
			const session = await getSessionFromCookie()
			if (!session?.userId) throw new Error("Not authenticated")

			// Load group
			const [group] = await db
				.select()
				.from(competitionGroupsTable)
				.where(eq(competitionGroupsTable.id, data.groupId))
			if (!group) throw new Error("Series group not found")

			await requireTeamPermission(
				group.organizingTeamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)

			const seriesSettings = parseSeriesSettings(group.settings)
			const templateGroupId = seriesSettings?.scalingGroupId

			// Load template if it exists
			let template: SeriesTemplateData | null = null
			if (templateGroupId) {
				const [scalingGroup] = await db
					.select()
					.from(scalingGroupsTable)
					.where(eq(scalingGroupsTable.id, templateGroupId))

				if (scalingGroup) {
					const levels = await db
						.select()
						.from(scalingLevelsTable)
						.where(eq(scalingLevelsTable.scalingGroupId, templateGroupId))
						.orderBy(scalingLevelsTable.position)

					template = {
						scalingGroupId: scalingGroup.id,
						scalingGroupTitle: scalingGroup.title,
						divisions: levels.map((l) => ({
							id: l.id,
							label: l.label,
							position: l.position,
							teamSize: l.teamSize,
						})),
					}
				}
			}

			// Load all competitions in this series
			const comps = await db
				.select({
					id: competitionsTable.id,
					name: competitionsTable.name,
					settings: competitionsTable.settings,
				})
				.from(competitionsTable)
				.where(eq(competitionsTable.groupId, data.groupId))

			// Load existing mappings
			const existingMappings =
				comps.length > 0
					? await db
							.select()
							.from(seriesDivisionMappingsTable)
							.where(
								eq(seriesDivisionMappingsTable.groupId, data.groupId),
							)
					: []

			// Build mapping data per competition
			const competitionMappings: SeriesDivisionMappingData[] = []

			for (const comp of comps) {
				const compSettings = parseCompetitionSettings(comp.settings)
				const compScalingGroupId =
					compSettings?.divisions?.scalingGroupId
				if (!compScalingGroupId) {
					// Competition has no divisions configured
					competitionMappings.push({
						competitionId: comp.id,
						competitionName: comp.name,
						mappings: [],
					})
					continue
				}

				// Load competition's divisions
				const compDivisions = await db
					.select({
						id: scalingLevelsTable.id,
						label: scalingLevelsTable.label,
					})
					.from(scalingLevelsTable)
					.where(
						eq(
							scalingLevelsTable.scalingGroupId,
							compScalingGroupId,
						),
					)
					.orderBy(scalingLevelsTable.position)

				// Check for existing mappings for this competition
				const compExistingMappings = existingMappings.filter(
					(m) => m.competitionId === comp.id,
				)

				if (compExistingMappings.length > 0) {
					// Use existing saved mappings
					const mappings = compDivisions.map((div) => {
						const existing = compExistingMappings.find(
							(m) => m.competitionDivisionId === div.id,
						)
						return {
							competitionDivisionId: div.id,
							competitionDivisionLabel: div.label,
							seriesDivisionId: existing?.seriesDivisionId ?? null,
							confidence: existing
								? ("exact" as const)
								: ("none" as const),
						}
					})
					competitionMappings.push({
						competitionId: comp.id,
						competitionName: comp.name,
						mappings,
					})
				} else if (template) {
					// Auto-map using fuzzy matching
					const autoMapped = autoMapDivisions(
						compDivisions,
						template.divisions,
					)
					competitionMappings.push({
						competitionId: comp.id,
						competitionName: comp.name,
						mappings: autoMapped,
					})
				} else {
					// No template, no mappings
					competitionMappings.push({
						competitionId: comp.id,
						competitionName: comp.name,
						mappings: compDivisions.map((div) => ({
							competitionDivisionId: div.id,
							competitionDivisionLabel: div.label,
							seriesDivisionId: null,
							confidence: "none" as const,
						})),
					})
				}
			}

			// Load available scaling groups for template selection
			// Include all team scaling groups + the ones used by competitions
			const allScalingGroupIds = new Set<string>()
			for (const comp of comps) {
				const compSettings = parseCompetitionSettings(comp.settings)
				const sgId = compSettings?.divisions?.scalingGroupId
				if (sgId) allScalingGroupIds.add(sgId)
			}

			const teamScalingGroups = await db
				.select()
				.from(scalingGroupsTable)
				.where(eq(scalingGroupsTable.teamId, group.organizingTeamId))

			for (const sg of teamScalingGroups) {
				allScalingGroupIds.add(sg.id)
			}

			// Load levels for all groups
			const allGroupIds = Array.from(allScalingGroupIds)
			const allLevels =
				allGroupIds.length > 0
					? await db
							.select()
							.from(scalingLevelsTable)
							.where(
								inArray(
									scalingLevelsTable.scalingGroupId,
									allGroupIds,
								),
							)
							.orderBy(scalingLevelsTable.position)
					: []

			// Build all scaling groups (team groups + groups referenced by comps)
			const allGroups = new Map<
				string,
				{ id: string; title: string }
			>()
			for (const sg of teamScalingGroups) {
				allGroups.set(sg.id, { id: sg.id, title: sg.title })
			}
			// Add any groups from comps not already present
			for (const sgId of allScalingGroupIds) {
				if (!allGroups.has(sgId)) {
					const [sg] = await db
						.select()
						.from(scalingGroupsTable)
						.where(eq(scalingGroupsTable.id, sgId))
					if (sg) allGroups.set(sg.id, { id: sg.id, title: sg.title })
				}
			}

			const availableScalingGroups = Array.from(allGroups.values()).map(
				(sg) => ({
					...sg,
					levels: allLevels
						.filter((l) => l.scalingGroupId === sg.id)
						.map((l) => ({
							id: l.id,
							label: l.label,
							teamSize: l.teamSize,
						})),
				}),
			)

			return {
				template,
				competitionMappings,
				availableScalingGroups,
			}
		},
	)

/**
 * Create or update the series template from an existing scaling group.
 * Clones the scaling group as the series template.
 */
export const setSeriesTemplateFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				groupId: z.string().min(1),
				sourceScalingGroupId: z.string().min(1),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()
		const session = await getSessionFromCookie()
		if (!session?.userId) throw new Error("Not authenticated")

		const [group] = await db
			.select()
			.from(competitionGroupsTable)
			.where(eq(competitionGroupsTable.id, data.groupId))
		if (!group) throw new Error("Series group not found")

		await requireTeamPermission(
			group.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		// Load source scaling group and its levels
		const [sourceGroup] = await db
			.select()
			.from(scalingGroupsTable)
			.where(eq(scalingGroupsTable.id, data.sourceScalingGroupId))
		if (!sourceGroup) throw new Error("Source scaling group not found")

		const sourceLevels = await db
			.select()
			.from(scalingLevelsTable)
			.where(
				eq(
					scalingLevelsTable.scalingGroupId,
					data.sourceScalingGroupId,
				),
			)
			.orderBy(scalingLevelsTable.position)

		const seriesSettings = parseSeriesSettings(group.settings)
		const existingTemplateId = seriesSettings?.scalingGroupId

		// If a template already exists, delete its old levels and reuse the group
		if (existingTemplateId) {
			await db
				.delete(scalingLevelsTable)
				.where(
					eq(scalingLevelsTable.scalingGroupId, existingTemplateId),
				)

			await db
				.update(scalingGroupsTable)
				.set({
					title: `${group.name} Series Divisions`,
					updatedAt: new Date(),
				})
				.where(eq(scalingGroupsTable.id, existingTemplateId))

			// Clone levels into existing template group
			for (const level of sourceLevels) {
				await db.insert(scalingLevelsTable).values({
					id: createScalingLevelId(),
					scalingGroupId: existingTemplateId,
					label: level.label,
					position: level.position,
					teamSize: level.teamSize,
				})
			}

			// Clear old mappings since template changed
			await db
				.delete(seriesDivisionMappingsTable)
				.where(
					eq(seriesDivisionMappingsTable.groupId, data.groupId),
				)

			return { scalingGroupId: existingTemplateId }
		}

		// Create new template scaling group
		const newGroupId = createScalingGroupId()
		await db.insert(scalingGroupsTable).values({
			id: newGroupId,
			title: `${group.name} Series Divisions`,
			teamId: group.organizingTeamId,
			isDefault: false,
			isSystem: false,
		})

		// Clone levels
		for (const level of sourceLevels) {
			await db.insert(scalingLevelsTable).values({
				id: createScalingLevelId(),
				scalingGroupId: newGroupId,
				label: level.label,
				position: level.position,
				teamSize: level.teamSize,
			})
		}

		// Save to series settings
		const newSettings = stringifySeriesSettings({
			...seriesSettings,
			scalingGroupId: newGroupId,
		})
		await db
			.update(competitionGroupsTable)
			.set({ settings: newSettings, updatedAt: new Date() })
			.where(eq(competitionGroupsTable.id, data.groupId))

		return { scalingGroupId: newGroupId }
	})

/**
 * Create a series template from scratch with custom division labels.
 */
export const createSeriesTemplateFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				groupId: z.string().min(1),
				divisions: z
					.array(
						z.object({
							label: z.string().min(1),
							teamSize: z.number().int().min(1).default(1),
						}),
					)
					.min(1),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()
		const session = await getSessionFromCookie()
		if (!session?.userId) throw new Error("Not authenticated")

		const [group] = await db
			.select()
			.from(competitionGroupsTable)
			.where(eq(competitionGroupsTable.id, data.groupId))
		if (!group) throw new Error("Series group not found")

		await requireTeamPermission(
			group.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		const seriesSettings = parseSeriesSettings(group.settings)
		const existingTemplateId = seriesSettings?.scalingGroupId

		let templateGroupId: string

		if (existingTemplateId) {
			// Reuse existing template group
			templateGroupId = existingTemplateId

			// Clear old levels and mappings
			await db
				.delete(scalingLevelsTable)
				.where(
					eq(scalingLevelsTable.scalingGroupId, existingTemplateId),
				)
			await db
				.delete(seriesDivisionMappingsTable)
				.where(
					eq(seriesDivisionMappingsTable.groupId, data.groupId),
				)

			await db
				.update(scalingGroupsTable)
				.set({
					title: `${group.name} Series Divisions`,
					updatedAt: new Date(),
				})
				.where(eq(scalingGroupsTable.id, existingTemplateId))
		} else {
			// Create new template group
			templateGroupId = createScalingGroupId()
			await db.insert(scalingGroupsTable).values({
				id: templateGroupId,
				title: `${group.name} Series Divisions`,
				teamId: group.organizingTeamId,
				isDefault: false,
				isSystem: false,
			})

			// Save to series settings
			const newSettings = stringifySeriesSettings({
				...seriesSettings,
				scalingGroupId: templateGroupId,
			})
			await db
				.update(competitionGroupsTable)
				.set({ settings: newSettings, updatedAt: new Date() })
				.where(eq(competitionGroupsTable.id, data.groupId))
		}

		// Create divisions
		for (let i = 0; i < data.divisions.length; i++) {
			const div = data.divisions[i]
			await db.insert(scalingLevelsTable).values({
				id: createScalingLevelId(),
				scalingGroupId: templateGroupId,
				label: div.label,
				position: i,
				teamSize: div.teamSize,
			})
		}

		return { scalingGroupId: templateGroupId }
	})

/**
 * Save all division mappings for a series.
 * Replaces all existing mappings with the provided ones.
 */
export const saveSeriesDivisionMappingsFn = createServerFn({
	method: "POST",
})
	.inputValidator((data: unknown) =>
		z
			.object({
				groupId: z.string().min(1),
				mappings: z.array(
					z.object({
						competitionId: z.string().min(1),
						competitionDivisionId: z.string().min(1),
						seriesDivisionId: z.string().min(1),
					}),
				),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()
		const session = await getSessionFromCookie()
		if (!session?.userId) throw new Error("Not authenticated")

		const [group] = await db
			.select()
			.from(competitionGroupsTable)
			.where(eq(competitionGroupsTable.id, data.groupId))
		if (!group) throw new Error("Series group not found")

		await requireTeamPermission(
			group.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		// Delete all existing mappings for this series
		await db
			.delete(seriesDivisionMappingsTable)
			.where(eq(seriesDivisionMappingsTable.groupId, data.groupId))

		// Insert new mappings
		if (data.mappings.length > 0) {
			await db.insert(seriesDivisionMappingsTable).values(
				data.mappings.map((m) => ({
					groupId: data.groupId,
					competitionId: m.competitionId,
					competitionDivisionId: m.competitionDivisionId,
					seriesDivisionId: m.seriesDivisionId,
				})),
			)
		}

		return { success: true, mappingCount: data.mappings.length }
	})

/**
 * Auto-map all competition divisions to the series template.
 * Does not save — returns proposed mappings for the UI to display.
 */
export const autoMapSeriesDivisionsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				groupId: z.string().min(1),
			})
			.parse(data),
	)
	.handler(
		async ({
			data,
		}): Promise<{
			competitionMappings: SeriesDivisionMappingData[]
		}> => {
			const db = getDb()
			const session = await getSessionFromCookie()
			if (!session?.userId) throw new Error("Not authenticated")

			const [group] = await db
				.select()
				.from(competitionGroupsTable)
				.where(eq(competitionGroupsTable.id, data.groupId))
			if (!group) throw new Error("Series group not found")

			await requireTeamPermission(
				group.organizingTeamId,
				TEAM_PERMISSIONS.ACCESS_DASHBOARD,
			)

			const seriesSettings = parseSeriesSettings(group.settings)
			const templateGroupId = seriesSettings?.scalingGroupId
			if (!templateGroupId) {
				return { competitionMappings: [] }
			}

			// Load series template divisions
			const seriesDivisions = await db
				.select({
					id: scalingLevelsTable.id,
					label: scalingLevelsTable.label,
				})
				.from(scalingLevelsTable)
				.where(
					eq(scalingLevelsTable.scalingGroupId, templateGroupId),
				)
				.orderBy(scalingLevelsTable.position)

			// Load competitions
			const comps = await db
				.select({
					id: competitionsTable.id,
					name: competitionsTable.name,
					settings: competitionsTable.settings,
				})
				.from(competitionsTable)
				.where(eq(competitionsTable.groupId, data.groupId))

			const competitionMappings: SeriesDivisionMappingData[] = []

			for (const comp of comps) {
				const compSettings = parseCompetitionSettings(comp.settings)
				const compScalingGroupId =
					compSettings?.divisions?.scalingGroupId
				if (!compScalingGroupId) {
					competitionMappings.push({
						competitionId: comp.id,
						competitionName: comp.name,
						mappings: [],
					})
					continue
				}

				const compDivisions = await db
					.select({
						id: scalingLevelsTable.id,
						label: scalingLevelsTable.label,
					})
					.from(scalingLevelsTable)
					.where(
						eq(
							scalingLevelsTable.scalingGroupId,
							compScalingGroupId,
						),
					)
					.orderBy(scalingLevelsTable.position)

				const autoMapped = autoMapDivisions(
					compDivisions,
					seriesDivisions,
				)
				competitionMappings.push({
					competitionId: comp.id,
					competitionName: comp.name,
					mappings: autoMapped,
				})
			}

			return { competitionMappings }
		},
	)
