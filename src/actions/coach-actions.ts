import { getDd } from "@/db"
import {
	coachesTable,
	coachToSkillsTable,
	coachBlackoutDatesTable,
	coachRecurringUnavailabilityTable,
} from "@/db/schemas/scheduling"
import { createId } from "@paralleldrive/cuid2"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { createServerAction } from "zsa"

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
		return newCoach
	})

export const updateCoach = createServerAction()
	.input(updateCoachSchema)
	.handler(async ({ input }) => {
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
		return updatedCoach
	})

export const deleteCoach = createServerAction()
	.input(deleteCoachSchema)
	.handler(async ({ input }) => {
		const { id, teamId } = input
		const db = getDd()
		const [deletedCoach] = await db
			.delete(coachesTable)
			.where(and(eq(coachesTable.id, id), eq(coachesTable.teamId, teamId)))
			.returning()
		return deletedCoach
	})

export const getCoachesByTeam = createServerAction()
	.input(getCoachesByTeamSchema)
	.handler(async ({ input }) => {
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
		return coaches
	})

export const getCoachById = createServerAction()
	.input(getCoachByIdSchema)
	.handler(async ({ input }) => {
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
		return coach
	})

// Server Actions for Coach Blackout Dates
export const createCoachBlackoutDate = createServerAction()
	.input(createCoachBlackoutDateSchema)
	.handler(async ({ input }) => {
		const db = getDd()
		const [newBlackoutDate] = await db
			.insert(coachBlackoutDatesTable)
			.values({ id: `cbd_${createId()}`, ...input })
			.returning()
		return newBlackoutDate
	})

export const deleteCoachBlackoutDate = createServerAction()
	.input(deleteCoachBlackoutDateSchema)
	.handler(async ({ input }) => {
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
		return deletedBlackoutDate
	})

// Server Actions for Coach Recurring Unavailability
export const createCoachRecurringUnavailability = createServerAction()
	.input(createCoachRecurringUnavailabilitySchema)
	.handler(async ({ input }) => {
		const db = getDd()
		const [newRecurringUnavailability] = await db
			.insert(coachRecurringUnavailabilityTable)
			.values({ id: `cru_${createId()}`, ...input })
			.returning()
		return newRecurringUnavailability
	})

export const deleteCoachRecurringUnavailability = createServerAction()
	.input(deleteCoachRecurringUnavailabilitySchema)
	.handler(async ({ input }) => {
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
		return deletedRecurringUnavailability
	})
