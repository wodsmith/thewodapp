/**
 * Competition Registration Questions Server Functions
 * CRUD operations for custom registration questions that organizers can create
 */

import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	competitionRegistrationAnswersTable,
	competitionRegistrationQuestionsTable,
	competitionRegistrationsTable,
	competitionsTable,
} from "@/db/schemas/competitions"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { getSessionFromCookie } from "@/utils/auth"

// ============================================================================
// Types
// ============================================================================

export const QUESTION_TYPES = ["text", "select", "number"] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]

export interface RegistrationQuestion {
	id: string
	competitionId: string
	type: QuestionType
	label: string
	helpText: string | null
	options: string[] | null
	required: boolean
	forTeammates: boolean
	sortOrder: number
}

// ============================================================================
// Input Schemas
// ============================================================================

const getCompetitionQuestionsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
})

const createQuestionInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	type: z.enum(QUESTION_TYPES),
	label: z.string().min(1, "Label is required").max(500),
	helpText: z.string().max(1000).nullable().optional(),
	options: z.array(z.string().max(200)).max(20).nullable().optional(), // For select type
	required: z.boolean().default(true),
	forTeammates: z.boolean().default(false),
})

const updateQuestionInputSchema = z.object({
	questionId: z.string().min(1, "Question ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	type: z.enum(QUESTION_TYPES).optional(),
	label: z.string().min(1).max(500).optional(),
	helpText: z.string().max(1000).nullable().optional(),
	options: z.array(z.string().max(200)).max(20).nullable().optional(),
	required: z.boolean().optional(),
	forTeammates: z.boolean().optional(),
})

const deleteQuestionInputSchema = z.object({
	questionId: z.string().min(1, "Question ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
})

const reorderQuestionsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	orderedQuestionIds: z.array(z.string()).min(1),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if user has permission on a team
 */
async function hasTeamPermission(
	teamId: string,
	permission: string,
): Promise<boolean> {
	const session = await getSessionFromCookie()
	if (!session?.userId) return false

	const team = session.teams?.find((t) => t.id === teamId)
	if (!team) return false

	return team.permissions.includes(permission)
}

/**
 * Require team permission or throw error
 */
async function requireTeamPermission(
	teamId: string,
	permission: string,
): Promise<void> {
	const hasPermission = await hasTeamPermission(teamId, permission)
	if (!hasPermission) {
		throw new Error(`Missing required permission: ${permission}`)
	}
}

/**
 * Parse options JSON string to array
 */
function parseOptions(options: string | null): string[] | null {
	if (!options) return null
	try {
		const parsed = JSON.parse(options)
		if (Array.isArray(parsed)) return parsed
		return null
	} catch {
		return null
	}
}

/**
 * Stringify options array to JSON
 */
function stringifyOptions(options: string[] | null | undefined): string | null {
	if (!options || options.length === 0) return null
	return JSON.stringify(options)
}

/**
 * Transform DB row to RegistrationQuestion
 */
function toRegistrationQuestion(
	row: typeof competitionRegistrationQuestionsTable.$inferSelect,
): RegistrationQuestion {
	return {
		id: row.id,
		competitionId: row.competitionId,
		type: row.type as QuestionType,
		label: row.label,
		helpText: row.helpText,
		options: parseOptions(row.options),
		required: row.required,
		forTeammates: row.forTeammates,
		sortOrder: row.sortOrder,
	}
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all registration questions for a competition
 * Public - no auth required (athletes need to see questions)
 */
export const getCompetitionQuestionsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getCompetitionQuestionsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		const questions = await db
			.select()
			.from(competitionRegistrationQuestionsTable)
			.where(
				eq(
					competitionRegistrationQuestionsTable.competitionId,
					data.competitionId,
				),
			)
			.orderBy(asc(competitionRegistrationQuestionsTable.sortOrder))

		return {
			questions: questions.map(toRegistrationQuestion),
		}
	})

/**
 * Create a new registration question
 * Requires MANAGE_PROGRAMMING permission
 */
export const createQuestionFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => createQuestionInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		await requireTeamPermission(data.teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

		// Verify competition exists and belongs to team
		const [competition] = await db
			.select()
			.from(competitionsTable)
			.where(eq(competitionsTable.id, data.competitionId))

		if (!competition) {
			throw new Error("Competition not found")
		}

		if (competition.organizingTeamId !== data.teamId) {
			throw new Error("Competition does not belong to this team")
		}

		// Validate select type has options
		if (data.type === "select" && (!data.options || data.options.length === 0)) {
			throw new Error("Select questions must have at least one option")
		}

		// Get next sort order
		const existingQuestions = await db
			.select()
			.from(competitionRegistrationQuestionsTable)
			.where(
				eq(
					competitionRegistrationQuestionsTable.competitionId,
					data.competitionId,
				),
			)

		const maxSortOrder = Math.max(0, ...existingQuestions.map((q) => q.sortOrder))

		const [created] = await db
			.insert(competitionRegistrationQuestionsTable)
			.values({
				competitionId: data.competitionId,
				type: data.type,
				label: data.label,
				helpText: data.helpText ?? null,
				options: stringifyOptions(data.options),
				required: data.required,
				forTeammates: data.forTeammates,
				sortOrder: maxSortOrder + 1,
			})
			.returning()

		if (!created) {
			throw new Error("Failed to create question")
		}

		return { question: toRegistrationQuestion(created) }
	})

