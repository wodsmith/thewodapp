/**
 * Admin Gym Setup Server Functions for TanStack Start
 * Functions for gym setup and coach management within admin team context
 *
 * This file uses top-level imports for server-only modules.
 */

import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { eq, and, count } from "drizzle-orm"
import { createId } from "@paralleldrive/cuid2"
import { getDb } from "@/db"
import { createLocationId, createSkillId } from "@/db/schemas/common"
import {
	locationsTable,
	skillsTable,
	scheduleTemplatesTable,
	scheduledClassesTable,
	classCatalogToSkillsTable,
	coachToSkillsTable,
	scheduleTemplateClassRequiredSkillsTable,
	coachesTable,
	coachBlackoutDatesTable,
	coachRecurringUnavailabilityTable,
} from "@/db/schemas/scheduling"
import { teamTable, teamMembershipTable } from "@/db/schemas/teams"
import { requireAdmin } from "@/utils/auth"

// ============================================================================
// Input Schemas
// ============================================================================

const teamIdSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

const createLocationSchema = z.object({
	teamId: z.string(),
	name: z.string().min(1, "Location name cannot be empty"),
	capacity: z.coerce.number().int().min(1, "Capacity must be at least 1"),
})

const deleteLocationSchema = z.object({
	id: z.string(),
	teamId: z.string(),
})

const createSkillSchema = z.object({
	teamId: z.string(),
	name: z.string().min(1, "Skill name cannot be empty"),
})

const deleteSkillSchema = z.object({
	id: z.string(),
	teamId: z.string(),
})

const updateTeamSettingsSchema = z.object({
	teamId: z.string(),
	settings: z.string(),
})

const createCoachSchema = z.object({
	userId: z.string(),
	teamId: z.string(),
	weeklyClassLimit: z.number().int().min(0).optional(),
	schedulingPreference: z
		.enum(["morning", "afternoon", "night", "any"])
		.optional(),
	schedulingNotes: z.string().optional(),
	isActive: z.boolean().optional(),
	skillIds: z.array(z.string()).optional(),
})

const deleteCoachSchema = z.object({
	id: z.string(),
	teamId: z.string(),
})

// ============================================================================
// Location Server Functions
// ============================================================================

/**
 * Get all locations for a team
 */
export const getLocationsByTeamFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => teamIdSchema.parse(data))
	.handler(async ({ data }) => {
		await requireAdmin()
		const db = getDb()

		const locations = await db.query.locationsTable.findMany({
			where: eq(locationsTable.teamId, data.teamId),
		})

		return { success: true, data: locations }
	})

/**
 * Create a new location
 */
export const createLocationFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => createLocationSchema.parse(data))
	.handler(async ({ data }) => {
		await requireAdmin()
		const db = getDb()

		const locationId = createLocationId()
		await db
			.insert(locationsTable)
			.values({
				id: locationId,
				teamId: data.teamId,
				name: data.name,
				capacity: data.capacity,
			})

		const [newLocation] = await db
			.select()
			.from(locationsTable)
			.where(eq(locationsTable.id, locationId))

		return { success: true, data: newLocation }
	})

/**
 * Delete a location
 */
export const deleteLocationFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => deleteLocationSchema.parse(data))
	.handler(async ({ data }) => {
		await requireAdmin()
		const db = getDb()

		// Check if location is in use
		const [templateCount] = await db
			.select({ count: count() })
			.from(scheduleTemplatesTable)
			.where(eq(scheduleTemplatesTable.locationId, data.id))

		const [scheduledCount] = await db
			.select({ count: count() })
			.from(scheduledClassesTable)
			.where(eq(scheduledClassesTable.locationId, data.id))

		if ((templateCount?.count ?? 0) > 0 || (scheduledCount?.count ?? 0) > 0) {
			throw new Error(
				"Cannot delete location that is used in schedules or templates",
			)
		}

		const [locationToDelete] = await db
			.select()
			.from(locationsTable)
			.where(
				and(
					eq(locationsTable.id, data.id),
					eq(locationsTable.teamId, data.teamId),
				),
			)

		await db
			.delete(locationsTable)
			.where(
				and(
					eq(locationsTable.id, data.id),
					eq(locationsTable.teamId, data.teamId),
				),
			)

		return { success: true, data: locationToDelete }
	})

// ============================================================================
// Skill Server Functions
// ============================================================================

/**
 * Get all skills for a team
 */
export const getSkillsByTeamFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => teamIdSchema.parse(data))
	.handler(async ({ data }) => {
		await requireAdmin()
		const db = getDb()

		const skills = await db.query.skillsTable.findMany({
			where: eq(skillsTable.teamId, data.teamId),
		})

		return { success: true, data: skills }
	})

/**
 * Create a new skill
 */
export const createSkillFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => createSkillSchema.parse(data))
	.handler(async ({ data }) => {
		await requireAdmin()
		const db = getDb()

		const skillId = createSkillId()
		await db
			.insert(skillsTable)
			.values({
				id: skillId,
				teamId: data.teamId,
				name: data.name,
			})

		const [newSkill] = await db
			.select()
			.from(skillsTable)
			.where(eq(skillsTable.id, skillId))

		return { success: true, data: newSkill }
	})

/**
 * Delete a skill
 */
