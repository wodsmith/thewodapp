/**
 * @fileoverview Division management tools for the Setup Agent.
 *
 * Divisions in WODsmith are based on scaling levels from a scaling group.
 * The competitionDivisionsTable stores competition-specific overrides
 * (fees, descriptions) for each division.
 */

import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { createId } from "@paralleldrive/cuid2"

import { getDb } from "@/db"
import { competitionsTable } from "@/db/schemas/competitions"
import { competitionDivisionsTable } from "@/db/schemas/commerce"
import { scalingGroupsTable, scalingLevelsTable } from "@/db/schemas/scaling"
import {
	parseCompetitionSettings,
	stringifyCompetitionSettings,
} from "@/types/competitions"

/**
 * List all divisions for a competition with registration counts.
 */
export const listDivisions = createTool({
	id: "list-divisions",
	description:
		"List all divisions for a competition including fees, descriptions, and registration counts. Divisions are based on the competition's scaling group.",
	inputSchema: z.object({
		competitionId: z.string().describe("The competition ID"),
	}),
	execute: async (inputData, context) => {
		const { competitionId } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Get competition and verify access
		const competition = await db.query.competitionsTable.findFirst({
			where: and(
				eq(competitionsTable.id, competitionId),
				teamId ? eq(competitionsTable.organizingTeamId, teamId) : undefined,
			),
		})

		if (!competition) {
			return { error: "Competition not found or access denied" }
		}

		const settings = parseCompetitionSettings(competition.settings)
		const scalingGroupId = settings?.divisions?.scalingGroupId

		if (!scalingGroupId) {
			return {
				divisions: [],
				message: "No scaling group configured for this competition",
			}
		}

		// Get divisions with overrides
		const divisions = await db
			.select({
				id: scalingLevelsTable.id,
				label: scalingLevelsTable.label,
				position: scalingLevelsTable.position,
				teamSize: scalingLevelsTable.teamSize,
				description: competitionDivisionsTable.description,
				feeCents: competitionDivisionsTable.feeCents,
			})
			.from(scalingLevelsTable)
			.leftJoin(
				competitionDivisionsTable,
				and(
					eq(competitionDivisionsTable.divisionId, scalingLevelsTable.id),
					eq(competitionDivisionsTable.competitionId, competitionId),
				),
			)
			.where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))
			.orderBy(scalingLevelsTable.position)

		return {
			scalingGroupId,
			divisions: divisions.map((d) => ({
				id: d.id,
				name: d.label,
				position: d.position,
				teamSize: d.teamSize,
				description: d.description,
				feeCents: d.feeCents,
			})),
		}
	},
})

/**
 * Update division configuration (fee and description) for a competition.
 */
export const updateDivision = createTool({
	id: "update-division",
	description:
		"Update a division's fee and/or description for a competition. Creates the division config if it doesn't exist.",
	inputSchema: z.object({
		competitionId: z.string().describe("The competition ID"),
		divisionId: z.string().describe("The division (scaling level) ID"),
		feeCents: z
			.number()
			.min(0)
			.optional()
			.describe("Registration fee in cents (e.g., 15000 = $150)"),
		description: z
			.string()
			.max(2000)
			.optional()
			.describe("Markdown description explaining who this division is for"),
	}),
	execute: async (inputData, context) => {
		const { competitionId, divisionId, feeCents, description } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Verify competition access
		const competition = await db.query.competitionsTable.findFirst({
			where: and(
				eq(competitionsTable.id, competitionId),
				teamId ? eq(competitionsTable.organizingTeamId, teamId) : undefined,
			),
		})

		if (!competition) {
			return { error: "Competition not found or access denied" }
		}

		// Verify division exists in the scaling group
		const settings = parseCompetitionSettings(competition.settings)
		const scalingGroupId = settings?.divisions?.scalingGroupId

		if (!scalingGroupId) {
			return { error: "No scaling group configured for this competition" }
		}

		const division = await db.query.scalingLevelsTable.findFirst({
			where: and(
				eq(scalingLevelsTable.id, divisionId),
				eq(scalingLevelsTable.scalingGroupId, scalingGroupId),
			),
		})

		if (!division) {
			return { error: "Division not found in competition's scaling group" }
		}

		// Check if config exists
		const existing = await db.query.competitionDivisionsTable.findFirst({
			where: and(
				eq(competitionDivisionsTable.competitionId, competitionId),
				eq(competitionDivisionsTable.divisionId, divisionId),
			),
		})

		if (existing) {
			// Update existing
			await db
				.update(competitionDivisionsTable)
				.set({
					...(feeCents !== undefined && { feeCents }),
					...(description !== undefined && { description }),
					updatedAt: new Date(),
				})
				.where(eq(competitionDivisionsTable.id, existing.id))
		} else {
			// Create new
			if (feeCents === undefined) {
				return { error: "feeCents is required when creating division config" }
			}
			await db.insert(competitionDivisionsTable).values({
				competitionId,
				divisionId,
				feeCents,
				description: description ?? null,
			})
		}

		return {
			success: true,
			division: {
				id: divisionId,
				name: division.label,
				feeCents: feeCents ?? existing?.feeCents,
				description: description ?? existing?.description,
			},
		}
	},
})