/**
 * Update an existing registration question
 * Requires MANAGE_PROGRAMMING permission
 */
export const updateQuestionFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => updateQuestionInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		await requireTeamPermission(data.teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

		// Get question and verify ownership
		const [question] = await db
			.select()
			.from(competitionRegistrationQuestionsTable)
			.where(eq(competitionRegistrationQuestionsTable.id, data.questionId))

		if (!question) {
			throw new Error("Question not found")
		}

		// Verify competition belongs to team
		const [competition] = await db
			.select()
			.from(competitionsTable)
			.where(eq(competitionsTable.id, question.competitionId))

		if (!competition || competition.organizingTeamId !== data.teamId) {
			throw new Error("Question does not belong to this team")
		}

		// Validate select type has options
		const newType = data.type ?? question.type
		const newOptions = data.options !== undefined ? data.options : parseOptions(question.options)
		if (newType === "select" && (!newOptions || newOptions.length === 0)) {
			throw new Error("Select questions must have at least one option")
		}

		// Build update object
		const updateData: Partial<typeof competitionRegistrationQuestionsTable.$inferInsert> = {
			updatedAt: new Date(),
		}

		if (data.type !== undefined) updateData.type = data.type
		if (data.label !== undefined) updateData.label = data.label
		if (data.helpText !== undefined) updateData.helpText = data.helpText
		if (data.options !== undefined) updateData.options = stringifyOptions(data.options)
		if (data.required !== undefined) updateData.required = data.required
		if (data.forTeammates !== undefined) updateData.forTeammates = data.forTeammates

		const [updated] = await db
			.update(competitionRegistrationQuestionsTable)
			.set(updateData)
			.where(eq(competitionRegistrationQuestionsTable.id, data.questionId))
			.returning()

		if (!updated) {
			throw new Error("Failed to update question")
		}

		return { question: toRegistrationQuestion(updated) }
	})

/**
 * Delete a registration question
 * Also deletes all answers for this question
 * Requires MANAGE_PROGRAMMING permission
 */
export const deleteQuestionFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => deleteQuestionInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		await requireTeamPermission(data.teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

		// Get question and verify ownership
		const [question] = await db
			.select()
			.from(competitionRegistrationQuestionsTable)
			.where(eq(competitionRegistrationQuestionsTable.id, data.questionId))

		if (!question) {
			throw new Error("Question not found")
		}

		// Verify competition belongs to team
		const [competition] = await db
			.select()
			.from(competitionsTable)
			.where(eq(competitionsTable.id, question.competitionId))

		if (!competition || competition.organizingTeamId !== data.teamId) {
			throw new Error("Question does not belong to this team")
		}

		// Delete question (answers are cascaded)
		await db
			.delete(competitionRegistrationQuestionsTable)
			.where(eq(competitionRegistrationQuestionsTable.id, data.questionId))

		return { success: true }
	})

/**
 * Reorder registration questions
 * Requires MANAGE_PROGRAMMING permission
 */
export const reorderQuestionsFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => reorderQuestionsInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		await requireTeamPermission(data.teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

		// Verify competition belongs to team
		const [competition] = await db
			.select()
			.from(competitionsTable)
			.where(eq(competitionsTable.id, data.competitionId))

		if (!competition || competition.organizingTeamId !== data.teamId) {
			throw new Error("Competition does not belong to this team")
		}

		// Update sort orders
		for (let i = 0; i < data.orderedQuestionIds.length; i++) {
			const questionId = data.orderedQuestionIds[i]
			if (!questionId) continue

			await db
				.update(competitionRegistrationQuestionsTable)
				.set({ sortOrder: i, updatedAt: new Date() })
				.where(
					and(
						eq(competitionRegistrationQuestionsTable.id, questionId),
						eq(
							competitionRegistrationQuestionsTable.competitionId,
							data.competitionId,
						),
					),
				)
		}

		return { success: true }
	})

