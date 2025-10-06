"use server"
import { createId } from "@paralleldrive/cuid2"
import { z } from "zod"
import { createServerAction } from "zsa"
import { getDd } from "@/db"
import {
	classCatalogTable,
	coachBlackoutDatesTable,
	coachesTable,
	coachRecurringUnavailabilityTable,
	coachToSkillsTable,
	locationsTable,
	scheduleTemplateClassesTable,
	scheduleTemplatesTable,
	skillsTable,
} from "@/db/schemas/scheduling"
import { userTable } from "@/db/schemas/users"

// Schema for comprehensive gym setup
const createCompleteGymSetupSchema = z.object({
	teamId: z.string(),
	templateName: z.string().min(1, "Template name cannot be empty"),
	className: z
		.string()
		.min(1, "Class name cannot be empty")
		.default("CrossFit"),
	classDescription: z.string().optional(),
	locationName: z
		.string()
		.min(1, "Location name cannot be empty")
		.default("Main Gym"),
	cronExpressions: z.array(z.string()),
	duration: z.number().int().min(1).optional().default(60), // duration in minutes
	requiredCoaches: z.number().int().min(1).optional().default(1),
})

// Helper function to parse cron expression
function parseCronExpression(cronExpression: string) {
	const parts = cronExpression.trim().split(/\s+/)

	if (parts.length !== 5) {
		throw new Error(
			`Invalid cron expression: ${cronExpression}. Expected format: "minute hour day-of-month month day-of-week"`,
		)
	}

	const [minute, hour, _dayOfMonth, _month, dayOfWeek] = parts

	// Parse minute
	const minuteNum = parseInt(minute, 10)
	if (Number.isNaN(minuteNum) || minuteNum < 0 || minuteNum > 59) {
		throw new Error(`Invalid minute in cron expression: ${minute}`)
	}

	// Parse hour
	const hourNum = parseInt(hour, 10)
	if (Number.isNaN(hourNum) || hourNum < 0 || hourNum > 23) {
		throw new Error(`Invalid hour in cron expression: ${hour}`)
	}

	// Parse day of week (0 = Sunday, 6 = Saturday)
	const dayOfWeekNum = parseInt(dayOfWeek, 10)
	if (Number.isNaN(dayOfWeekNum) || dayOfWeekNum < 0 || dayOfWeekNum > 6) {
		throw new Error(`Invalid day of week in cron expression: ${dayOfWeek}`)
	}

	return {
		minute: minuteNum,
		hour: hourNum,
		dayOfWeek: dayOfWeekNum,
	}
}

// Helper function to format time
function formatTime(hour: number, minute: number): string {
	return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
}

// Helper function to calculate end time
function calculateEndTime(
	startHour: number,
	startMinute: number,
	durationMinutes: number,
): string {
	const totalMinutes = startHour * 60 + startMinute + durationMinutes
	const endHour = Math.floor(totalMinutes / 60) % 24
	const endMinute = totalMinutes % 60
	return formatTime(endHour, endMinute)
}

