// @lat: [[crew#Department Leads]]
// @lat: [[crew#Server Function Runtime Boundary]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { CREW_DEPARTMENT_LEAD_STATUS } from "@/db/schemas/crew-self-serve-presets"
import { VOLUNTEER_ROLE_TYPE_VALUES } from "@/db/schemas/volunteers"

export type {
  CrewDepartmentLeadListItem,
  CrewDepartmentLeadsPageData,
} from "../server/crew-department-lead.server"

const eventIdSchema = z.string().min(1, "Event ID is required")
const leadIdSchema = z.string().startsWith("cdlead_", "Invalid lead ID")
const nullableTextInput = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional()
const dateTimeInput = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional()

const departmentLeadInputSchema = z
  .object({
    eventId: eventIdSchema,
    email: nullableTextInput,
    name: nullableTextInput,
    membershipId: nullableTextInput,
    roleType: z.enum(VOLUNTEER_ROLE_TYPE_VALUES),
    floor: nullableTextInput,
    startsAt: dateTimeInput,
    endsAt: dateTimeInput,
    status: z
      .enum([
        CREW_DEPARTMENT_LEAD_STATUS.INVITED,
        CREW_DEPARTMENT_LEAD_STATUS.ACTIVE,
        CREW_DEPARTMENT_LEAD_STATUS.REVOKED,
      ])
      .optional(),
    notes: nullableTextInput,
  })
  .superRefine((data, ctx) => {
    if (!data.email && !data.membershipId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Add an email or choose a volunteer.",
      })
    }
  })

const updateDepartmentLeadInputSchema = departmentLeadInputSchema.extend({
  leadId: leadIdSchema,
})

const revokeDepartmentLeadInputSchema = z.object({
  eventId: eventIdSchema,
  leadId: leadIdSchema,
})

export const getCrewDepartmentLeadsPageFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ eventId: eventIdSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const { getCrewDepartmentLeadsPage } = await import(
      "../server/crew-department-lead.server"
    )
    return getCrewDepartmentLeadsPage(data)
  })

export const createCrewDepartmentLeadFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => departmentLeadInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { createCrewDepartmentLead } = await import(
      "../server/crew-department-lead.server"
    )
    return createCrewDepartmentLead(data)
  })

export const updateCrewDepartmentLeadFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    updateDepartmentLeadInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { updateCrewDepartmentLead } = await import(
      "../server/crew-department-lead.server"
    )
    return updateCrewDepartmentLead(data)
  })

export const revokeCrewDepartmentLeadFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    revokeDepartmentLeadInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { revokeCrewDepartmentLead } = await import(
      "../server/crew-department-lead.server"
    )
    return revokeCrewDepartmentLead(data)
  })
