import { createServerFn } from "@tanstack/react-start/server"
import { createId } from "@paralleldrive/cuid2"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db/index.server"
import {
	scheduleTemplateClassesTable,
	scheduleTemplateClassRequiredSkillsTable,
	scheduleTemplatesTable,
} from "@/db/schemas/scheduling"
import { requireTeamMembership } from "@/utils/team-auth.server"

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

const deleteAllScheduleTemplateClassesSchema = z.object({
	templateId: z.string(),
})

// Server Functions for Schedule Templates
export const createScheduleTemplateFn = createServerFn({ method: "POST" })
	.validator(createScheduleTemplateSchema)
	.handler(async ({ data }) => {
		try {
			const { teamId, name, classCatalogId, locationId } = data
			await requireTeamMembership(teamId)
			const db = getDb()

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
			throw error
		}
	})

export const updateScheduleTemplateFn = createServerFn({ method: "POST" })
	.validator(updateScheduleTemplateSchema)
	.handler(async ({ data }) => {
		try {
			const { id, teamId, name, classCatalogId, locationId } = data
			await requireTeamMembership(teamId)
			const db = getDb()

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
			throw error
		}
	})

export const deleteScheduleTemplateFn = createServerFn({ method: "POST" })
	.validator(deleteScheduleTemplateSchema)
	.handler(async ({ data }) => {
		try {
			const { id, teamId } = data
			await requireTeamMembership(teamId)
			const db = getDb()

			const templateClasses = await db
				.select({ id: scheduleTemplateClassesTable.id })
				.from(scheduleTemplateClassesTable)
				.where(eq(scheduleTemplateClassesTable.templateId, id))

			if (templateClasses.length > 0) {
				await db.delete(scheduleTemplateClassRequiredSkillsTable).where(
					inArray(
						scheduleTemplateClassRequiredSkillsTable.templateClassId,
						templateClasses.map((tc) => tc.id),
					),
				)

				await db
					.delete(scheduleTemplateClassesTable)
					.where(eq(scheduleTemplateClassesTable.templateId, id))
			}

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
			throw error
		}
	})

export const getScheduleTemplatesByTeamFn = createServerFn({ method: "POST" })
	.validator(getScheduleTemplatesByTeamSchema)
	.handler(async ({ data }) => {
		try {
			const { teamId } = data
			await requireTeamMembership(teamId)
			const db = getDb()

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
			throw error
		}
	})

export const getScheduleTemplateByIdFn = createServerFn({ method: "POST" })
	.validator(getScheduleTemplateByIdSchema)
	.handler(async ({ data }) => {
		try {
			const { id, teamId } = data
			await requireTeamMembership(teamId)
			const db = getDb()

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
			throw error
		}
	})

// Server Functions for Schedule Template Classes
export const createScheduleTemplateClassFn = createServerFn({
	method: "POST",
})
	.validator(createScheduleTemplateClassSchema)
	.handler(async ({ data }) => {
		try {
			const db = getDb()

			const template = await db.query.scheduleTemplatesTable.findFirst({
				where: eq(scheduleTemplatesTable.id, data.templateId),
				columns: { teamId: true },
			})
			if (!template) {
				throw new Error("Schedule template not found")
			}
			await requireTeamMembership(template.teamId)

			const { requiredSkillIds, ...rest } = data
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
			throw error
		}
	})

export const updateScheduleTemplateClassFn = createServerFn({
	method: "POST",
})
	.validator(updateScheduleTemplateClassSchema)
	.handler(async ({ data }) => {
		try {
			const db = getDb()

			const template = await db.query.scheduleTemplatesTable.findFirst({
				where: eq(scheduleTemplatesTable.id, data.templateId),
				columns: { teamId: true },
			})
			if (!template) {
				throw new Error("Schedule template not found")
			}
			await requireTeamMembership(template.teamId)

			const { id, templateId, requiredSkillIds, ...rest } = data
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
				await db
					.delete(scheduleTemplateClassRequiredSkillsTable)
					.where(
						eq(scheduleTemplateClassRequiredSkillsTable.templateClassId, id),
					)
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
			throw error
		}
	})

export const deleteScheduleTemplateClassFn = createServerFn({
	method: "POST",
})
	.validator(deleteScheduleTemplateClassSchema)
	.handler(async ({ data }) => {
		try {
			const { id, templateId } = data
			const db = getDb()

			const template = await db.query.scheduleTemplatesTable.findFirst({
				where: eq(scheduleTemplatesTable.id, templateId),
				columns: { teamId: true },
			})
			if (!template) {
				throw new Error("Schedule template not found")
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
			throw error
		}
	})

// Server Function to delete all classes for a template
export const deleteAllScheduleTemplateClassesForTemplateFn = createServerFn({
	method: "POST",
})
	.validator(deleteAllScheduleTemplateClassesSchema)
	.handler(async ({ data }) => {
		try {
			const db = getDb()

			const template = await db.query.scheduleTemplatesTable.findFirst({
				where: eq(scheduleTemplatesTable.id, data.templateId),
				columns: { teamId: true },
			})
			if (!template) {
				throw new Error("Schedule template not found")
			}
			await requireTeamMembership(template.teamId)

			await db
				.delete(scheduleTemplateClassRequiredSkillsTable)
				.where(
					inArray(
						scheduleTemplateClassRequiredSkillsTable.templateClassId,
						db
							.select({ id: scheduleTemplateClassesTable.id })
							.from(scheduleTemplateClassesTable)
							.where(
								eq(scheduleTemplateClassesTable.templateId, data.templateId),
							),
					),
				)
			await db
				.delete(scheduleTemplateClassesTable)
				.where(eq(scheduleTemplateClassesTable.templateId, data.templateId))
			return { deleted: true }
		} catch (error) {
			console.error("Failed to delete all schedule template classes:", error)
			throw error
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

// Server Function for simple bulk create
export const bulkCreateScheduleTemplateClassesSimpleFn = createServerFn({
	method: "POST",
})
	.validator(bulkCreateScheduleTemplateClassesSimpleSchema)
	.handler(async ({ data }) => {
		try {
			const { templateId, timeSlots, requiredCoaches, requiredSkillIds } = data
			const db = getDb()

			const template = await db.query.scheduleTemplatesTable.findFirst({
				where: eq(scheduleTemplatesTable.id, templateId),
				columns: { teamId: true },
			})
			if (!template) {
				throw new Error("Schedule template not found")
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
			throw error
		}
	})