// Comprehensive gym setup action
export const createCompleteGymSetup = createServerAction()
	.input(createCompleteGymSetupSchema)
	.handler(async ({ input }) => {
		const {
			teamId,
			templateName,
			className,
			classDescription,
			locationName,
			cronExpressions,
			duration,
			requiredCoaches,
		} = input
		const db = getDd()

		console.log(
			"INFO: [createCompleteGymSetup] Starting comprehensive gym setup",
		)

		// Create class catalog
		const [classCatalog] = await db
			.insert(classCatalogTable)
			.values({
				id: `cc_${createId()}`,
				teamId,
				name: className,
				description: classDescription,
			})
			.returning()

		console.log(
			"INFO: [createCompleteGymSetup] Class catalog created:",
			classCatalog.id,
		)

		// Create location
		const [location] = await db
			.insert(locationsTable)
			.values({
				id: `loc_${createId()}`,
				teamId,
				name: locationName,
			})
			.returning()

		console.log("INFO: [createCompleteGymSetup] Location created:", location.id)

		// Create schedule template
		const [scheduleTemplate] = await db
			.insert(scheduleTemplatesTable)
			.values({
				id: `st_${createId()}`,
				teamId,
				name: templateName,
				classCatalogId: classCatalog.id,
				locationId: location.id,
			})
			.returning()

		console.log(
			"INFO: [createCompleteGymSetup] Schedule template created:",
			scheduleTemplate.id,
		)

		// Parse and validate all cron expressions
		const parsedSchedules = cronExpressions.map((cronExpression) => {
			try {
				const parsed = parseCronExpression(cronExpression)
				const startTime = formatTime(parsed.hour, parsed.minute)
				const endTime = calculateEndTime(parsed.hour, parsed.minute, duration)

				return {
					id: `stc_${createId()}`,
					templateId: scheduleTemplate.id,
					classCatalogId: classCatalog.id,
					locationId: location.id,
					dayOfWeek: parsed.dayOfWeek,
					startTime,
					endTime,
					requiredCoaches,
				}
			} catch (error) {
				throw new Error(
					`Failed to parse cron expression "${cronExpression}": ${error instanceof Error ? error.message : "Unknown error"}`,
				)
			}
		})

		// Insert template classes one at a time to avoid SQL variable limit
		const templateClasses = []

		console.log(
			`INFO: [createCompleteGymSetup] Processing ${parsedSchedules.length} schedule entries individually`,
		)

		for (let i = 0; i < parsedSchedules.length; i++) {
			const schedule = parsedSchedules[i]

			console.log(
				`INFO: [createCompleteGymSetup] Inserting schedule ${i + 1}/${parsedSchedules.length}: ${schedule.dayOfWeek} ${schedule.startTime}-${schedule.endTime}`,
			)

			try {
				const [templateClass] = await db
					.insert(scheduleTemplateClassesTable)
					.values(schedule)
					.returning()

				templateClasses.push(templateClass)

				if ((i + 1) % 10 === 0) {
					console.log(
						`INFO: [createCompleteGymSetup] Progress: ${i + 1}/${parsedSchedules.length} schedules inserted`,
					)
				}
			} catch (error) {
				console.error(
					`ERROR: [createCompleteGymSetup] Failed to insert schedule ${i + 1}:`,
					error,
				)
				throw error
			}
		}

		console.log(
			"INFO: [createCompleteGymSetup] Template classes created:",
			templateClasses.length,
		)

		console.log("INFO: [createCompleteGymSetup] Setup completed successfully")

		return {
			classCatalog,
			location,
			scheduleTemplate,
			templateClasses,
		}
	})

// Schema for creating coaches with diverse attributes
const createDiverseCoachesSchema = z.object({
	teamId: z.string(),
})

