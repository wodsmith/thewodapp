// @lat: [[crew#Import Apply#Confirmed Mutation]]
// @lat: [[crew#Server Function Runtime Boundary]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { crewVolunteerSignupInputSchema } from "../lib/crew/volunteer-signup"

export type {
  CrewVolunteerScheduleTokenData,
  CrewVolunteerSignupPageData,
  PublicCrewVolunteerEvent,
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
