"use server"
import { createId } from "@paralleldrive/cuid2"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { createServerAction, ZSAError } from "@repo/zsa"
import { getDd } from "@/db"
import {
	scheduleTemplateClassesTable,
	scheduleTemplateClassRequiredSkillsTable,
	scheduleTemplatesTable,
} from "@/db/schemas/scheduling"
import { requireTeamMembership } from "@/utils/team-auth"

// Schemas for input validation
const createScheduleTemplateSchema = z.object({
	teamId: z.string(),
	name: z.string().min(1, "Template name cannot be empty"),
	classCatalogId: z.string(),
	locationId: z.string(),
})

const updateScheduleTemplateSchema = z.object({
	id: z.string(),
	teamId: z.string(),
	name: z.string().min(1, "Template name cannot be empty").optional(),
	classCatalogId: z.string().optional(),
	locationId: z.string().optional(),
})

const deleteScheduleTemplateSchema = z.object({
	id: z.string(),
	teamId: z.string(),
})

const getScheduleTemplatesByTeamSchema = z.object({
	teamId: z.string(),
})

const getScheduleTemplateByIdSchema = z.object({
	id: z.string(),
	teamId: z.string(),
})

const createScheduleTemplateClassSchema = z.object({
	templateId: z.string(),
	dayOfWeek: z.number().int().min(0).max(6),
	startTime: z
		.string()
		.regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
	endTime: z
		.string()
		.regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
	requiredCoaches: z.number().int().min(1).optional(),
	requiredSkillIds: z.array(z.string()).optional(),
})

const updateScheduleTemplateClassSchema = z.object({
	id: z.string(),
	templateId: z.string(),
	dayOfWeek: z.number().int().min(0).max(6).optional(),
	startTime: z
		.string()
		.regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)")
		.optional(),
	endTime: z
		.string()
		.regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)")
		.optional(),
	requiredCoaches: z.number().int().min(1).optional(),
	requiredSkillIds: z.array(z.string()).optional(),
})

const deleteScheduleTemplateClassSchema = z.object({
	id: z.string(),
	templateId: z.string(),
})

// Schema for deleting all classes for a template
const deleteAllScheduleTemplateClassesSchema = z.object({
	templateId: z.string(),
})

// Server Actions for Schedule Templates
export const createScheduleTemplate = createServerAction()
	.input(createScheduleTemplateSchema)
	.handler(async ({ input }) => {
		const { teamId, name, classCatalogId, locationId } = input
		await requireTeamMembership(teamId)
		const db = getDd()
		try {
			const [newTemplate] = await db
				.insert(scheduleTemplatesTable)
				.values({
					id: `st_${createId()}`,
					teamId,
					name,
					classCatalogId,
					locationId,
				})
				.returning()
			return newTemplate
		} catch (error) {
			console.error("Failed to create schedule template:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to create schedule template",
			)
		}
	})

export const updateScheduleTemplate = createServerAction()
	.input(updateScheduleTemplateSchema)
	.handler(async ({ input }) => {
		const { id, teamId, name, classCatalogId, locationId } = input
		await requireTeamMembership(teamId)
		const db = getDd()
		try {
			const updates = Object.fromEntries(
				Object.entries({ name, classCatalogId, locationId }).filter(
					([, value]) => value !== undefined,
				),
			)

			const [updatedTemplate] = await db
				.update(scheduleTemplatesTable)
				.set(updates)
				.where(
					and(
						eq(scheduleTemplatesTable.id, id),
						eq(scheduleTemplatesTable.teamId, teamId),
					),
				)
				.returning()
			return updatedTemplate
		} catch (error) {
			console.error("Failed to update schedule template:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to update schedule template",
			)
		}
	})

export const deleteScheduleTemplate = createServerAction()
	.input(deleteScheduleTemplateSchema)
	.handler(async ({ input }) => {
		const { id, teamId } = input
		await requireTeamMembership(teamId)
		const db = getDd()
		try {
			// First, get all template classes for this template
			const templateClasses = await db
				.select({ id: scheduleTemplateClassesTable.id })
				.from(scheduleTemplateClassesTable)
				.where(eq(scheduleTemplateClassesTable.templateId, id))

			// Delete schedule template class required skills first (if any exist)
			if (templateClasses.length > 0) {
				await db.delete(scheduleTemplateClassRequiredSkillsTable).where(
					inArray(
						scheduleTemplateClassRequiredSkillsTable.templateClassId,
						templateClasses.map((tc) => tc.id),
					),
				)

				// Then delete the template classes
				await db
					.delete(scheduleTemplateClassesTable)
					.where(eq(scheduleTemplateClassesTable.templateId, id))
			}

			// Finally, delete the schedule template
			const [deletedTemplate] = await db
				.delete(scheduleTemplatesTable)
				.where(
					and(
						eq(scheduleTemplatesTable.id, id),
						eq(scheduleTemplatesTable.teamId, teamId),
					),
				)
				.returning()
			return deletedTemplate
		} catch (error) {
			console.error("Failed to delete schedule template:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to delete schedule template",
			)
		}
	})

