import "server-only"
import { createId } from "@paralleldrive/cuid2"
import { getDd } from "@/db"
import {
	scheduleTemplatesTable,
	generatedSchedulesTable,
	scheduledClassesTable,
} from "@/db/schemas/scheduling"
import { and, eq } from "drizzle-orm"

interface ScheduleInput {
	templateId: string
	weekStartDate: Date
	teamId: string
	locationId: string
}

export async function generateSchedule({
	templateId,
	weekStartDate,
	teamId,
	locationId,
}: ScheduleInput) {
	const db = getDd()
	if (!db) {
		throw new Error("Database not initialized.")
	}

	// 1. Fetch all necessary data
	const template = await db?.query.scheduleTemplatesTable.findFirst({
		where: and(
			eq(scheduleTemplatesTable.id, templateId),
			eq(scheduleTemplatesTable.teamId, teamId),
		),
		with: {
			templateClasses: {
				with: {
					requiredSkills: { with: { skill: true } },
				},
			},
			classCatalog: true,
		},
	})

	if (!template) {
		throw new Error("Schedule template not found.")
	}

	// No longer auto-assigning coaches, so we don't need to fetch them

	const generatedClasses: (typeof scheduledClassesTable.$inferInsert)[] = []
	const unstaffedClasses: (typeof scheduledClassesTable.$inferInsert)[] = []

	// 2. Iterate through template classes and create them without auto-assigning coaches
	for (const templateClass of template.templateClasses) {
		const classStartTime = new Date(weekStartDate)
		classStartTime.setDate(weekStartDate.getDate() + templateClass.dayOfWeek)
		// Assuming startTime and endTime are HH:MM strings
		const [startHour, startMinute] = templateClass.startTime
			.split(":")
			.map(Number)
		const [endHour, endMinute] = templateClass.endTime.split(":").map(Number)

		classStartTime.setHours(startHour, startMinute, 0, 0)
		const classEndTime = new Date(classStartTime)
		classEndTime.setHours(endHour, endMinute, 0, 0)

		// Create all classes as unstaffed - admin will assign coaches manually
		unstaffedClasses.push({
			id: `sc_${createId()}`,
			scheduleId: "", // Will be filled after generated_schedules is inserted
			coachId: null, // Explicitly null for unstaffed
			classCatalogId: template.classCatalogId,
			locationId: locationId,
			startTime: classStartTime,
			endTime: classEndTime,
		})
	}

	// 4. Save the generated schedule and classes to the database
	const [newGeneratedSchedule] = await db
		.insert(generatedSchedulesTable)
		.values({
			id: `gs_${createId()}`,
			teamId,
			locationId,
			weekStartDate,
		})
		.returning()

	if (!newGeneratedSchedule) {
		throw new Error("Failed to create generated schedule.")
	}

	// Update scheduleId for all generated classes
	const finalScheduledClasses = generatedClasses.map((gc) => ({
		...gc,
		scheduleId: newGeneratedSchedule.id,
	}))
	const finalUnstaffedClasses = unstaffedClasses.map((uc) => ({
		...uc,
		scheduleId: newGeneratedSchedule.id,
	}))

	// Insert scheduled classes individually to avoid SQL variables limit
	if (finalScheduledClasses.length > 0) {
		console.log(
			`INFO: [generateSchedule] Inserting ${finalScheduledClasses.length} scheduled classes individually`,
		)

		for (let i = 0; i < finalScheduledClasses.length; i++) {
			const scheduledClass = finalScheduledClasses[i]

			try {
				await db?.insert(scheduledClassesTable).values(scheduledClass)

				if ((i + 1) % 10 === 0) {
					console.log(
						`INFO: [generateSchedule] Progress: ${i + 1}/${finalScheduledClasses.length} scheduled classes inserted`,
					)
				}
			} catch (error) {
				console.error(
					`ERROR: [generateSchedule] Failed to insert scheduled class ${i + 1}:`,
					error,
				)
				throw error
			}
		}
	}

	// Insert unstaffed classes individually to avoid SQL variables limit
	if (finalUnstaffedClasses.length > 0) {
		console.log(
			`INFO: [generateSchedule] Inserting ${finalUnstaffedClasses.length} unstaffed classes individually`,
		)

		for (let i = 0; i < finalUnstaffedClasses.length; i++) {
			const unstaffedClass = finalUnstaffedClasses[i]

			try {
				await db?.insert(scheduledClassesTable).values(unstaffedClass)

				if ((i + 1) % 10 === 0) {
					console.log(
						`INFO: [generateSchedule] Progress: ${i + 1}/${finalUnstaffedClasses.length} unstaffed classes inserted`,
					)
				}
			} catch (error) {
				console.error(
					`ERROR: [generateSchedule] Failed to insert unstaffed class ${i + 1}:`,
					error,
				)
				throw error
			}
		}
	}

	return {
		newGeneratedSchedule,
		unstaffedClasses: finalUnstaffedClasses.length,
	}
}

// Function to fetch scheduled classes with all related data for display
export async function getScheduledClassesForDisplay({
	scheduleId,
	teamId,
}: {
	scheduleId: string
	teamId: string
}) {
	const db = getDd()

	const scheduledClasses = await db.query.scheduledClassesTable.findMany({
		where: eq(scheduledClassesTable.scheduleId, scheduleId),
		with: {
			coach: {
				with: {
					user: true,
				},
			},
			classCatalog: true,
			location: true,
		},
	})

	return scheduledClasses
}

// Function to get all generated schedules for a team
export async function getGeneratedSchedulesForTeam(teamId: string) {
	const db = getDd()

	const schedules = await db.query.generatedSchedulesTable.findMany({
		where: eq(generatedSchedulesTable.teamId, teamId),
		with: {
			scheduledClasses: {
				with: {
					coach: {
						with: {
							user: true,
						},
					},
					classCatalog: true,
					location: true,
				},
			},
		},
		orderBy: (_schedules, { desc }) => [desc(generatedSchedulesTable.weekStartDate)],
	})

	return schedules
}
