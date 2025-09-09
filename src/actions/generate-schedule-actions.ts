"use server"
import { getDd } from "@/db"
import { 
	coachesTable,
	generatedSchedulesTable, 
	scheduledClassesTable,
	scheduleTemplatesTable 
} from "@/db/schemas/scheduling"
import { generateSchedule, getScheduledClassesForDisplay } from "@/server/ai/scheduler"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { createServerAction, ZSAError } from "zsa"

const generateScheduleSchema = z.object({
	templateId: z.string().min(1, "Template ID is required"),
	locationId: z.string().min(1, "Location ID is required"),
	weekStartDate: z.date(),
	teamId: z.string().min(1, "Team ID is required"),
})

const getGeneratedScheduleSchema = z.object({
	scheduleId: z.string().min(1, "Schedule ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
})

const checkExistingScheduleSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	weekStartDate: z.date(),
})

// Helper function to normalize date to start of week (Monday)
function getWeekStartDate(date: Date): Date {
	const d = new Date(date)
	const day = d.getDay()
	const diff = d.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
	const weekStart = new Date(d.setDate(diff))
	weekStart.setHours(0, 0, 0, 0)
	return weekStart
}

export const generateScheduleAction = createServerAction()
	.input(generateScheduleSchema)
	.handler(async ({ input }) => {
		const { templateId, locationId, weekStartDate, teamId } = input
		const db = getDd()
		
		try {
			// Normalize the week start date
			const normalizedWeekStart = getWeekStartDate(weekStartDate)
			
			// Validate that the template exists and belongs to the team
			const template = await db.query.scheduleTemplatesTable.findFirst({
				where: and(
					eq(scheduleTemplatesTable.id, templateId),
					eq(scheduleTemplatesTable.teamId, teamId),
				),
			})
			
			if (!template) {
				throw new ZSAError(
					"NOT_FOUND",
					"Schedule template not found or does not belong to this team",
				)
			}
			
			// Check if a schedule already exists for this week AND location
			const existingSchedule = await db.query.generatedSchedulesTable.findFirst({
				where: and(
					eq(generatedSchedulesTable.teamId, teamId),
					eq(generatedSchedulesTable.weekStartDate, normalizedWeekStart),
					eq(generatedSchedulesTable.locationId, locationId),
				),
			})
			
			if (existingSchedule) {
				throw new ZSAError(
					"CONFLICT",
					"A schedule already exists for this location and week. Please delete the existing schedule before generating a new one.",
				)
			}
			
			// Generate the schedule
			const result = await generateSchedule({
				templateId,
				locationId,
				weekStartDate: normalizedWeekStart,
				teamId,
			})
			
			// Fetch the complete schedule with all related data
			const scheduledClasses = await getScheduledClassesForDisplay({
				scheduleId: result.newGeneratedSchedule.id,
				teamId,
			})
			
			return {
				schedule: result.newGeneratedSchedule,
				scheduledClasses,
				unstaffedClassesCount: result.unstaffedClasses,
				totalClassesCount: scheduledClasses.length,
				staffedClassesCount: scheduledClasses.length - result.unstaffedClasses,
			}
		} catch (error) {
			console.error("Failed to generate schedule:", error)
			
			if (error instanceof ZSAError) {
				throw error
			}
			
			// Handle specific database errors
			if (error instanceof Error) {
				if (error.message.includes("Schedule template not found")) {
					throw new ZSAError(
						"NOT_FOUND",
						"Schedule template not found",
					)
				}
				if (error.message.includes("Database not initialized")) {
					throw new ZSAError(
						"INTERNAL_SERVER_ERROR",
						"Database connection error",
					)
				}
			}
			
			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to generate schedule. Please try again.",
			)
		}
	})

