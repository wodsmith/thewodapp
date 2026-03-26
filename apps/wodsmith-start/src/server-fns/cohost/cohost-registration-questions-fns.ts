/**
 * Cohost Registration Questions Server Functions
 * Mirrors competition-level CRUD from registration-questions-fns.ts with cohost auth.
 * Only competition-level fns — series-level fns are not needed for cohosts.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  competitionRegistrationQuestionsTable,
  competitionsTable,
} from "@/db/schemas/competitions"
import { createCompetitionRegistrationQuestionId } from "@/db/schemas/common"
import { requireCohostPermission } from "@/utils/cohost-auth"
import {
  QUESTION_TYPES,
  type RegistrationQuestion,
} from "@/server-fns/registration-questions-fns"

// ============================================================================
// Helpers (duplicated from organizer fns to avoid coupling)
// ============================================================================

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

function stringifyOptions(options: string[] | null | undefined): string | null {
  if (!options || options.length === 0) return null
  return JSON.stringify(options)
}

function toRegistrationQuestion(
  row: typeof competitionRegistrationQuestionsTable.$inferSelect,
): RegistrationQuestion {
  return {
    id: row.id,
    competitionId: row.competitionId,
    groupId: row.groupId,
    type: row.type as "text" | "select" | "number",
    label: row.label,
    helpText: row.helpText,
    options: parseOptions(row.options),
    required: row.required,
    forTeammates: row.forTeammates,
    sortOrder: row.sortOrder,
    questionTarget: row.questionTarget as "athlete" | "volunteer",
  }
}

// ============================================================================
// Input Schemas
// ============================================================================

const cohostCreateQuestionInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  type: z.enum(QUESTION_TYPES),
  label: z.string().min(1, "Label is required").max(500),
  helpText: z.string().max(1000).nullable().optional(),
  options: z.array(z.string().max(200)).max(20).nullable().optional(),
  required: z.boolean().default(true),
  forTeammates: z.boolean().default(false),
  questionTarget: z
    .enum(["athlete", "volunteer"])
    .optional()
    .default("athlete"),
})

const cohostUpdateQuestionInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  questionId: z.string().min(1, "Question ID is required"),
  type: z.enum(QUESTION_TYPES).optional(),
  label: z.string().min(1).max(500).optional(),
  helpText: z.string().max(1000).nullable().optional(),
  options: z.array(z.string().max(200)).max(20).nullable().optional(),
  required: z.boolean().optional(),
  forTeammates: z.boolean().optional(),
})

const cohostDeleteQuestionInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  questionId: z.string().min(1, "Question ID is required"),
})

const cohostReorderQuestionsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  orderedQuestionIds: z.array(z.string()).min(1),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Create a new registration question (cohost)
 * Requires editRegistrations permission
 */
export const cohostCreateQuestionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostCreateQuestionInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "editRegistrations")
    const db = getDb()

    // Verify competition exists
    const [competition] = await db
      .select()
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))

    if (!competition) {
      throw new Error("Competition not found")
    }

    // Validate select type has options
    if (
      data.type === "select" &&
      (!data.options || data.options.length === 0)
    ) {
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

    const maxSortOrder = Math.max(
      0,
      ...existingQuestions.map((q) => q.sortOrder),
    )

    const id = createCompetitionRegistrationQuestionId()
    await db.insert(competitionRegistrationQuestionsTable).values({
      id,
      competitionId: data.competitionId,
      type: data.type,
      label: data.label,
      helpText: data.helpText ?? null,
      options: stringifyOptions(data.options),
      required: data.required,
      forTeammates: data.forTeammates,
      sortOrder: maxSortOrder + 1,
      questionTarget: data.questionTarget ?? "athlete",
    })

    const created =
      await db.query.competitionRegistrationQuestionsTable.findFirst({
        where: eq(competitionRegistrationQuestionsTable.id, id),
      })

    if (!created) {
      throw new Error("Failed to create question")
    }

    return { question: toRegistrationQuestion(created) }
  })

/**
 * Update an existing registration question (cohost)
 * Requires editRegistrations permission
 */
export const cohostUpdateQuestionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostUpdateQuestionInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "editRegistrations")
    const db = getDb()

    // Get question
    const [question] = await db
      .select()
      .from(competitionRegistrationQuestionsTable)
      .where(eq(competitionRegistrationQuestionsTable.id, data.questionId))

    if (!question) {
      throw new Error("Question not found")
    }

    // Only allow editing competition-level questions (not series-level)
    if (!question.competitionId) {
      throw new Error("Cannot edit series-level questions from cohost view")
    }

    // Validate select type has options
    const newType = data.type ?? question.type
    const newOptions =
      data.options !== undefined ? data.options : parseOptions(question.options)
    if (newType === "select" && (!newOptions || newOptions.length === 0)) {
      throw new Error("Select questions must have at least one option")
    }

    // Build update object
    const updateData: Partial<
      typeof competitionRegistrationQuestionsTable.$inferInsert
    > = {
      updatedAt: new Date(),
    }

    if (data.type !== undefined) updateData.type = data.type
    if (data.label !== undefined) updateData.label = data.label
    if (data.helpText !== undefined) updateData.helpText = data.helpText
    if (data.options !== undefined)
      updateData.options = stringifyOptions(data.options)
    if (data.required !== undefined) updateData.required = data.required
    if (data.forTeammates !== undefined)
      updateData.forTeammates = data.forTeammates

    await db
      .update(competitionRegistrationQuestionsTable)
      .set(updateData)
      .where(eq(competitionRegistrationQuestionsTable.id, data.questionId))

    const updated =
      await db.query.competitionRegistrationQuestionsTable.findFirst({
        where: eq(competitionRegistrationQuestionsTable.id, data.questionId),
      })

    if (!updated) {
      throw new Error("Failed to update question")
    }

    return { question: toRegistrationQuestion(updated) }
  })

/**
 * Delete a registration question (cohost)
 * Requires editRegistrations permission
 */
export const cohostDeleteQuestionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostDeleteQuestionInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "editRegistrations")
    const db = getDb()

    // Get question
    const [question] = await db
      .select()
      .from(competitionRegistrationQuestionsTable)
      .where(eq(competitionRegistrationQuestionsTable.id, data.questionId))

    if (!question) {
      throw new Error("Question not found")
    }

    // Only allow deleting competition-level questions
    if (!question.competitionId) {
      throw new Error("Cannot delete series-level questions from cohost view")
    }

    // Delete question (answers are cascaded)
    await db
      .delete(competitionRegistrationQuestionsTable)
      .where(eq(competitionRegistrationQuestionsTable.id, data.questionId))

    return { success: true }
  })

/**
 * Reorder registration questions (cohost)
 * Requires editRegistrations permission
 */
export const cohostReorderQuestionsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostReorderQuestionsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "editRegistrations")
    const db = getDb()

    // Update sort orders in a transaction
    await db.transaction(async (tx) => {
      await Promise.all(
        data.orderedQuestionIds.map((questionId, i) => {
          if (!questionId) return Promise.resolve()
          return tx
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
        }),
      )
    })

    return { success: true }
  })
