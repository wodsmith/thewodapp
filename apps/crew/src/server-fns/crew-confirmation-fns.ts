// @lat: [[crew#Assignment Confirmation Responses]]
// @lat: [[crew#Server Function Runtime Boundary]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export type {
  CrewAssignmentConfirmationEmailMessage,
  CrewAssignmentConfirmationResponseResult,
  CrewAssignmentConfirmationTokenData,
  CrewShiftAssignmentConfirmationStatus,
  EnsureCrewShiftAssignmentConfirmationResult,
} from "../server/crew-confirmation.server"

const publicTokenInputSchema = z.object({
  slug: z.string().trim().min(1, "Event slug is required").max(255),
  token: z.string().trim().min(1, "Token is required").max(255),
})

const publicTokenResponseInputSchema = publicTokenInputSchema.extend({
  action: z.enum(["confirm", "decline", "request_change"]),
  responseNote: z.string().trim().max(1000).optional(),
})

export const getCrewAssignmentConfirmationTokenFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) => publicTokenInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { getCrewAssignmentConfirmationToken } = await import(
      "../server/crew-confirmation.server"
    )
    return getCrewAssignmentConfirmationToken(data)
  })

export const respondCrewAssignmentConfirmationTokenFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) => publicTokenResponseInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { respondCrewAssignmentConfirmationToken } = await import(
      "../server/crew-confirmation.server"
    )
    return respondCrewAssignmentConfirmationToken(data)
  })
