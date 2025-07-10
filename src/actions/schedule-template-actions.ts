import { getDd } from "@/db"
import {
	scheduleTemplatesTable,
	scheduleTemplateClassesTable,
	scheduleTemplateClassRequiredSkillsTable,
} from "@/db/schemas/scheduling"
import { createId } from "@paralleldrive/cuid2"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

// Schemas for input validation
const createScheduleTemplateSchema = z.object({
	teamId: z.string(),
	name: z.string().min(1, "Template name cannot be empty"),
})

const updateScheduleTemplateSchema = z.object({
	id: z.string(),
	teamId: z.string(),
	name: z.string().min(1, "Template name cannot be empty").optional(),
})

const deleteScheduleTemplateSchema = z.object({
	id: z.string(),
	teamId: z.string(),
})

const createScheduleTemplateClassSchema = z.object({
	templateId: z.string(),
	classCatalogId: z.string(),
	locationId: z.string(),
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
	classCatalogId: z.string().optional(),
	locationId: z.string().optional(),
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

// Server Actions for Schedule Templates
export const createScheduleTemplate = async ({
	teamId,
	name,
}: z.infer<typeof createScheduleTemplateSchema>) => {
	const db = getDd()
	const [newTemplate] = await db
		.insert(scheduleTemplatesTable)
		.values({ id: `st_${createId()}`, teamId, name })
		.returning()
	return newTemplate
}

export const updateScheduleTemplate = async ({
	id,
	teamId,
	name,
}: z.infer<typeof updateScheduleTemplateSchema>) => {
	const db = getDd()
	const [updatedTemplate] = await db
		.update(scheduleTemplatesTable)
		.set({ name })
		.where(
			and(
				eq(scheduleTemplatesTable.id, id),
				eq(scheduleTemplatesTable.teamId, teamId),
			),
		)
		.returning()
	return updatedTemplate
}

export const deleteScheduleTemplate = async ({
	id,
	teamId,
}: z.infer<typeof deleteScheduleTemplateSchema>) => {
	const db = getDd()
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
}

export const getScheduleTemplatesByTeam = async ({
	teamId,
}: {
	teamId: string
}) => {
	const db = getDd()
	const templates = await db.query.scheduleTemplatesTable.findMany({
		where: eq(scheduleTemplatesTable.teamId, teamId),
		with: {
			templateClasses: { with: { requiredSkills: { with: { skill: true } } } },
		},
	})
	return templates
}

export const getScheduleTemplateById = async ({
	id,
	teamId,
}: {
	id: string
	teamId: string
}) => {
	const db = getDd()
	const template = await db.query.scheduleTemplatesTable.findFirst({
		where: and(
			eq(scheduleTemplatesTable.id, id),
			eq(scheduleTemplatesTable.teamId, teamId),
		),
		with: {
			templateClasses: { with: { requiredSkills: { with: { skill: true } } } },
		},
	})
	return template
}

// Server Actions for Schedule Template Classes
export const createScheduleTemplateClass = async (
	input: z.infer<typeof createScheduleTemplateClassSchema>,
) => {
	const db = getDd()
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
}

export const updateScheduleTemplateClass = async (
	input: z.infer<typeof updateScheduleTemplateClassSchema>,
) => {
	const db = getDd()
	const { id, templateId, requiredSkillIds, ...rest } = input
	const [updatedTemplateClass] = await db
		.update(scheduleTemplateClassesTable)
		.set(rest)
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
			.where(eq(scheduleTemplateClassRequiredSkillsTable.templateClassId, id))
		// Insert new skills
		if (requiredSkillIds.length > 0) {
			const skills = requiredSkillIds.map((skillId) => ({
				templateClassId: id,
				skillId,
			}))
			await db.insert(scheduleTemplateClassRequiredSkillsTable).values(skills)
		}
	}
	return updatedTemplateClass
}

export const deleteScheduleTemplateClass = async ({
	id,
	templateId,
}: z.infer<typeof deleteScheduleTemplateClassSchema>) => {
	const db = getDd()
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
}