// Action to create coaches with diverse skills, blackout dates, and recurring unavailability
export const createDiverseCoaches = createServerAction()
	.input(createDiverseCoachesSchema)
	.handler(async ({ input }) => {
		const { teamId } = input
		const db = getDd()

		console.log("INFO: [createDiverseCoaches] Starting diverse coaches setup")

		// First, create some demo users for the coaches
		const demoUsers = [
			{
				id: `usr_${createId()}`,
				firstName: "Sarah",
				lastName: "Johnson",
				email: `sarah.johnson+${createId()}@example.com`,
				role: "user" as const,
			},
			{
				id: `usr_${createId()}`,
				firstName: "Mike",
				lastName: "Chen",
				email: `mike.chen+${createId()}@example.com`,
				role: "user" as const,
			},
			{
				id: `usr_${createId()}`,
				firstName: "Emily",
				lastName: "Rodriguez",
				email: `emily.rodriguez+${createId()}@example.com`,
				role: "user" as const,
			},
			{
				id: `usr_${createId()}`,
				firstName: "David",
				lastName: "Thompson",
				email: `david.thompson+${createId()}@example.com`,
				role: "user" as const,
			},
		]

		// Create users individually
		const createdUsers = []
		for (const user of demoUsers) {
			const [createdUser] = await db.insert(userTable).values(user).returning()
			createdUsers.push(createdUser)
			console.log(
				`INFO: [createDiverseCoaches] Created user: ${createdUser.firstName} ${createdUser.lastName}`,
			)
		}

		// Create skills for the team
		const skills = [
			{ name: "CrossFit Level 1", description: "Basic CrossFit certification" },
			{
				name: "CrossFit Level 2",
				description: "Advanced CrossFit certification",
			},
			{ name: "Weightlifting", description: "Olympic weightlifting specialty" },
			{ name: "Gymnastics", description: "Gymnastics movement specialty" },
			{ name: "Endurance", description: "Endurance and cardio specialty" },
			{ name: "Mobility", description: "Flexibility and mobility specialty" },
		]

		const createdSkills = []
		for (const skill of skills) {
			const [createdSkill] = await db
				.insert(skillsTable)
				.values({
					id: `skill_${createId()}`,
					teamId,
					name: skill.name,
				})
				.returning()
			createdSkills.push(createdSkill)
			console.log(
				`INFO: [createDiverseCoaches] Created skill: ${createdSkill.name}`,
			)
		}

		// Create coaches with diverse attributes
		const coachesData = [
			{
				user: createdUsers[0],
				preferences: {
					weeklyClassLimit: 15,
					schedulingPreference: "morning" as const,
					schedulingNotes:
						"Prefers early morning classes, great with beginners",
				},
				skills: [createdSkills[0], createdSkills[3]], // CrossFit L1, Gymnastics
				blackoutDates: [
					{
						startDate: new Date("2024-07-15"),
						endDate: new Date("2024-07-22"),
						reason: "Vacation in Hawaii",
					},
					{
						startDate: new Date("2024-12-23"),
						endDate: new Date("2024-12-30"),
						reason: "Holiday break",
					},
				],
				recurringUnavailability: [
					{
						dayOfWeek: 0, // Sunday
						startTime: "00:00",
						endTime: "10:00",
						description: "Sunday morning family time",
					},
					{
						dayOfWeek: 6, // Saturday
						startTime: "19:00",
						endTime: "23:59",
						description: "Saturday evening unavailable",
					},
				],
			},
			{
				user: createdUsers[1],
				preferences: {
					weeklyClassLimit: 20,
					schedulingPreference: "afternoon" as const,
					schedulingNotes: "Afternoon specialist, loves strength training",
				},
				skills: [createdSkills[0], createdSkills[1], createdSkills[2]], // CrossFit L1, L2, Weightlifting
				blackoutDates: [
					{
						startDate: new Date("2024-09-01"),
						endDate: new Date("2024-09-07"),
						reason: "Weightlifting competition",
					},
				],
				recurringUnavailability: [
					{
						dayOfWeek: 1, // Monday
						startTime: "06:00",
						endTime: "09:00",
						description: "Personal training sessions",
					},
					{
						dayOfWeek: 3, // Wednesday
						startTime: "06:00",
						endTime: "09:00",
						description: "Personal training sessions",
					},
					{
						dayOfWeek: 5, // Friday
						startTime: "06:00",
						endTime: "09:00",
						description: "Personal training sessions",
					},
				],
			},
			{
				user: createdUsers[2],
				preferences: {
					weeklyClassLimit: 12,
					schedulingPreference: "night" as const,
					schedulingNotes:
						"Evening classes, specializes in mobility and recovery",
				},
				skills: [createdSkills[0], createdSkills[4], createdSkills[5]], // CrossFit L1, Endurance, Mobility
				blackoutDates: [
					{
						startDate: new Date("2024-10-10"),
						endDate: new Date("2024-10-14"),
						reason: "Mobility certification course",
					},
				],
				recurringUnavailability: [
					{
						dayOfWeek: 2, // Tuesday
						startTime: "17:00",
						endTime: "19:00",
						description: "Yoga teacher training",
					},
					{
						dayOfWeek: 4, // Thursday
						startTime: "17:00",
						endTime: "19:00",
						description: "Yoga teacher training",
					},
				],
			},
			{
				user: createdUsers[3],
				preferences: {
					weeklyClassLimit: 25,
					schedulingPreference: "any" as const,
					schedulingNotes: "Very flexible schedule, can cover any time slot",
				},
				skills: [
					createdSkills[0],
					createdSkills[1],
					createdSkills[2],
					createdSkills[3],
				], // CrossFit L1, L2, Weightlifting, Gymnastics
				blackoutDates: [
					{
						startDate: new Date("2024-11-28"),
						endDate: new Date("2024-11-29"),
						reason: "Thanksgiving",
					},
				],
				recurringUnavailability: [
					{
						dayOfWeek: 0, // Sunday
						startTime: "12:00",
						endTime: "14:00",
						description: "Sunday lunch break",
					},
				],
			},
		]

		// Create coaches and their attributes
		const createdCoaches = []
		for (const coachData of coachesData) {
			// Create coach
			const [coach] = await db
				.insert(coachesTable)
				.values({
					id: `coach_${createId()}`,
					userId: coachData.user.id,
					teamId,
					weeklyClassLimit: coachData.preferences.weeklyClassLimit,
					schedulingPreference: coachData.preferences.schedulingPreference,
					schedulingNotes: coachData.preferences.schedulingNotes,
					isActive: 1,
				})
				.returning()

			console.log(
				`INFO: [createDiverseCoaches] Created coach: ${coachData.user.firstName} ${coachData.user.lastName}`,
			)

			// Add skills to coach
			for (const skill of coachData.skills) {
				await db.insert(coachToSkillsTable).values({
					coachId: coach.id,
					skillId: skill.id,
				})
			}

			// Add blackout dates
			for (const blackout of coachData.blackoutDates) {
				await db.insert(coachBlackoutDatesTable).values({
					id: `blackout_${createId()}`,
					coachId: coach.id,
					startDate: blackout.startDate,
					endDate: blackout.endDate,
					reason: blackout.reason,
				})
			}

			// Add recurring unavailability
			for (const unavailability of coachData.recurringUnavailability) {
				await db.insert(coachRecurringUnavailabilityTable).values({
					id: `recurring_${createId()}`,
					coachId: coach.id,
					dayOfWeek: unavailability.dayOfWeek,
					startTime: unavailability.startTime,
					endTime: unavailability.endTime,
					description: unavailability.description,
				})
			}

			createdCoaches.push({
				coach,
				user: coachData.user,
				skillsCount: coachData.skills.length,
				blackoutDatesCount: coachData.blackoutDates.length,
				recurringUnavailabilityCount: coachData.recurringUnavailability.length,
			})
		}

		console.log("INFO: [createDiverseCoaches] Setup completed successfully")

		return {
			createdUsers,
			createdSkills,
			createdCoaches,
		}
	})