/**
 * Create a new division (scaling level) in the competition's scaling group.
 */
export const createDivision = createTool({
	id: "create-division",
	description:
		"Create a new division for a competition. This adds a new scaling level to the competition's scaling group.",
	inputSchema: z.object({
		competitionId: z.string().describe("The competition ID"),
		name: z
			.string()
			.min(1)
			.max(100)
			.describe("Division name (e.g., 'Rx Men', 'Scaled Women')"),
		teamSize: z
			.number()
			.min(1)
			.default(1)
			.describe("Team size for this division (1 = individual)"),
		feeCents: z.number().min(0).describe("Registration fee in cents"),
		description: z
			.string()
			.max(2000)
			.optional()
			.describe("Description of who this division is for"),
		position: z
			.number()
			.optional()
			.describe("Sort order (0 = first). If not provided, adds at the end."),
	}),
	execute: async (inputData, context) => {
		const { competitionId, name, teamSize, feeCents, description, position } =
			inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Verify competition access
		const competition = await db.query.competitionsTable.findFirst({
			where: and(
				eq(competitionsTable.id, competitionId),
				teamId ? eq(competitionsTable.organizingTeamId, teamId) : undefined,
			),
		})

		if (!competition) {
			return { error: "Competition not found or access denied" }
		}

		const settings = parseCompetitionSettings(competition.settings)
		let scalingGroupId = settings?.divisions?.scalingGroupId

		// If no scaling group, create one for this competition
		if (!scalingGroupId) {
			const newGroupId = `sg_${createId()}`
			await db
				.insert(scalingGroupsTable)
				.values({
					id: newGroupId,
					title: `${competition.name} Divisions`,
					teamId: teamId ?? null,
					isDefault: 0,
					isSystem: 0,
				})

			scalingGroupId = newGroupId

			// Update competition settings
			const newSettings = {
				...settings,
				divisions: {
					...settings?.divisions,
					scalingGroupId,
				},
			}
			await db
				.update(competitionsTable)
				.set({ settings: stringifyCompetitionSettings(newSettings) })
				.where(eq(competitionsTable.id, competitionId))
		}

		// Get max position if not provided
		let finalPosition = position
		if (finalPosition === undefined) {
			const existing = await db.query.scalingLevelsTable.findMany({
				where: eq(scalingLevelsTable.scalingGroupId, scalingGroupId),
				orderBy: (l, { desc }) => [desc(l.position)],
				limit: 1,
			})
			finalPosition = existing.length > 0 ? existing[0].position + 1 : 0
		}

		// Create the scaling level (division)
		const newDivisionId = `sl_${createId()}`
		await db
			.insert(scalingLevelsTable)
			.values({
				id: newDivisionId,
				scalingGroupId: scalingGroupId,
				label: name,
				position: finalPosition,
				teamSize,
			})

		// Create the competition-specific config
		await db.insert(competitionDivisionsTable).values({
			competitionId,
			divisionId: newDivisionId,
			feeCents,
			description: description ?? null,
		})

		return {
			success: true,
			division: {
				id: newDivisionId,
				name,
				position: finalPosition,
				teamSize,
				feeCents,
				description,
			},
		}
	},
})

/**
 * Delete a division from a competition.
 * Only allowed if no athletes are registered in this division.
 */
export const deleteDivision = createTool({
	id: "delete-division",
	description:
		"Delete a division from a competition. Only allowed if no athletes are registered in this division.",
	inputSchema: z.object({
		competitionId: z.string().describe("The competition ID"),
		divisionId: z
			.string()
			.describe("The division (scaling level) ID to delete"),
	}),
	execute: async (inputData, context) => {
		const { competitionId, divisionId } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Verify competition access
		const competition = await db.query.competitionsTable.findFirst({
			where: and(
				eq(competitionsTable.id, competitionId),
				teamId ? eq(competitionsTable.organizingTeamId, teamId) : undefined,
			),
		})

		if (!competition) {
			return { error: "Competition not found or access denied" }
		}

		// Check for registrations in this division
		const { competitionRegistrationsTable } = await import(
			"@/db/schemas/competitions"
		)
		const registrations = await db.query.competitionRegistrationsTable.findMany(
			{
				where: and(
					eq(competitionRegistrationsTable.eventId, competitionId),
					eq(competitionRegistrationsTable.divisionId, divisionId),
				),
				limit: 1,
			},
		)

		if (registrations.length > 0) {
			return {
				error: "Cannot delete division with registered athletes",
				registrationCount: registrations.length,
			}
		}

		// Delete competition-specific division config only
		// NOTE: We intentionally do NOT delete the scaling level itself because:
		// 1. Scaling groups/levels can be shared across multiple competitions
		// 2. Deleting the scaling level would break other competitions using the same group
		// 3. The scaling level can be managed separately via scaling group tools
		await db
			.delete(competitionDivisionsTable)
			.where(
				and(
					eq(competitionDivisionsTable.competitionId, competitionId),
					eq(competitionDivisionsTable.divisionId, divisionId),
				),
			)

		return {
			success: true,
			message: "Division removed from competition successfully",
		}
	},
})