export const getScheduleTemplatesByTeam = createServerAction()
	.input(getScheduleTemplatesByTeamSchema)
	.handler(async ({ input }) => {
		const { teamId } = input
		await requireTeamMembership(teamId)
		const db = getDd()
		try {
			const templates = await db.query.scheduleTemplatesTable.findMany({
				where: eq(scheduleTemplatesTable.teamId, teamId),
				with: {
					templateClasses: {
						with: { requiredSkills: { with: { skill: true } } },
					},
				},
			})
			return templates
		} catch (error) {
			console.error("Failed to get schedule templates by team:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get schedule templates by team",
			)
		}
	})

export const getScheduleTemplateById = createServerAction()
	.input(getScheduleTemplateByIdSchema)
	.handler(async ({ input }) => {
		const { id, teamId } = input
		await requireTeamMembership(teamId)
		const db = getDd()
		try {
			const template = await db.query.scheduleTemplatesTable.findFirst({
				where: and(
					eq(scheduleTemplatesTable.id, id),
					eq(scheduleTemplatesTable.teamId, teamId),
				),
				with: {
					templateClasses: {
						with: { requiredSkills: { with: { skill: true } } },
					},
					classCatalog: true,
					location: true,
				},
			})
			return template
		} catch (error) {
			console.error("Failed to get schedule template by ID:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get schedule template by ID",
			)
		}
	})

// Server Actions for Schedule Template Classes
export const createScheduleTemplateClass = createServerAction()
	.input(createScheduleTemplateClassSchema)
	.handler(async ({ input }) => {
		const db = getDd()
		try {
			// Verify team membership by checking template ownership
			const template = await db.query.scheduleTemplatesTable.findFirst({
				where: eq(scheduleTemplatesTable.id, input.templateId),
				columns: { teamId: true },
			})
			if (!template) {
				throw new ZSAError("NOT_FOUND", "Schedule template not found")
			}
			await requireTeamMembership(template.teamId)
			const { requiredSkillIds, ...rest } = input
			const [newTemplateClass] = await db
				.insert(scheduleTemplateClassesTable)
				.values({ ...rest, id: `stc_${createId()}` })
				.returning()

			if (requiredSkillIds && newTemplateClass) {
				const skills = requiredSkillIds.map((skillId) => ({
					templateClassId: newTemplateClass.id,
					skillId,
				}))
				await db.insert(scheduleTemplateClassRequiredSkillsTable).values(skills)
			}
			return newTemplateClass
		} catch (error) {
			console.error("Failed to create schedule template class:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to create schedule template class",
			)
		}
	})

export const updateScheduleTemplateClass = createServerAction()
	.input(updateScheduleTemplateClassSchema)
	.handler(async ({ input }) => {
		const db = getDd()
		try {
			// Verify team membership by checking template ownership
			const template = await db.query.scheduleTemplatesTable.findFirst({
				where: eq(scheduleTemplatesTable.id, input.templateId),
				columns: { teamId: true },
			})
			if (!template) {
				throw new ZSAError("NOT_FOUND", "Schedule template not found")
			}
			await requireTeamMembership(template.teamId)
			const { id, templateId, requiredSkillIds, ...rest } = input
			const updates = Object.fromEntries(
				Object.entries(rest).filter(([, value]) => value !== undefined),
			)

			const [updatedTemplateClass] = await db
				.update(scheduleTemplateClassesTable)
				.set(updates)
				.where(
					and(
						eq(scheduleTemplateClassesTable.id, id),
						eq(scheduleTemplateClassesTable.templateId, templateId),
					),
				)
				.returning()

			if (updatedTemplateClass && requiredSkillIds !== undefined) {
				// Delete existing skills for this template class
				await db
					.delete(scheduleTemplateClassRequiredSkillsTable)
					.where(
						eq(scheduleTemplateClassRequiredSkillsTable.templateClassId, id),
					)
				// Insert new skills
				if (requiredSkillIds.length > 0) {
					const skills = requiredSkillIds.map((skillId) => ({
						templateClassId: id,
						skillId,
					}))
					await db
						.insert(scheduleTemplateClassRequiredSkillsTable)
						.values(skills)
				}
			}
			return updatedTemplateClass
		} catch (error) {
			console.error("Failed to update schedule template class:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to update schedule template class",
			)
		}
	})

