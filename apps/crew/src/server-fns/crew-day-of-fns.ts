// @lat: [[crew#Day Of Operations Board]]
// @lat: [[crew#Server Function Runtime Boundary]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export type { CrewDayOfOperationsPageData } from "../server/crew-day-of.server"

const getCrewDayOfOperationsPageInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
})
const dayOfAssignmentTypeSchema = z.enum(["volunteer_shift", "judge_heat"])
const crewDayOfAssignmentMutationInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  assignmentType: dayOfAssignmentTypeSchema,
  assignmentId: z.string().min(1, "Assignment is required"),
})
const replaceCrewAssignmentInputSchema =
  crewDayOfAssignmentMutationInputSchema.extend({
    replacementMembershipId: z
      .string()
      .startsWith("tmem_", "Choose a replacement volunteer"),
  })

export const getCrewDayOfOperationsPageFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getCrewDayOfOperationsPageInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { getCrewDayOfOperationsPage } = await import(
      "../server/crew-day-of.server"
    )
    return getCrewDayOfOperationsPage(data)
  })

export const markCrewAssignmentCheckedInFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    crewDayOfAssignmentMutationInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { markCrewAssignmentCheckedIn } = await import(
      "../server/crew-day-of.server"
    )
    return markCrewAssignmentCheckedIn(data)
  })

export const markCrewAssignmentNoShowFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    crewDayOfAssignmentMutationInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { markCrewAssignmentNoShow } = await import(
      "../server/crew-day-of.server"
    )
    return markCrewAssignmentNoShow(data)
  })

export const replaceCrewAssignmentFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    replaceCrewAssignmentInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { replaceCrewAssignment } = await import(
      "../server/crew-day-of.server"
    )
    return replaceCrewAssignment(data)
  })
