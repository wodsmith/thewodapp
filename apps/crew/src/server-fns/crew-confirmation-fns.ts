// @lat: [[crew#Assignment Confirmation Responses]]
// @lat: [[crew#Assignment Confirmations]]
// @lat: [[crew#Server Function Runtime Boundary]]
// @lat: [[crew#Confirmation Emails And Reminders]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { CREW_ASSIGNMENT_CONFIRMATION_ORGANIZER_STATES } from "../lib/crew/assignment-confirmations"
import type {
  QueueCrewAssignmentConfirmationEmailsInput,
  QueueCrewAssignmentConfirmationEmailsResult,
  UpdateCrewShiftAssignmentConfirmationStateInput,
} from "../server/crew-confirmation.server"

export type {
  CrewAssignmentEmailQueueMessage,
  CrewAssignmentConfirmationResponseResult,
  CrewAssignmentConfirmationTokenData,
  CrewShiftAssignmentConfirmationStatus,
  EnsureCrewShiftAssignmentConfirmationResult,
  QueueCrewAssignmentConfirmationEmailsInput,
  QueueCrewAssignmentConfirmationEmailsResult,
  UpdateCrewShiftAssignmentConfirmationStateInput,
} from "../server/crew-confirmation.server"

const publicTokenInputSchema = z.object({
  slug: z.string().trim().min(1, "Event slug is required").max(255),
  token: z.string().trim().min(1, "Token is required").max(255),
})

const publicTokenResponseInputSchema = publicTokenInputSchema.extend({
  action: z.enum(["confirm", "decline", "request_change"]),
  responseNote: z.string().trim().max(1000).optional(),
})

const updateShiftAssignmentConfirmationStateInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  assignmentId: z.string().startsWith("vsha_", "Invalid assignment ID"),
  state: z.enum(CREW_ASSIGNMENT_CONFIRMATION_ORGANIZER_STATES),
  responseNote: z.string().trim().max(1000).optional(),
}) satisfies z.ZodType<UpdateCrewShiftAssignmentConfirmationStateInput>

const queueCrewAssignmentConfirmationEmailsInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  mode: z.enum(["confirmations", "reminders"]),
}) satisfies z.ZodType<QueueCrewAssignmentConfirmationEmailsInput>

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

export const updateCrewShiftAssignmentConfirmationStateFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    updateShiftAssignmentConfirmationStateInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { updateCrewShiftAssignmentConfirmationState } = await import(
      "../server/crew-confirmation.server"
    )
    return updateCrewShiftAssignmentConfirmationState(data)
  })

export const queueCrewAssignmentConfirmationEmailsFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    queueCrewAssignmentConfirmationEmailsInputSchema.parse(data),
  )
  .handler(
    async ({ data }): Promise<QueueCrewAssignmentConfirmationEmailsResult> => {
      const { queueCrewAssignmentConfirmationEmails } = await import(
        "../server/crew-confirmation.server"
      )
      return queueCrewAssignmentConfirmationEmails(data)
    },
  )
