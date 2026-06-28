// @lat: [[crew#Roster Shifts Assignments]]
// @lat: [[crew#Server Function Runtime Boundary]]
// @lat: [[crew#Manual Volunteer Intake]]
// @lat: [[crew#Roster Volunteer Editing]]
import { createServerFn } from "@tanstack/react-start"
import {
  VOLUNTEER_AVAILABILITY,
  VOLUNTEER_ROLE_TYPE_VALUES,
} from "@repo/wodsmith-db/schemas/volunteers"
import { z } from "zod"

export type {
  CrewRosterPageData,
  CrewShiftBoardData,
  CrewShiftBoardItem,
  CrewShiftSummary,
  ManualCrewVolunteerMutationResult,
} from "../server/crew-roster-shift.server"

const eventIdSchema = z.string().min(1, "Event ID is required")
const eventInputSchema = z.object({ eventId: eventIdSchema })
const shiftIdSchema = z.string().startsWith("vshf_", "Invalid shift ID")
// A shift can be staffed by a membership (account-backed volunteer) or an
// invitation (imported / manual volunteer without an account).
const assigneeIdSchema = z
  .string()
  .refine(
    (value) => value.startsWith("tmem_") || value.startsWith("tinv_"),
    "Invalid membership or invitation ID",
  )
const rosterSourceSchema = z.enum(["team_invitation", "team_membership"])
const rosterSourceIdSchema = z.string().min(1, "Roster volunteer ID is required")
const roleTypeSchema = z.enum(VOLUNTEER_ROLE_TYPE_VALUES)
const availabilitySchema = z
  .enum([
    VOLUNTEER_AVAILABILITY.MORNING,
    VOLUNTEER_AVAILABILITY.AFTERNOON,
    VOLUNTEER_AVAILABILITY.ALL_DAY,
  ])
  .optional()
const shiftTextSchema = z.string().trim().max(1000).optional()
const shiftDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
const shiftTimeSchema = z
  .string()
  .regex(/^([01]?\d|2[0-3]):([0-5]\d)$/, "Time must be HH:mm")

const shiftInputSchema = z.object({
  eventId: eventIdSchema,
  name: z.string().trim().min(1, "Name is required").max(200),
  roleType: roleTypeSchema,
  date: shiftDateSchema,
  startTime: shiftTimeSchema,
  endTime: shiftTimeSchema,
  location: z.string().trim().max(200).optional(),
  capacity: z.coerce.number().int().min(1).max(500),
  notes: shiftTextSchema,
})

const updateShiftInputSchema = shiftInputSchema
  .extend({
    shiftId: shiftIdSchema,
  })
  .partial({
    name: true,
    roleType: true,
    date: true,
    startTime: true,
    endTime: true,
    location: true,
    capacity: true,
    notes: true,
  })
  .required({
    eventId: true,
    shiftId: true,
  })

const shiftAssignmentInputSchema = z.object({
  eventId: eventIdSchema,
  shiftId: shiftIdSchema,
  assigneeId: assigneeIdSchema,
  notes: z.string().trim().max(500).optional(),
})

const deleteShiftInputSchema = z.object({
  eventId: eventIdSchema,
  shiftId: shiftIdSchema,
})

// Require a name or an email so an email-less volunteer is still identifiable
// in the roster.
function requireNameOrEmail(
  data: { email?: string; name?: string },
  ctx: z.RefinementCtx,
) {
  if (!data.email && !data.name) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["name"],
      message: "Enter a name or an email",
    })
  }
}

const manualVolunteerMetadataObject = z.object({
  eventId: eventIdSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .max(255)
    // Allow blank so organizers can add a volunteer with no email; the empty
    // input arrives as "" and is normalized to undefined.
    .or(z.literal(""))
    .optional()
    .transform((value) => (value ? value : undefined)),
  name: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(50).optional(),
  roleTypes: z
    .array(roleTypeSchema)
    .max(VOLUNTEER_ROLE_TYPE_VALUES.length)
    .optional(),
  availability: availabilitySchema,
  availabilityNotes: z.string().trim().max(5000).optional(),
  notes: z.string().trim().max(5000).optional(),
})

const manualVolunteerMetadataInputSchema =
  manualVolunteerMetadataObject.superRefine(requireNameOrEmail)

const manualVolunteerPasteInputSchema = z.object({
  eventId: eventIdSchema,
  pasteText: z.string().trim().min(1, "Paste at least one email").max(50000),
})

const updateRosterVolunteerInputSchema =
  manualVolunteerMetadataObject
    .extend({
      source: rosterSourceSchema,
      sourceId: rosterSourceIdSchema,
      credentials: z.string().trim().max(1000).optional(),
    })
    .superRefine((data, ctx) => {
      requireNameOrEmail(data, ctx)
      if (
        data.source === "team_invitation" &&
        !data.sourceId.startsWith("tinv_")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sourceId"],
          message: "Invalid invitation roster ID",
        })
      }
      if (
        data.source === "team_membership" &&
        !data.sourceId.startsWith("tmem_")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sourceId"],
          message: "Invalid membership roster ID",
        })
      }
    })

export const getCrewRosterPageFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => eventInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { getCrewRosterPage } = await import(
      "../server/crew-roster-shift.server"
    )
    return getCrewRosterPage(data)
  })

export const getCrewShiftBoardFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => eventInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { getCrewShiftBoard } = await import(
      "../server/crew-roster-shift.server"
    )
    return getCrewShiftBoard(data)
  })

export const getCrewEventRosterShiftSummaryFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) => eventInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { getCrewEventRosterShiftSummary } = await import(
      "../server/crew-roster-shift.server"
    )
    return getCrewEventRosterShiftSummary(data)
  })

export const createCrewShiftFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => shiftInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { createCrewShift } = await import(
      "../server/crew-roster-shift.server"
    )
    return createCrewShift(data)
  })

export const createManualCrewVolunteerFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    manualVolunteerMetadataInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { createManualCrewVolunteer } = await import(
      "../server/crew-roster-shift.server"
    )
    return createManualCrewVolunteer(data)
  })

export const pasteManualCrewVolunteerEmailsFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    manualVolunteerPasteInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { pasteManualCrewVolunteerEmails } = await import(
      "../server/crew-roster-shift.server"
    )
    return pasteManualCrewVolunteerEmails(data)
  })

export const updateCrewRosterVolunteerFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    updateRosterVolunteerInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { updateCrewRosterVolunteer } = await import(
      "../server/crew-roster-shift.server"
    )
    return updateCrewRosterVolunteer(data)
  })

export const updateCrewShiftFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateShiftInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { updateCrewShift } = await import(
      "../server/crew-roster-shift.server"
    )
    return updateCrewShift(data)
  })

export const deleteCrewShiftFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteShiftInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { deleteCrewShift } = await import(
      "../server/crew-roster-shift.server"
    )
    return deleteCrewShift(data)
  })

export const assignCrewVolunteerToShiftFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => shiftAssignmentInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { assignCrewVolunteerToShift } = await import(
      "../server/crew-roster-shift.server"
    )
    return assignCrewVolunteerToShift(data)
  })

export const removeCrewVolunteerShiftAssignmentFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) => shiftAssignmentInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { removeCrewVolunteerShiftAssignment } = await import(
      "../server/crew-roster-shift.server"
    )
    return removeCrewVolunteerShiftAssignment(data)
  })