/**
 * Suggest division structure based on competition type and size.
 */
export const suggestDivisions = createTool({
	id: "suggest-divisions",
	description:
		"Suggest appropriate division structure based on competition type and expected attendance. Returns division recommendations with estimated athlete distribution.",
	inputSchema: z.object({
		competitionType: z
			.enum(["individual", "team", "pairs"])
			.describe("Type of competition"),
		expectedAthletes: z.number().describe("Expected total number of athletes"),
		includeScaled: z
			.boolean()
			.default(true)
			.describe("Include Scaled divisions"),
		includeMasters: z
			.boolean()
			.default(false)
			.describe("Include Masters age divisions"),
		includeTeens: z.boolean().default(false).describe("Include Teen divisions"),
	}),
	execute: async (inputData) => {
		const {
			competitionType,
			expectedAthletes,
			includeScaled,
			includeMasters,
			includeTeens,
		} = inputData

		const suggestions: Array<{
			name: string
			description: string
			estimatedAthletes: number
			teamSize: number
		}> = []
		const notes: string[] = []

		if (competitionType === "individual") {
			const rxPct = includeScaled ? 0.25 : 0.5
			suggestions.push({
				name: "Rx Men",
				description:
					"Advanced male athletes - prescribed weights and movements",
				estimatedAthletes: Math.round(expectedAthletes * rxPct),
				teamSize: 1,
			})
			suggestions.push({
				name: "Rx Women",
				description:
					"Advanced female athletes - prescribed weights and movements",
				estimatedAthletes: Math.round(expectedAthletes * rxPct),
				teamSize: 1,
			})

			if (includeScaled) {
				suggestions.push({
					name: "Scaled Men",
					description:
						"Intermediate male athletes - modified weights/movements",
					estimatedAthletes: Math.round(expectedAthletes * 0.25),
					teamSize: 1,
				})
				suggestions.push({
					name: "Scaled Women",
					description:
						"Intermediate female athletes - modified weights/movements",
					estimatedAthletes: Math.round(expectedAthletes * 0.25),
					teamSize: 1,
				})
			}

			if (includeMasters) {
				notes.push(
					"Consider Masters 35+, 40+, 45+, 50+, 55+, 60+ based on expected turnout",
				)
				suggestions.push({
					name: "Masters 35+ Men",
					description: "Male athletes 35 years and older",
					estimatedAthletes: Math.round(expectedAthletes * 0.1),
					teamSize: 1,
				})
				suggestions.push({
					name: "Masters 35+ Women",
					description: "Female athletes 35 years and older",
					estimatedAthletes: Math.round(expectedAthletes * 0.1),
					teamSize: 1,
				})
			}

			if (includeTeens) {
				suggestions.push({
					name: "Teen Boys (14-17)",
					description: "Male athletes aged 14-17",
					estimatedAthletes: Math.round(expectedAthletes * 0.05),
					teamSize: 1,
				})
				suggestions.push({
					name: "Teen Girls (14-17)",
					description: "Female athletes aged 14-17",
					estimatedAthletes: Math.round(expectedAthletes * 0.05),
					teamSize: 1,
				})
			}
		} else if (competitionType === "team") {
			suggestions.push({
				name: "Rx Teams",
				description: "Advanced teams - prescribed weights and movements",
				estimatedAthletes: Math.round(expectedAthletes * 0.6),
				teamSize: 4,
			})
			if (includeScaled) {
				suggestions.push({
					name: "Scaled Teams",
					description: "Intermediate teams - modified weights/movements",
					estimatedAthletes: Math.round(expectedAthletes * 0.4),
					teamSize: 4,
				})
			}
			notes.push(
				"Specify team composition (e.g., 2M/2F) in division description",
			)
		} else if (competitionType === "pairs") {
			suggestions.push({
				name: "Rx Male Pairs",
				description: "Two male athletes - prescribed weights",
				estimatedAthletes: Math.round(expectedAthletes * 0.2),
				teamSize: 2,
			})
			suggestions.push({
				name: "Rx Female Pairs",
				description: "Two female athletes - prescribed weights",
				estimatedAthletes: Math.round(expectedAthletes * 0.2),
				teamSize: 2,
			})
			suggestions.push({
				name: "Rx Mixed Pairs",
				description: "One male, one female athlete - prescribed weights",
				estimatedAthletes: Math.round(expectedAthletes * 0.2),
				teamSize: 2,
			})
			if (includeScaled) {
				suggestions.push({
					name: "Scaled Mixed Pairs",
					description: "One male, one female athlete - modified weights",
					estimatedAthletes: Math.round(expectedAthletes * 0.4),
					teamSize: 2,
				})
			}
		}

		if (expectedAthletes > 150) {
			notes.push("Large competition - consider adding more age group divisions")
		}
		if (expectedAthletes < 30) {
			notes.push(
				"Small competition - consider combining divisions for competitive heats",
			)
		}

		return { suggestions, notes }
	},
})
