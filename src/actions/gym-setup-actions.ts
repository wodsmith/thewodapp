import { getDd } from "@/db"
import {
	classCatalogTable,
	locationsTable,
	skillsTable,
} from "@/db/schemas/scheduling"
import {
	createLocationId,
	createSkillId,
	createClassCatalogId,
} from "@/db/schemas/common"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
// import { authAction } from "@/lib/safe-action"

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

const createClassCatalogSchema = z.object({
	teamId: z.string(),
	name: z.string().min(1, "Class name cannot be empty"),
	description: z.string().optional(),
})

const updateClassCatalogSchema = z.object({
	id: z.string(),
	teamId: z.string(),
	name: z.string().min(1, "Class name cannot be empty"),
	description: z.string().optional(),
})

const deleteClassCatalogSchema = z.object({
	id: z.string(),
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

// Server Actions for Locations
export const createLocation = async ({
	teamId,
	name,
}: z.infer<typeof createLocationSchema>) => {
	const db = getDd()
	const [newLocation] = await db
		.insert(locationsTable)
		.values({ id: createLocationId(), teamId, name })
		.returning()
	return newLocation
}

export const updateLocation = async ({
	id,
	teamId,
	name,
}: z.infer<typeof updateLocationSchema>) => {
	const db = getDd()
	const [updatedLocation] = await db
		.update(locationsTable)
		.set({ name })
		.where(and(eq(locationsTable.id, id), eq(locationsTable.teamId, teamId)))
		.returning()
	return updatedLocation
}

export const deleteLocation = async ({
	id,
	teamId,
}: z.infer<typeof deleteLocationSchema>) => {
	const db = getDd()
	const [deletedLocation] = await db
		.delete(locationsTable)
		.where(and(eq(locationsTable.id, id), eq(locationsTable.teamId, teamId)))
		.returning()
	return deletedLocation
}

export const getLocationsByTeam = async ({ teamId }: { teamId: string }) => {
	const db = getDd()
	const locations = await db.query.locationsTable.findMany({
		where: eq(locationsTable.teamId, teamId),
	})
	return locations
}

// Server Actions for Class Catalog
export const createClassCatalog = async ({
	teamId,
	name,
	description,
}: z.infer<typeof createClassCatalogSchema>) => {
	const db = getDd()
	const [newClass] = await db
		.insert(classCatalogTable)
		.values({ id: createClassCatalogId(), teamId, name, description })
		.returning()
	return newClass
}

export const updateClassCatalog = async ({
	id,
	teamId,
	name,
	description,
}: z.infer<typeof updateClassCatalogSchema>) => {
	const db = getDd()
	const [updatedClass] = await db
		.update(classCatalogTable)
		.set({ name, description })
		.where(
			and(eq(classCatalogTable.id, id), eq(classCatalogTable.teamId, teamId)),
		)
		.returning()
	return updatedClass
}

export const deleteClassCatalog = async ({
	id,
	teamId,
}: z.infer<typeof deleteClassCatalogSchema>) => {
	const db = getDd()
	const [deletedClass] = await db
		.delete(classCatalogTable)
		.where(
			and(eq(classCatalogTable.id, id), eq(classCatalogTable.teamId, teamId)),
		)
		.returning()
	return deletedClass
}

export const getClassCatalogByTeam = async ({ teamId }: { teamId: string }) => {
	const db = getDd()
	const classes = await db.query.classCatalogTable.findMany({
		where: eq(classCatalogTable.teamId, teamId),
	})
	return classes
}

// Server Actions for Skills
export const createSkill = async ({
	teamId,
	name,
}: z.infer<typeof createSkillSchema>) => {
	const db = getDd()
	const [newSkill] = await db
		.insert(skillsTable)
		.values({ id: createSkillId(), teamId, name })
		.returning()
	return newSkill
}

export const updateSkill = async ({
	id,
	teamId,
	name,
}: z.infer<typeof updateSkillSchema>) => {
	const db = getDd()
	const [updatedSkill] = await db
		.update(skillsTable)
		.set({ name })
		.where(and(eq(skillsTable.id, id), eq(skillsTable.teamId, teamId)))
		.returning()
	return updatedSkill
}

export const deleteSkill = async ({
	id,
	teamId,
}: z.infer<typeof deleteSkillSchema>) => {
	const db = getDd()
	const [deletedSkill] = await db
		.delete(skillsTable)
		.where(and(eq(skillsTable.id, id), eq(skillsTable.teamId, teamId)))
		.returning()
	return deletedSkill
}

export const getSkillsByTeam = async ({ teamId }: { teamId: string }) => {
	const db = getDd()
	const skills = await db.query.skillsTable.findMany({
		where: eq(skillsTable.teamId, teamId),
	})
	return skills
}
