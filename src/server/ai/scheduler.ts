import { db } from "@/db"
import {
	coachesTable,
	classCatalogTable,
	locationsTable,
	scheduleTemplatesTable,
	scheduleTemplateClassesTable,
	scheduleTemplateClassRequiredSkillsTable,
	generatedSchedulesTable,
	scheduledClassesTable,
} from "@/db/schemas/scheduling"
import { and, eq, inArray, sql } from "drizzle-orm"
import { Coach, ScheduleTemplateClass, Skill } from "@/db/schemas/scheduling"

// This is a simplified mock for the LLM interaction. In a real scenario,
// this would involve calling an actual LLM API.
async function callLLMForSchedulingOptimization(
	prompt: string,
): Promise<string> {
	console.log("LLM Prompt:", prompt)
	// Mock LLM response for now
	return "Coach A is the best fit for this slot based on preferences."
}

interface ScheduleInput {
	templateId: string
	weekStartDate: Date
	teamId: string
}

export async function generateSchedule({
	templateId,
	weekStartDate,
	teamId,
}: ScheduleInput) {
	// 1. Fetch all necessary data
	const template = await db.query.scheduleTemplatesTable.findFirst({
		where: and(
			eq(scheduleTemplatesTable.id, templateId),
			eq(scheduleTemplatesTable.teamId, teamId),
		),
		with: {
			templateClasses: {
				with: {
					requiredSkills: { with: { skill: true } },
					classCatalog: true,
					location: true,
				},
			},
		},
	})

	if (!template) {
		throw new Error("Schedule template not found.")
	}

	const coaches = await db.query.coachesTable.findMany({
		where: eq(coachesTable.teamId, teamId),
		with: {
			user: true,
			skills: { with: { skill: true } },
			blackoutDates: true,
			recurringUnavailability: true,
		},
	})

	const allSkills = await db.query.skillsTable.findMany({
		where: eq(skillsTable.teamId, teamId),
	})

	const generatedClasses: (typeof scheduledClassesTable.$inferInsert)[] = []
	const unstaffedClasses: (typeof scheduledClassesTable.$inferInsert)[] = []

	// 2. Iterate through template classes and attempt to schedule
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

		let assignedCoach: Coach | null = null
		let eligibleCoaches: Coach[] = []

		// Filter coaches based on hard constraints
		for (const coach of coaches) {
			let isEligible = true

			// Check weekly class limit (simplified: assumes we track this externally or in a more complex way)
			// For now, just check if they are active
			if (!coach.isActive) {
				isEligible = false
			}

			// Check blackout dates
			for (const blackout of coach.blackoutDates) {
				if (
					(classStartTime >= blackout.startDate &&
						classStartTime < blackout.endDate) ||
					(classEndTime > blackout.startDate &&
						classEndTime <= blackout.endDate)
				) {
					isEligible = false
					break
				}
			}
			if (!isEligible) continue

			// Check recurring unavailability
			for (const recurring of coach.recurringUnavailability) {
				if (
					recurring.dayOfWeek === templateClass.dayOfWeek &&
					// Simple time overlap check (HH:MM strings)
					templateClass.startTime < recurring.endTime &&
					templateClass.endTime > recurring.startTime
				) {
					isEligible = false
					break
				}
			}
			if (!isEligible) continue

			// Check skill constraint
			const requiredSkillIds = templateClass.requiredSkills.map(
				(rs) => rs.skillId,
			)
			const coachSkillIds = coach.skills.map((cs) => cs.skillId)

			const hasAllRequiredSkills = requiredSkillIds.every((skillId) =>
				coachSkillIds.includes(skillId),
			)
			if (!hasAllRequiredSkills) {
				isEligible = false
			}
			if (!isEligible) continue

			// Check location constraint (simplified: assumes one class per location at a time)
			// This would require checking other scheduled classes for the same time/location
			// For now, we'll assume the AI handles this by not double-booking

			if (isEligible) {
				eligibleCoaches.push(coach)
			}
		}

		// 3. Select best coach (using LLM for soft constraints)
		if (eligibleCoaches.length > 0) {
			// In a real scenario, you'd construct a detailed prompt for the LLM
			// including coach preferences, historical data, etc.
			const llmPrompt = `Select the best coach for ${templateClass.classCatalog.name} at ${templateClass.location.name} on ${classStartTime.toDateString()} ${templateClass.startTime}. Eligible coaches: ${eligibleCoaches.map((c) => c.user.firstName + " " + c.user.lastName + " (Pref: " + c.schedulingPreference + ", Notes: " + c.schedulingNotes + ")").join(", ")}. Consider their preferences and notes.`
			const llmDecision = await callLLMForSchedulingOptimization(llmPrompt)

			// For now, just pick the first eligible coach as a mock decision
			assignedCoach = eligibleCoaches[0]

			generatedClasses.push({
				scheduleId: "", // Will be filled after generated_schedules is inserted
				coachId: assignedCoach.id,
				classCatalogId: templateClass.classCatalogId,
				locationId: templateClass.locationId,
				startTime: classStartTime,
				endTime: classEndTime,
			})
		} else {
			// No eligible coaches, class is unstaffed
			unstaffedClasses.push({
				scheduleId: "", // Will be filled after generated_schedules is inserted
				coachId: null, // Explicitly null for unstaffed
				classCatalogId: templateClass.classCatalogId,
				locationId: templateClass.locationId,
				startTime: classStartTime,
				endTime: classEndTime,
			})
		}
	}

	// 4. Save the generated schedule and classes to the database
	const [newGeneratedSchedule] = await db
		.insert(generatedSchedulesTable)
		.values({
			teamId,
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

	if (finalScheduledClasses.length > 0) {
		await db.insert(scheduledClassesTable).values(finalScheduledClasses)
	}
	if (finalUnstaffedClasses.length > 0) {
		await db.insert(scheduledClassesTable).values(finalUnstaffedClasses)
	}

	return {
		newGeneratedSchedule,
		unstaffedClasses: finalUnstaffedClasses.length,
	}
}