// Schema for complete gym setup with coaches - extends the existing schema
const createCompleteGymSetupWithCoachesSchema = createCompleteGymSetupSchema

// Composed action that sets up gym AND creates diverse coaches
export const createCompleteGymSetupWithCoaches = createServerAction()
	.input(createCompleteGymSetupWithCoachesSchema)
	.handler(async ({ input }) => {
		console.log(
			"INFO: [createCompleteGymSetupWithCoaches] Starting complete setup",
		)

		// Step 1: Create the gym setup (schedule template, classes, location)
		const [gymSetupResult, gymSetupError] = await createCompleteGymSetup({
			teamId: input.teamId,
			templateName: input.templateName,
			className: input.className,
			classDescription: input.classDescription,
			locationName: input.locationName,
			cronExpressions: input.cronExpressions,
			duration: input.duration,
			requiredCoaches: input.requiredCoaches,
		})

		if (gymSetupError) {
			throw new Error(`Gym setup failed: ${gymSetupError.message}`)
		}

		console.log("INFO: [createCompleteGymSetupWithCoaches] Gym setup completed")

		// Step 2: Create diverse coaches
		const [coachesResult, coachesError] = await createDiverseCoaches({
			teamId: input.teamId,
		})

		if (coachesError) {
			throw new Error(`Coaches setup failed: ${coachesError.message}`)
		}

		console.log(
			"INFO: [createCompleteGymSetupWithCoaches] Coaches setup completed",
		)

		// Return combined results
		return {
			gymSetup: gymSetupResult,
			coaches: coachesResult,
			summary: {
				classesCreated: gymSetupResult.templateClasses.length,
				coachesCreated: coachesResult.createdCoaches.length,
				skillsCreated: coachesResult.createdSkills.length,
			},
		}
	})