// Action to check if a schedule exists for a given week
export const checkExistingScheduleAction = createServerAction()
	.input(checkExistingScheduleSchema)
	.handler(async ({ input }) => {
		const { teamId, weekStartDate } = input
		const db = getDd()
		
		try {
			const normalizedWeekStart = getWeekStartDate(weekStartDate)
			
			const existingSchedule = await db.query.generatedSchedulesTable.findFirst({
				where: and(
					eq(generatedSchedulesTable.teamId, teamId),
					eq(generatedSchedulesTable.weekStartDate, normalizedWeekStart),
				),
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
			})
			
			return {
				exists: !!existingSchedule,
				schedule: existingSchedule,
			}
		} catch (error) {
			console.error("Failed to check existing schedule:", error)
			
			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to check existing schedule",
			)
		}
	})

// Action to get a generated schedule by ID
export const getGeneratedScheduleAction = createServerAction()
	.input(getGeneratedScheduleSchema)
	.handler(async ({ input }) => {
		const { scheduleId, teamId } = input
		
		try {
			const scheduledClasses = await getScheduledClassesForDisplay({
				scheduleId,
				teamId,
			})
			
			if (!scheduledClasses || scheduledClasses.length === 0) {
				throw new ZSAError(
					"NOT_FOUND",
					"Schedule not found or does not belong to this team",
				)
			}
			
			const unstaffedCount = scheduledClasses.filter(c => !c.coachId).length
			
			return {
				scheduledClasses,
				unstaffedClassesCount: unstaffedCount,
				totalClassesCount: scheduledClasses.length,
				staffedClassesCount: scheduledClasses.length - unstaffedCount,
			}
		} catch (error) {
			console.error("Failed to get generated schedule:", error)
			
			if (error instanceof ZSAError) {
				throw error
			}
			
			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to retrieve schedule",
			)
		}
	})

// Action to delete a generated schedule
const deleteGeneratedScheduleSchema = z.object({
	scheduleId: z.string().min(1, "Schedule ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
})

export const deleteGeneratedScheduleAction = createServerAction()
	.input(deleteGeneratedScheduleSchema)
	.handler(async ({ input }) => {
		const { scheduleId, teamId } = input
		const db = getDd()
		
		try {
			// Verify the schedule belongs to the team
			const schedule = await db.query.generatedSchedulesTable.findFirst({
				where: and(
					eq(generatedSchedulesTable.id, scheduleId),
					eq(generatedSchedulesTable.teamId, teamId),
				),
			})
			
			if (!schedule) {
				throw new ZSAError(
					"NOT_FOUND",
					"Schedule not found or does not belong to this team",
				)
			}
			
			// Delete the schedule
			// Note: scheduled_classes should be manually deleted first if cascade is not set up
			// First delete all scheduled classes for this schedule
			await db
				.delete(scheduledClassesTable)
				.where(eq(scheduledClassesTable.scheduleId, scheduleId))
			
			// Then delete the schedule itself
			await db
				.delete(generatedSchedulesTable)
				.where(eq(generatedSchedulesTable.id, scheduleId))
			
			return {
				success: true,
				deletedScheduleId: scheduleId,
			}
		} catch (error) {
			console.error("Failed to delete generated schedule:", error)
			
			if (error instanceof ZSAError) {
				throw error
			}
			
			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to delete schedule",
			)
		}
	})

// Action to get all generated schedules for a team
const getGeneratedSchedulesByTeamSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

export const getGeneratedSchedulesByTeamAction = createServerAction()
	.input(getGeneratedSchedulesByTeamSchema)
	.handler(async ({ input }) => {
		const { teamId } = input
		const db = getDd()
		
		try {
			const schedules = await db.query.generatedSchedulesTable.findMany({
				where: eq(generatedSchedulesTable.teamId, teamId),
				orderBy: (schedules, { desc }) => [desc(schedules.weekStartDate)],
			})
			
			// Get counts for each schedule
			const schedulesWithCounts = await Promise.all(
				schedules.map(async (schedule) => {
					const classes = await getScheduledClassesForDisplay({
						scheduleId: schedule.id,
						teamId,
					})
					
					const unstaffedCount = classes.filter(c => !c.coachId).length
					
					return {
						...schedule,
						totalClassesCount: classes.length,
						staffedClassesCount: classes.length - unstaffedCount,
						unstaffedClassesCount: unstaffedCount,
					}
				})
			)
			
			return {
				success: true,
				data: schedulesWithCounts,
			}
		} catch (error) {
			console.error("Failed to get generated schedules:", error)
			
			if (error instanceof ZSAError) {
				throw error
			}
			
			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to retrieve schedules",
			)
		}
	})

