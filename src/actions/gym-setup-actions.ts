"use server"
import { getDd } from "@/db"
import {
	classCatalogTable,
	classCatalogToSkillsTable,
	locationsTable,
	skillsTable,
	scheduledClassesTable,
	scheduleTemplateClassesTable,
} from "@/db/schemas/scheduling"
import { createId } from "@paralleldrive/cuid2"
import { and, eq, count } from "drizzle-orm"
import { z } from "zod"
import { createServerAction, ZSAError } from "zsa"

// Schemas for input validation
const createLocationSchema = z.object({
	teamId: z.string(),
	name: z.string().min(1, "Location name cannot be empty"),
})

const updateLocationSchema = z.object({
	id: z.string(),
	teamId: z.string(),
	name: z.string().min(1, "Location name cannot be empty"),
})

const deleteLocationSchema = z.object({
	id: z.string(),
	teamId: z.string(),
})

const getLocationsByTeamSchema = z.object({
	teamId: z.string(),
})

const createClassCatalogSchema = z.object({
	teamId: z.string(),
	name: z.string().min(1, "Class name cannot be empty"),
	description: z.string().optional(),
	durationMinutes: z.coerce
		.number()
		.int()
		.min(1, "Duration must be at least 1 minute"),
	maxParticipants: z.coerce
		.number()
		.int()
		.min(1, "Max participants must be at least 1"),
	skillIds: z.array(z.string()).optional(),
})

const updateClassCatalogSchema = z.object({
	id: z.string(),
	teamId: z.string(),
	name: z.string().min(1, "Class name cannot be empty"),
	description: z.string().optional(),
	durationMinutes: z.coerce
		.number()
		.int()
		.min(1, "Duration must be at least 1 minute"),
	maxParticipants: z.coerce
		.number()
		.int()
		.min(1, "Max participants must be at least 1"),
	skillIds: z.array(z.string()).optional(),
})

const deleteClassCatalogSchema = z.object({
	id: z.string(),
	teamId: z.string(),
})

const getClassCatalogByTeamSchema = z.object({
	teamId: z.string(),
})

const createSkillSchema = z.object({
	teamId: z.string(),
	name: z.string().min(1, "Skill name cannot be empty"),
})

const updateSkillSchema = z.object({
	id: z.string(),
	teamId: z.string(),
	name: z.string().min(1, "Skill name cannot be empty"),
})

const deleteSkillSchema = z.object({
	id: z.string(),
	teamId: z.string(),
})

const getSkillsByTeamSchema = z.object({
	teamId: z.string(),
})

// Server Actions for Locations
export const createLocation = createServerAction()
	.input(createLocationSchema)
	.handler(async ({ input }) => {
		try {
			const { teamId, name } = input
			const db = getDd()
			const [newLocation] = await db
				.insert(locationsTable)
				.values({ id: `location_${createId()}`, teamId, name })
				.returning()
			return { success: true, data: newLocation }
		} catch (error) {
			console.error("Failed to create location:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to create location")
		}
	})

export const updateLocation = createServerAction()
	.input(updateLocationSchema)
	.handler(async ({ input }) => {
		try {
			const { id, teamId, name } = input
			const db = getDd()
			const [updatedLocation] = await db
				.update(locationsTable)
				.set({ name })
				.where(
					and(eq(locationsTable.id, id), eq(locationsTable.teamId, teamId)),
				)
				.returning()
			return { success: true, data: updatedLocation }
		} catch (error) {
			console.error("Failed to update location:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to update location")
		}
	})

export const deleteLocation = createServerAction()
	.input(deleteLocationSchema)
	.handler(async ({ input }) => {
		try {
			const { id, teamId } = input
			const db = getDd()
			const [deletedLocation] = await db
				.delete(locationsTable)
				.where(
					and(eq(locationsTable.id, id), eq(locationsTable.teamId, teamId)),
				)
				.returning()
			return { success: true, data: deletedLocation }
		} catch (error) {
			console.error("Failed to delete location:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to delete location")
		}
	})

export const getLocationsByTeam = createServerAction()
	.input(getLocationsByTeamSchema)
	.handler(async ({ input }) => {
		try {
			const { teamId } = input
			const db = getDd()
			const locations = await db.query.locationsTable.findMany({
				where: eq(locationsTable.teamId, teamId),
			})
			return { success: true, data: locations }
		} catch (error) {
			console.error("Failed to get locations by team:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get locations by team",
			)
		}
	})

// Server Actions for Class Catalog
export const createClassCatalog = createServerAction()
	.input(createClassCatalogSchema)
	.handler(async ({ input }) => {
		try {
			const {
				teamId,
				name,
				description,
				durationMinutes,
				maxParticipants,
				skillIds,
			} = input
			const db = getDd()
			const [newClass] = await db
				.insert(classCatalogTable)
				.values({
					id: `class_catalog_${createId()}`,
					teamId,
					name,
					description,
					durationMinutes,
					maxParticipants,
				})
				.returning()
			if (skillIds?.length) {
				const values = skillIds.map((skillId) => ({
					classCatalogId: newClass.id,
					skillId,
				}))
				await db.insert(classCatalogToSkillsTable).values(values)
			}
			return { success: true, data: newClass }
		} catch (error) {
			console.error("Failed to create class catalog:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to create class catalog",
			)
		}
	})

