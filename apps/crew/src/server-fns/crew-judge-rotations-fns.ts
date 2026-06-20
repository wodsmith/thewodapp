// @lat: [[crew#Judge Rotations]]
// @lat: [[crew#Server Function Runtime Boundary]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { LANE_SHIFT_PATTERN } from "@/db/schemas/volunteers"

export type {
  CrewJudgeAssignmentVersion,
  CrewJudgeEvent,
  CrewJudgeHeat,
  CrewJudgeHeatAssignment,
  CrewJudgeRotationsPageData,
  CrewJudgeVolunteer,
  CrewJudgeWorkout,
} from "../server/crew-judge-rotations.server"

const eventIdSchema = z.string().min(1, "Event ID is required")
const trackWorkoutIdSchema = z.string().min(1, "Workout ID is required")
const membershipIdSchema = z
  .string()
  .startsWith("tmem_", "Invalid membership ID")
const laneShiftPatternSchema = z.enum([
  LANE_SHIFT_PATTERN.STAY,
  LANE_SHIFT_PATTERN.SHIFT_RIGHT,
])
const optionalNotesSchema = z.string().trim().max(1000).nullable().optional()

const getCrewJudgeRotationsPageInputSchema = z.object({
  eventId: eventIdSchema,
})

const saveCrewJudgeRotationsForVolunteerInputSchema = z.object({
  eventId: eventIdSchema,
  trackWorkoutId: trackWorkoutIdSchema,
  membershipId: membershipIdSchema,
  laneShiftPattern: laneShiftPatternSchema,
  rotations: z
    .array(
      z.object({
        startingHeat: z.number().int().min(1),
        startingLane: z.number().int().min(1),
        heatsCount: z.number().int().min(1),
        notes: optionalNotesSchema,
      }),
    )
    .max(50),
})

const publishCrewJudgeRotationsInputSchema = z.object({
  eventId: eventIdSchema,
  trackWorkoutId: trackWorkoutIdSchema,
  notes: optionalNotesSchema,
})

export const getCrewJudgeRotationsPageFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getCrewJudgeRotationsPageInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { getCrewJudgeRotationsPage } = await import(
      "../server/crew-judge-rotations.server"
    )
    return getCrewJudgeRotationsPage(data)
  })

export const saveCrewJudgeRotationsForVolunteerFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    saveCrewJudgeRotationsForVolunteerInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { saveCrewJudgeRotationsForVolunteer } = await import(
      "../server/crew-judge-rotations.server"
    )
    return saveCrewJudgeRotationsForVolunteer(data)
  })

export const publishCrewJudgeRotationsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    publishCrewJudgeRotationsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { publishCrewJudgeRotations } = await import(
      "../server/crew-judge-rotations.server"
    )
    return publishCrewJudgeRotations(data)
  })