// Action to get scheduled classes for a schedule
const getScheduledClassesSchema = z.object({
	scheduleId: z.string().min(1, "Schedule ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
})

export const getScheduledClassesAction = createServerAction()
	.input(getScheduledClassesSchema)
	.handler(async ({ input }) => {
		const { scheduleId, teamId } = input
		
		try {
			const scheduledClasses = await getScheduledClassesForDisplay({
				scheduleId,
				teamId,
			})
			
			return {
				success: true,
				data: scheduledClasses,
			}
		} catch (error) {
			console.error("Failed to get scheduled classes:", error)
			
			if (error instanceof ZSAError) {
				throw error
			}
			
			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to retrieve scheduled classes",
			)
		}
	})

// Action to update a scheduled class (e.g., assign/reassign coach)
const updateScheduledClassSchema = z.object({
	classId: z.string().min(1, "Class ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	coachId: z.string().nullable().optional(),
})

export const updateScheduledClassAction = createServerAction()
	.input(updateScheduledClassSchema)
	.handler(async ({ input }) => {
		const { classId, teamId, coachId } = input
		const db = getDd()
		
		try {
			// Verify the class exists and get its schedule
			const scheduledClass = await db.query.scheduledClassesTable.findFirst({
				where: eq(scheduledClassesTable.id, classId),
				with: {
					schedule: true,
				},
			})
			
			if (!scheduledClass || scheduledClass.schedule.teamId !== teamId) {
				throw new ZSAError(
					"NOT_FOUND",
					"Scheduled class not found or does not belong to this team",
				)
			}
			
			// If assigning a coach, verify they belong to the team
			if (coachId) {
				const coach = await db.query.coachesTable.findFirst({
					where: and(
						eq(coachesTable.id, coachId),
						eq(coachesTable.teamId, teamId),
					),
				})
				
				if (!coach) {
					throw new ZSAError(
						"NOT_FOUND",
						"Coach not found or does not belong to this team",
					)
				}
			}
			
			// Update the scheduled class
			await db
				.update(scheduledClassesTable)
				.set({ coachId })
				.where(eq(scheduledClassesTable.id, classId))
			
			// Return the updated class with related data
			const updatedClassWithRelations = await db.query.scheduledClassesTable.findFirst({
				where: eq(scheduledClassesTable.id, classId),
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
			
			return updatedClassWithRelations
		} catch (error) {
			console.error("Failed to update scheduled class:", error)
			
			if (error instanceof ZSAError) {
				throw error
			}
			
			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to update scheduled class",
			)
		}
	})

// Action to get available coaches for a specific scheduled class
const getAvailableCoachesSchema = z.object({
	classId: z.string().min(1, "Class ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
})

export const getAvailableCoachesForClassAction = createServerAction()
	.input(getAvailableCoachesSchema)
	.handler(async ({ input }) => {
		const { classId, teamId } = input
		const db = getDd()
		
		try {
			// Get the scheduled class details
			const scheduledClass = await db.query.scheduledClassesTable.findFirst({
				where: eq(scheduledClassesTable.id, classId),
				with: {
					schedule: true,
					classCatalog: {
						with: {
							classToSkills: {
								with: {
									skill: true,
								},
							},
						},
					},
				},
			})
			
			if (!scheduledClass || scheduledClass.schedule.teamId !== teamId) {
				throw new ZSAError(
					"NOT_FOUND",
					"Scheduled class not found or does not belong to this team",
				)
			}
			
			// Get all coaches for the team
			const coaches = await db.query.coachesTable.findMany({
				where: and(
					eq(coachesTable.teamId, teamId),
					eq(coachesTable.isActive, 1),
				),
				with: {
					user: true,
					skills: {
						with: {
							skill: true,
						},
					},
					blackoutDates: true,
					recurringUnavailability: true,
					scheduledClasses: {
						where: and(
							eq(scheduledClassesTable.scheduleId, scheduledClass.scheduleId),
						),
					},
				},
			})
			
			const availableCoaches = []
			const unavailableCoaches = []
			
			for (const coach of coaches) {
				let isAvailable = true
				let unavailabilityReason = ""
				
				// Check if coach has required skills
				const requiredSkillIds = scheduledClass.classCatalog.classToSkills.map(
					(cs) => cs.skillId,
				)
				const coachSkillIds = coach.skills.map((cs) => cs.skillId)
				
				if (requiredSkillIds.length > 0) {
					const hasAllRequiredSkills = requiredSkillIds.every((skillId) =>
						coachSkillIds.includes(skillId),
					)
					if (!hasAllRequiredSkills) {
						isAvailable = false
						unavailabilityReason = "Missing required skills"
					}
				}
				
				// Check blackout dates
				if (isAvailable) {
					const classDate = new Date(scheduledClass.startTime)
					for (const blackout of coach.blackoutDates) {
						if (
							classDate >= blackout.startDate &&
							classDate <= blackout.endDate
						) {
							isAvailable = false
							unavailabilityReason = `Blackout: ${blackout.reason || "Time off"}`
							break
						}
					}
				}
				
				// Check recurring unavailability
				if (isAvailable) {
					const dayOfWeek = scheduledClass.startTime.getDay()
					const classStartTime = scheduledClass.startTime.toTimeString().slice(0, 5)
					const classEndTime = scheduledClass.endTime.toTimeString().slice(0, 5)
					
					for (const recurring of coach.recurringUnavailability) {
						if (
							recurring.dayOfWeek === dayOfWeek &&
							classStartTime < recurring.endTime &&
							classEndTime > recurring.startTime
						) {
							isAvailable = false
							unavailabilityReason = `Recurring unavailability: ${recurring.description || "Not available"}`
							break
						}
					}
				}
				
				// Check if coach is already scheduled at this time
				if (isAvailable) {
					const hasConflict = coach.scheduledClasses.some((sc) => 
						sc.id !== classId && // Not the same class
						sc.startTime < scheduledClass.endTime &&
						sc.endTime > scheduledClass.startTime
					)
					
					if (hasConflict) {
						isAvailable = false
						unavailabilityReason = "Already scheduled for another class"
					}
				}
				
				// Check weekly class limit
				if (isAvailable && coach.weeklyClassLimit) {
					const weeklyClassCount = coach.scheduledClasses.length
					if (weeklyClassCount >= coach.weeklyClassLimit) {
						isAvailable = false
						unavailabilityReason = `Weekly class limit reached (${weeklyClassCount}/${coach.weeklyClassLimit})`
					}
				}
				
				const coachInfo = {
					id: coach.id,
					userId: coach.userId,
					name: `${coach.user.firstName} ${coach.user.lastName}`,
					email: coach.user.email,
					schedulingPreference: coach.schedulingPreference,
					schedulingNotes: coach.schedulingNotes,
					skills: coach.skills.map(s => s.skill),
				}
				
				if (isAvailable) {
					availableCoaches.push(coachInfo)
				} else {
					unavailableCoaches.push({
						...coachInfo,
						unavailabilityReason,
					})
				}
			}
			
			return {
				availableCoaches,
				unavailableCoaches,
				totalCoaches: coaches.length,
			}
		} catch (error) {
			console.error("Failed to get available coaches:", error)
			
			if (error instanceof ZSAError) {
				throw error
			}
			
			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to retrieve available coaches",
			)
		}
	})
