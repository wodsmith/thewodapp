// @lat: [[crew#Server Function Runtime Boundary]]
// @lat: [[crew#Manual Paid And Founder Grants]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { CREW_BILLING_EVENT_TYPE } from "../db/schemas/crew-billing-events"
import {
  MANUAL_CREW_BILLING_ACTION,
  crewBillingPlanIds,
  type ManualCrewBillingActionType,
} from "../lib/crew/billing-state"

export type { CrewBillingPageData } from "../server/crew-billing.server"

const getCrewBillingInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
})

const crewBillingEventTypeSchema = z.enum([
  CREW_BILLING_EVENT_TYPE.MANUAL_SALE_RECORDED,
  CREW_BILLING_EVENT_TYPE.PAYMENT_LINK_RECONCILED,
  CREW_BILLING_EVENT_TYPE.CHECKOUT_COMPLETED,
  CREW_BILLING_EVENT_TYPE.FOUNDER_OVERRIDE_APPLIED,
  CREW_BILLING_EVENT_TYPE.CREDIT_SET,
  CREW_BILLING_EVENT_TYPE.CREDIT_APPLIED,
  CREW_BILLING_EVENT_TYPE.REFUND_RECORDED,
  CREW_BILLING_EVENT_TYPE.EVENT_COMPED,
])

const crewBillingPlanIdSchema = z.enum(crewBillingPlanIds)
const nullableTextSchema = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional()
const privateMetadataSchema = z.record(z.string(), z.unknown()).nullable()

const recordCrewBillingEventInputSchema = getCrewBillingInputSchema.extend({
  eventType: crewBillingEventTypeSchema,
  planId: crewBillingPlanIdSchema.nullable().optional(),
  amountCents: z.number().int().min(0).nullable().optional(),
  currency: nullableTextSchema,
  creditCents: z.number().int().min(0).nullable().optional(),
  refundedCents: z.number().int().min(0).nullable().optional(),
  stripePaymentLinkId: nullableTextSchema,
  stripeCheckoutSessionId: nullableTextSchema,
  stripePaymentIntentId: nullableTextSchema,
  idempotencyKey: nullableTextSchema,
  actorUserId: nullableTextSchema,
  actorLabel: nullableTextSchema,
  publicNote: nullableTextSchema,
  privateMetadata: privateMetadataSchema.optional(),
})

const optionalManualCrewBillingAmountSchema = z
  .number()
  .int()
  .min(0)
  .nullable()
  .optional()

const recordManualCrewBillingActionBaseInputSchema =
  getCrewBillingInputSchema.extend({
    currency: nullableTextSchema,
    fullPlatformCreditCents: optionalManualCrewBillingAmountSchema,
    privateFounderPriceCents: optionalManualCrewBillingAmountSchema,
    refundedCents: optionalManualCrewBillingAmountSchema,
    stripePaymentIntentId: nullableTextSchema,
    idempotencyKey: nullableTextSchema,
    actorUserId: nullableTextSchema,
    actorLabel: nullableTextSchema,
    publicNote: nullableTextSchema,
    privateMetadata: privateMetadataSchema.optional(),
  })

const optionalManualCrewBillingActionInputSchema = (
  action: Exclude<
    ManualCrewBillingActionType,
    typeof MANUAL_CREW_BILLING_ACTION.RECORD_MANUAL_PAID
  >,
) =>
  recordManualCrewBillingActionBaseInputSchema.extend({
    action: z.literal(action),
    planId: crewBillingPlanIdSchema.nullable().optional(),
    amountCents: optionalManualCrewBillingAmountSchema,
  })

const recordManualCrewBillingActionInputSchema = z.discriminatedUnion(
  "action",
  [
    recordManualCrewBillingActionBaseInputSchema.extend({
      action: z.literal(MANUAL_CREW_BILLING_ACTION.RECORD_MANUAL_PAID),
      planId: crewBillingPlanIdSchema,
      amountCents: z
        .number()
        .int()
        .positive("Manual paid Crew billing requires a positive amount."),
    }),
    optionalManualCrewBillingActionInputSchema(
      MANUAL_CREW_BILLING_ACTION.APPLY_FOUNDER_GRANT,
    ),
    optionalManualCrewBillingActionInputSchema(
      MANUAL_CREW_BILLING_ACTION.SET_FULL_PLATFORM_CREDIT,
    ),
    optionalManualCrewBillingActionInputSchema(
      MANUAL_CREW_BILLING_ACTION.APPLY_FULL_PLATFORM_CREDIT,
    ),
    optionalManualCrewBillingActionInputSchema(
      MANUAL_CREW_BILLING_ACTION.COMP_EVENT,
    ),
    optionalManualCrewBillingActionInputSchema(
      MANUAL_CREW_BILLING_ACTION.RECORD_REFUND,
    ),
  ],
)

export const getCrewBillingPageFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getCrewBillingInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { getCrewBillingPage } = await import("../server/crew-billing.server")
    return getCrewBillingPage(data)
  })

export const recordCrewBillingEventFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    recordCrewBillingEventInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { recordCrewBillingEvent } = await import(
      "../server/crew-billing.server"
    )
    return recordCrewBillingEvent(data)
  })

export const recordManualCrewBillingActionFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    recordManualCrewBillingActionInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const { recordManualCrewBillingAction } = await import(
      "../server/crew-billing.server"
    )
    return recordManualCrewBillingAction(data)
  })