export const deleteSkillFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => deleteSkillSchema.parse(data))
	.handler(async ({ data }) => {
		await requireAdmin()
		const db = getDb()

		// Check if skill is in use
		const [classCatalogCount] = await db
			.select({ count: count() })
			.from(classCatalogToSkillsTable)
			.where(eq(classCatalogToSkillsTable.skillId, data.id))

		const [coachCount] = await db
			.select({ count: count() })
			.from(coachToSkillsTable)
			.where(eq(coachToSkillsTable.skillId, data.id))

		const [templateSkillsCount] = await db
			.select({ count: count() })
			.from(scheduleTemplateClassRequiredSkillsTable)
			.where(eq(scheduleTemplateClassRequiredSkillsTable.skillId, data.id))

		if (
			(classCatalogCount?.count ?? 0) > 0 ||
			(coachCount?.count ?? 0) > 0 ||
			(templateSkillsCount?.count ?? 0) > 0
		) {
			throw new Error(
				"Cannot delete skill that is used in classes, coaches or templates",
			)
		}

		const [skillToDelete] = await db
			.select()
			.from(skillsTable)
			.where(
				and(eq(skillsTable.id, data.id), eq(skillsTable.teamId, data.teamId)),
			)

		await db
			.delete(skillsTable)
			.where(
				and(eq(skillsTable.id, data.id), eq(skillsTable.teamId, data.teamId)),
			)

		return { success: true, data: skillToDelete }
	})

// ============================================================================
// Team Settings Server Functions
// ============================================================================

/**
 * Update team settings (for country, etc.)
 */
export const updateTeamSettingsFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => updateTeamSettingsSchema.parse(data))
	.handler(async ({ data }) => {
		await requireAdmin()
		const db = getDb()

		await db
			.update(teamTable)
			.set({ settings: data.settings })
			.where(eq(teamTable.id, data.teamId))

		const [updatedTeam] = await db
			.select()
			.from(teamTable)
			.where(eq(teamTable.id, data.teamId))

		return { success: true, data: updatedTeam }
	})

// ============================================================================
// Coach Server Functions
// ============================================================================

/**
 * Get all coaches for a team
 */
export const getCoachesByTeamFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => teamIdSchema.parse(data))
	.handler(async ({ data }) => {
		await requireAdmin()
		const db = getDb()

		const coaches = await db.query.coachesTable.findMany({
			where: eq(coachesTable.teamId, data.teamId),
			with: {
				user: true,
				skills: { with: { skill: true } },
				blackoutDates: true,
				recurringUnavailability: true,
			},
		})

		return { success: true, data: coaches }
	})

/**
 * Get team members for a team (for coach selection dropdown)
 */
export const getTeamMembersFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => teamIdSchema.parse(data))
	.handler(async ({ data }) => {
		await requireAdmin()
		const db = getDb()

		const members = await db.query.teamMembershipTable.findMany({
			where: and(
				eq(teamMembershipTable.teamId, data.teamId),
				eq(teamMembershipTable.isActive, true),
			),
			with: {
				user: {
					columns: {
						id: true,
						email: true,
						firstName: true,
						lastName: true,
					},
				},
			},
		})

		return { success: true, data: members }
	})

/**
 * Create a new coach
 */
export const createCoachFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => createCoachSchema.parse(data))
	.handler(async ({ data }) => {
		await requireAdmin()
		const db = getDb()

		const { skillIds, ...coachData } = data
		const coachId = `coach_${createId()}`
		await db
			.insert(coachesTable)
			.values({
				id: coachId,
				userId: coachData.userId,
				teamId: coachData.teamId,
				weeklyClassLimit: coachData.weeklyClassLimit,
				schedulingPreference: coachData.schedulingPreference,
				schedulingNotes: coachData.schedulingNotes,
				isActive: coachData.isActive !== false,
			})

		const [newCoach] = await db
			.select()
			.from(coachesTable)
			.where(eq(coachesTable.id, coachId))

		if (skillIds && newCoach) {
			const coachSkills = skillIds.map((skillId) => ({
				coachId: newCoach.id,
				skillId,
			}))
			await db.insert(coachToSkillsTable).values(coachSkills)
		}

		return { success: true, data: newCoach }
	})

/**
 * Delete a coach
 */
export const deleteCoachFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => deleteCoachSchema.parse(data))
	.handler(async ({ data }) => {
		await requireAdmin()
		const db = getDb()

		// Verify coach belongs to team BEFORE deleting related records
		const [coach] = await db
			.select()
			.from(coachesTable)
			.where(eq(coachesTable.id, data.id))

		if (!coach) {
			return { success: true, data: null } // Already deleted
		}

		if (coach.teamId !== data.teamId) {
			throw new Error("Cannot delete coach from another team")
		}

		// Delete related records
		await db
			.delete(coachToSkillsTable)
			.where(eq(coachToSkillsTable.coachId, data.id))
		await db
			.delete(coachBlackoutDatesTable)
			.where(eq(coachBlackoutDatesTable.coachId, data.id))
		await db
			.delete(coachRecurringUnavailabilityTable)
			.where(eq(coachRecurringUnavailabilityTable.coachId, data.id))

		// Unassign from scheduled classes
		await db
			.update(scheduledClassesTable)
			.set({ coachId: null })
			.where(eq(scheduledClassesTable.coachId, data.id))

		const [coachToDelete] = await db
			.select()
			.from(coachesTable)
			.where(
				and(eq(coachesTable.id, data.id), eq(coachesTable.teamId, data.teamId)),
			)

		await db
			.delete(coachesTable)
			.where(
				and(eq(coachesTable.id, data.id), eq(coachesTable.teamId, data.teamId)),
			)

		return { success: true, data: coachToDelete }
	})