export const deleteScheduleTemplateClass = createServerAction()
	.input(deleteScheduleTemplateClassSchema)
	.handler(async ({ input }) => {
		const { id, templateId } = input
		const db = getDd()
		try {
			// Verify team membership by checking template ownership
			const template = await db.query.scheduleTemplatesTable.findFirst({
				where: eq(scheduleTemplatesTable.id, templateId),
				columns: { teamId: true },
			})
			if (!template) {
				throw new ZSAError("NOT_FOUND", "Schedule template not found")
			}
			await requireTeamMembership(template.teamId)
			const [deletedTemplateClass] = await db
				.delete(scheduleTemplateClassesTable)
				.where(
					and(
						eq(scheduleTemplateClassesTable.id, id),
						eq(scheduleTemplateClassesTable.templateId, templateId),
					),
				)
				.returning()
			return deletedTemplateClass
		} catch (error) {
			console.error("Failed to delete schedule template class:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to delete schedule template class",
			)
		}
	})

// Server Action to delete all classes for a template
export const deleteAllScheduleTemplateClassesForTemplate = createServerAction()
	.input(deleteAllScheduleTemplateClassesSchema)
	.handler(async ({ input }) => {
		const db = getDd()
		try {
			// Verify team membership by checking template ownership
			const template = await db.query.scheduleTemplatesTable.findFirst({
				where: eq(scheduleTemplatesTable.id, input.templateId),
				columns: { teamId: true },
			})
			if (!template) {
				throw new ZSAError("NOT_FOUND", "Schedule template not found")
			}
			await requireTeamMembership(template.teamId)
			// Delete required skills first
			await db
				.delete(scheduleTemplateClassRequiredSkillsTable)
				.where(
					inArray(
						scheduleTemplateClassRequiredSkillsTable.templateClassId,
						db
							.select({ id: scheduleTemplateClassesTable.id })
							.from(scheduleTemplateClassesTable)
							.where(
								eq(scheduleTemplateClassesTable.templateId, input.templateId),
							),
					),
				)
			// Then delete the classes
			await db
				.delete(scheduleTemplateClassesTable)
				.where(eq(scheduleTemplateClassesTable.templateId, input.templateId))
			return { deleted: true }
		} catch (error) {
			console.error("Failed to delete all schedule template classes:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to delete all schedule template classes",
			)
		}
	})

// Schema for simple bulk create without cron
const bulkCreateScheduleTemplateClassesSimpleSchema = z.object({
	templateId: z.string(),
	timeSlots: z.array(
		z.object({
			dayOfWeek: z.number().int().min(0).max(6),
			startTime: z
				.string()
				.regex(
					/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
					"Invalid time format (HH:MM)",
				),
			endTime: z
				.string()
				.regex(
					/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
					"Invalid time format (HH:MM)",
				),
		}),
	),
	requiredCoaches: z.number().int().min(1).optional(),
	requiredSkillIds: z.array(z.string()).optional(),
})

// Server Action for simple bulk create
export const bulkCreateScheduleTemplateClassesSimple = createServerAction()
	.input(bulkCreateScheduleTemplateClassesSimpleSchema)
	.handler(async ({ input }) => {
		const { templateId, timeSlots, requiredCoaches, requiredSkillIds } = input
		const db = getDd()
		try {
			// Verify team membership by checking template ownership
			const template = await db.query.scheduleTemplatesTable.findFirst({
				where: eq(scheduleTemplatesTable.id, templateId),
				columns: { teamId: true },
			})
			if (!template) {
				throw new ZSAError("NOT_FOUND", "Schedule template not found")
			}
			await requireTeamMembership(template.teamId)
			const toInsert = timeSlots.map((slot) => ({
				id: `stc_${createId()}`,
				templateId,
				dayOfWeek: slot.dayOfWeek,
				startTime: slot.startTime,
				endTime: slot.endTime,
				requiredCoaches,
			}))
			const newTemplateClasses = []
			const batchSize = 10
			for (let i = 0; i < toInsert.length; i += batchSize) {
				const chunk = toInsert.slice(i, i + batchSize)
				const chunkResults = await db
					.insert(scheduleTemplateClassesTable)
					.values(chunk)
					.returning()
				newTemplateClasses.push(...chunkResults)
			}
			if (requiredSkillIds && requiredSkillIds.length > 0) {
				const skillsToInsert = newTemplateClasses.flatMap((templateClass) =>
					requiredSkillIds.map((skillId) => ({
						templateClassId: templateClass.id,
						skillId,
					})),
				)
				const skillsBatchSize = 50
				for (let i = 0; i < skillsToInsert.length; i += skillsBatchSize) {
					const chunk = skillsToInsert.slice(i, i + skillsBatchSize)
					await db
						.insert(scheduleTemplateClassRequiredSkillsTable)
						.values(chunk)
				}
			}
			return newTemplateClasses
		} catch (error) {
			console.error("Failed to bulk create schedule template classes:", error)
			if (error instanceof ZSAError) {
				throw error
			}
			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to bulk create schedule template classes",
			)
		}
	})