export const updateClassCatalog = createServerAction()
	.input(updateClassCatalogSchema)
	.handler(async ({ input }) => {
		try {
			const {
				id,
				teamId,
				name,
				description,
				durationMinutes,
				maxParticipants,
				skillIds,
			} = input
			const db = getDd()
			const [updatedClass] = await db
				.update(classCatalogTable)
				.set({ name, description, durationMinutes, maxParticipants })
				.where(
					and(
						eq(classCatalogTable.id, id),
						eq(classCatalogTable.teamId, teamId),
					),
				)
				.returning()
			if (skillIds !== undefined) {
				await db
					.delete(classCatalogToSkillsTable)
					.where(eq(classCatalogToSkillsTable.classCatalogId, id))
				if (skillIds.length) {
					const values = skillIds.map((skillId) => ({
						classCatalogId: id,
						skillId,
					}))
					await db.insert(classCatalogToSkillsTable).values(values)
				}
			}
			return { success: true, data: updatedClass }
		} catch (error) {
			console.error("Failed to update class catalog:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to update class catalog",
			)
		}
	})

export const deleteClassCatalog = createServerAction()
	.input(deleteClassCatalogSchema)
	.handler(async ({ input }) => {
		try {
			const { id, teamId } = input
			const db = getDd()
			const scheduledCount = (
				await db
					.select({ count: count() })
					.from(scheduledClassesTable)
					.where(eq(scheduledClassesTable.classCatalogId, id))
			)[0].count
			const templateCount = (
				await db
					.select({ count: count() })
					.from(scheduleTemplateClassesTable)
					.where(eq(scheduleTemplateClassesTable.classCatalogId, id))
			)[0].count
			if (scheduledCount > 0 || templateCount > 0) {
				throw new ZSAError(
					"CONFLICT",
					"Cannot delete class catalog entry that is used in schedules or templates.",
				)
			}
			await db
				.delete(classCatalogToSkillsTable)
				.where(eq(classCatalogToSkillsTable.classCatalogId, id))
			const [deletedClass] = await db
				.delete(classCatalogTable)
				.where(
					and(
						eq(classCatalogTable.id, id),
						eq(classCatalogTable.teamId, teamId),
					),
				)
				.returning()
			return { success: true, data: deletedClass }
		} catch (error) {
			console.error("Failed to delete class catalog:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to delete class catalog",
			)
		}
	})

export const getClassCatalogByTeam = createServerAction()
	.input(getClassCatalogByTeamSchema)
	.handler(async ({ input }) => {
		try {
			const { teamId } = input
			const db = getDd()
			const classes = await db.query.classCatalogTable.findMany({
				where: eq(classCatalogTable.teamId, teamId),
				with: {
					classToSkills: {
						with: {
							skill: true,
						},
					},
				},
			})
			return { success: true, data: classes }
		} catch (error) {
			console.error("Failed to get class catalog by team:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get class catalog by team",
			)
		}
	})

// Server Actions for Skills
export const createSkill = createServerAction()
	.input(createSkillSchema)
	.handler(async ({ input }) => {
		try {
			const { teamId, name } = input
			const db = getDd()
			const [newSkill] = await db
				.insert(skillsTable)
				.values({ id: `skill_${createId()}`, teamId, name })
				.returning()
			return { success: true, data: newSkill }
		} catch (error) {
			console.error("Failed to create skill:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to create skill")
		}
	})

export const updateSkill = createServerAction()
	.input(updateSkillSchema)
	.handler(async ({ input }) => {
		try {
			const { id, teamId, name } = input
			const db = getDd()
			const [updatedSkill] = await db
				.update(skillsTable)
				.set({ name })
				.where(and(eq(skillsTable.id, id), eq(skillsTable.teamId, teamId)))
				.returning()
			return { success: true, data: updatedSkill }
		} catch (error) {
			console.error("Failed to update skill:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to update skill")
		}
	})

export const deleteSkill = createServerAction()
	.input(deleteSkillSchema)
	.handler(async ({ input }) => {
		try {
			const { id, teamId } = input
			const db = getDd()
			const [deletedSkill] = await db
				.delete(skillsTable)
				.where(and(eq(skillsTable.id, id), eq(skillsTable.teamId, teamId)))
				.returning()
			return { success: true, data: deletedSkill }
		} catch (error) {
			console.error("Failed to delete skill:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to delete skill")
		}
	})

export const getSkillsByTeam = createServerAction()
	.input(getSkillsByTeamSchema)
	.handler(async ({ input }) => {
		try {
			const { teamId } = input
			const db = getDd()
			const skills = await db.query.skillsTable.findMany({
				where: eq(skillsTable.teamId, teamId),
			})
			return { success: true, data: skills }
		} catch (error) {
			console.error("Failed to get skills by team:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get skills by team",
			)
		}
	})
