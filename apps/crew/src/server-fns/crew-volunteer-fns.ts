// @lat: [[crew#Import Apply#Confirmed Mutation]]
// @lat: [[crew#Server Function Runtime Boundary]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { crewVolunteerSignupInputSchema } from "../lib/crew/volunteer-signup"

export type {
  CrewVolunteerScheduleResponseResult,
  CrewVolunteerScheduleTokenData,
  CrewVolunteerSignupPageData,
  CrewVolunteerVisibleAssignment,
  CrewVolunteerVisibleConfirmation,
  PublicCrewVolunteerEvent,
  PublicCrewVolunteerProfile,
  PublicCrewVolunteerQuestion,
  PublicCrewVolunteerWaiver,
} from "../server/crew-volunteer.server"

const getCrewVolunteerSignupPageInputSchema = z.object({
  slug: z.string().trim().min(1, "Event slug is required").max(255),
})

const getCrewVolunteerScheduleTokenInputSchema = z.object({
  slug: z.string().trim().min(1, "Event slug is required").max(255),
  token: z.string().trim().min(1, "Token is required").max(255),
})

const respondCrewVolunteerScheduleTokenInputSchema =
  getCrewVolunteerScheduleTokenInputSchema.extend({
    assignmentId: z.string().trim().min(1, "Assignment is required").max(255),
    action: z.enum(["confirm", "decline", "request_change"]),
    responseNote: z.string().trim().max(1000).optional(),
  })

export const getCrewVolunteerSignupPageFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getCrewVolunteerSignupPageInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { getCrewVolunteerSignupPage } = await import(
      "../server/crew-volunteer.server"
    )
    return getCrewVolunteerSignupPage(data)
  })

export const submitCrewVolunteerSignupFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => crewVolunteerSignupInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { submitCrewVolunteerSignup } = await import(
      "../server/crew-volunteer.server"
    )
    return submitCrewVolunteerSignup(data)
  })

export const getCrewVolunteerScheduleTokenFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    getCrewVolunteerScheduleTokenInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { getCrewVolunteerScheduleToken } = await import(
      "../server/crew-volunteer.server"
    )
    return getCrewVolunteerScheduleToken(data)
  })

export const respondCrewVolunteerScheduleTokenFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    respondCrewVolunteerScheduleTokenInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { respondCrewVolunteerScheduleToken } = await import(
      "../server/crew-volunteer.server"
    )
    return respondCrewVolunteerScheduleToken(data)
  })
