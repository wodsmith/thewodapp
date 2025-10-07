"use server"
import { createId } from "@paralleldrive/cuid2"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { createServerAction, ZSAError } from "@repo/zsa"
import { getDd } from "@/db"
import {
	coachBlackoutDatesTable,
	coachesTable,
	coachRecurringUnavailabilityTable,
	coachToSkillsTable,
	scheduledClassesTable,
} from "@/db/schemas/scheduling"

// Schemas for input validation
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

const updateCoachSchema = z.object({
	id: z.string(),
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

const getCoachesByTeamSchema = z.object({
	teamId: z.string(),
})

const getCoachByIdSchema = z.object({
	id: z.string(),
	teamId: z.string(),
})

const createCoachBlackoutDateSchema = z.object({
	coachId: z.string(),
	startDate: z.date(),
	endDate: z.date(),
	reason: z.string().optional(),
})

const deleteCoachBlackoutDateSchema = z.object({
	id: z.string(),
	coachId: z.string(),
})

const createCoachRecurringUnavailabilitySchema = z.object({
	coachId: z.string(),
	dayOfWeek: z.number().int().min(0).max(6),
	startTime: z
		.string()
		.regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
	endTime: z
		.string()
		.regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
	description: z.string().optional(),
})

const deleteCoachRecurringUnavailabilitySchema = z.object({
	id: z.string(),
	coachId: z.string(),
})

// Server Actions for Coaches
export const createCoach = createServerAction()
	.input(createCoachSchema)
	.handler(async ({ input }) => {
		try {
			const { userId, teamId, skillIds, ...rest } = input
			const db = getDd()
			const [newCoach] = await db
				.insert(coachesTable)
				.values({
					id: `coach_${createId()}`,
					userId,
					teamId,
					...rest,
					isActive: rest.isActive ? 1 : 0,
				})
				.returning()

			if (skillIds && newCoach) {
				const coachSkills = skillIds.map((skillId) => ({
					coachId: newCoach.id,
					skillId,
				}))
				await db.insert(coachToSkillsTable).values(coachSkills)
			}
			return { success: true, data: newCoach }
		} catch (error) {
			console.error("Failed to create coach:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to create coach")
		}
	})

export const updateCoach = createServerAction()
	.input(updateCoachSchema)
	.handler(async ({ input }) => {
		try {
			const { id, teamId, skillIds, ...rest } = input
			const db = getDd()
			const [updatedCoach] = await db
				.update(coachesTable)
				.set({ ...rest, isActive: rest.isActive ? 1 : 0 })
				.where(and(eq(coachesTable.id, id), eq(coachesTable.teamId, teamId)))
				.returning()

			if (updatedCoach && skillIds !== undefined) {
				// Delete existing skills for this coach
				await db
					.delete(coachToSkillsTable)
					.where(eq(coachToSkillsTable.coachId, id))
				// Insert new skills
				if (skillIds.length > 0) {
					const coachSkills = skillIds.map((skillId) => ({
						coachId: id,
						skillId,
					}))
					await db.insert(coachToSkillsTable).values(coachSkills)
				}
			}
			return { success: true, data: updatedCoach }
		} catch (error) {
			console.error("Failed to update coach:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to update coach")
		}
	})

export const deleteCoach = createServerAction()
	.input(deleteCoachSchema)
	.handler(async ({ input }) => {
		try {
			const { id, teamId } = input
			const db = getDd()

			// Delete related records
			await db
				.delete(coachToSkillsTable)
				.where(eq(coachToSkillsTable.coachId, id))
			await db
				.delete(coachBlackoutDatesTable)
				.where(eq(coachBlackoutDatesTable.coachId, id))
			await db
				.delete(coachRecurringUnavailabilityTable)
				.where(eq(coachRecurringUnavailabilityTable.coachId, id))

			// Unassign from scheduled classes
			await db
				.update(scheduledClassesTable)
				.set({ coachId: null })
				.where(eq(scheduledClassesTable.coachId, id))

			const [deletedCoach] = await db
				.delete(coachesTable)
				.where(and(eq(coachesTable.id, id), eq(coachesTable.teamId, teamId)))
				.returning()
			return { success: true, data: deletedCoach }
		} catch (error) {
			console.error("Failed to delete coach:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to delete coach")
		}
	})

export const getCoachesByTeam = createServerAction()
	.input(getCoachesByTeamSchema)
	.handler(async ({ input }) => {
		try {
			const { teamId } = input
			const db = getDd()
			const coaches = await db.query.coachesTable.findMany({
				where: eq(coachesTable.teamId, teamId),
				with: {
					user: true,
					skills: { with: { skill: true } },
					blackoutDates: true,
					recurringUnavailability: true,
				},
			})
			return { success: true, data: coaches }
		} catch (error) {
			console.error("Failed to get coaches by team:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get coaches by team",
			)
		}
	})

export const getCoachById = createServerAction()
	.input(getCoachByIdSchema)
	.handler(async ({ input }) => {
		try {
			const { id, teamId } = input
			const db = getDd()
			const coach = await db.query.coachesTable.findFirst({
				where: and(eq(coachesTable.id, id), eq(coachesTable.teamId, teamId)),
				with: {
					user: true,
					skills: { with: { skill: true } },
					blackoutDates: true,
					recurringUnavailability: true,
				},
			})
			return { success: true, data: coach }
		} catch (error) {
			console.error("Failed to get coach by id:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get coach by id")
		}
	})

// Server Actions for Coach Blackout Dates
export const createCoachBlackoutDate = createServerAction()
	.input(createCoachBlackoutDateSchema)
	.handler(async ({ input }) => {
		try {
			const db = getDd()
			const [newBlackoutDate] = await db
				.insert(coachBlackoutDatesTable)
				.values({ id: `cbd_${createId()}`, ...input })
				.returning()
			return { success: true, data: newBlackoutDate }
		} catch (error) {
			console.error("Failed to create coach blackout date:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to create coach blackout date",
			)
		}
	})

export const deleteCoachBlackoutDate = createServerAction()
	.input(deleteCoachBlackoutDateSchema)
	.handler(async ({ input }) => {
		try {
			const { id, coachId } = input
			const db = getDd()
			const [deletedBlackoutDate] = await db
				.delete(coachBlackoutDatesTable)
				.where(
					and(
						eq(coachBlackoutDatesTable.id, id),
						eq(coachBlackoutDatesTable.coachId, coachId),
					),
				)
				.returning()
			return { success: true, data: deletedBlackoutDate }
		} catch (error) {
			console.error("Failed to delete coach blackout date:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to delete coach blackout date",
			)
		}
	})

// Server Actions for Coach Recurring Unavailability
export const createCoachRecurringUnavailability = createServerAction()
	.input(createCoachRecurringUnavailabilitySchema)
	.handler(async ({ input }) => {
		try {
			const db = getDd()
			const [newRecurringUnavailability] = await db
				.insert(coachRecurringUnavailabilityTable)
				.values({ id: `cru_${createId()}`, ...input })
				.returning()
			return { success: true, data: newRecurringUnavailability }
		} catch (error) {
			console.error("Failed to create coach recurring unavailability:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to create coach recurring unavailability",
			)
		}
	})

export const deleteCoachRecurringUnavailability = createServerAction()
	.input(deleteCoachRecurringUnavailabilitySchema)
	.handler(async ({ input }) => {
		try {
			const db = getDd()
			const [deletedRecurringUnavailability] = await db
				.delete(coachRecurringUnavailabilityTable)
				.where(
					and(
						eq(coachRecurringUnavailabilityTable.id, input.id),
						eq(coachRecurringUnavailabilityTable.coachId, input.coachId),
					),
				)
				.returning()
			return { success: true, data: deletedRecurringUnavailability }
		} catch (error) {
			console.error("Failed to delete coach recurring unavailability:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to delete coach recurring unavailability",
			)
		}
	})