/**
 * Get answers for a specific registration
 * Used by organizers to view athlete answers and by athletes to edit their own
 */
export const getRegistrationAnswersFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				registrationId: z.string().min(1),
				userId: z.string().optional(), // Filter by specific user (for team registrations)
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		const whereClause = data.userId
			? and(
					eq(competitionRegistrationAnswersTable.registrationId, data.registrationId),
					eq(competitionRegistrationAnswersTable.userId, data.userId),
				)
			: eq(competitionRegistrationAnswersTable.registrationId, data.registrationId)

		const answers = await db
			.select()
			.from(competitionRegistrationAnswersTable)
			.where(whereClause)

		return {
			answers: answers.map((a) => ({
				id: a.id,
				questionId: a.questionId,
				registrationId: a.registrationId,
				userId: a.userId,
				answer: a.answer,
			})),
		}
	})

/**
 * Submit or update registration answers
 * Used during registration and for editing existing answers
 */
export const submitRegistrationAnswersFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				registrationId: z.string().min(1),
				answers: z.array(
					z.object({
						questionId: z.string().min(1),
						answer: z.string().max(5000),
					}),
				),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// For each answer, upsert
		for (const { questionId, answer } of data.answers) {
			// Check if answer exists
			const existing = await db.query.competitionRegistrationAnswersTable.findFirst({
				where: and(
					eq(competitionRegistrationAnswersTable.questionId, questionId),
					eq(competitionRegistrationAnswersTable.registrationId, data.registrationId),
					eq(competitionRegistrationAnswersTable.userId, session.userId),
				),
			})

			if (existing) {
				// Update existing
				await db
					.update(competitionRegistrationAnswersTable)
					.set({ answer, updatedAt: new Date() })
					.where(eq(competitionRegistrationAnswersTable.id, existing.id))
			} else {
				// Insert new
				await db.insert(competitionRegistrationAnswersTable).values({
					questionId,
					registrationId: data.registrationId,
					userId: session.userId,
					answer,
				})
			}
		}

		return { success: true }
	})

/**
 * Get all registration answers for a competition
 * Used by organizers to view all athlete answers in the athletes table
 * Returns answers grouped by registration ID
 * Requires MANAGE_PROGRAMMING permission
 */
export const getCompetitionRegistrationAnswersFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				competitionId: z.string().min(1, "Competition ID is required"),
				teamId: z.string().min(1, "Team ID is required"),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		await requireTeamPermission(data.teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

		// Verify competition belongs to team
		const [competition] = await db
			.select()
			.from(competitionsTable)
			.where(eq(competitionsTable.id, data.competitionId))

		if (!competition || competition.organizingTeamId !== data.teamId) {
			throw new Error("Competition does not belong to this team")
		}

		// Get all answers for this competition's registrations
		// Join with registrations table to filter by competitionId
		const answers = await db
			.select({
				id: competitionRegistrationAnswersTable.id,
				questionId: competitionRegistrationAnswersTable.questionId,
				registrationId: competitionRegistrationAnswersTable.registrationId,
				userId: competitionRegistrationAnswersTable.userId,
				answer: competitionRegistrationAnswersTable.answer,
			})
			.from(competitionRegistrationAnswersTable)
			.innerJoin(
				competitionRegistrationsTable,
				eq(competitionRegistrationAnswersTable.registrationId, competitionRegistrationsTable.id),
			)
			.where(eq(competitionRegistrationsTable.eventId, data.competitionId))

		// Group answers by registration ID
		const answersByRegistration = answers.reduce(
			(acc, answer) => {
				if (!acc[answer.registrationId]) {
					acc[answer.registrationId] = []
				}
				acc[answer.registrationId]?.push({
					id: answer.id,
					questionId: answer.questionId,
					userId: answer.userId,
					answer: answer.answer,
				})
				return acc
			},
			{} as Record<
				string,
				Array<{
					id: string
					questionId: string
					userId: string
					answer: string
				}>
			>,
		)

		return { answersByRegistration }
	})
