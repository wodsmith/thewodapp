import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
  index,
  int,
  json,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import {
  commonColumns,
  createCrewBillingEventId,
} from "./common"
import { competitionsTable } from "./competitions"
import {
  type CrewBillingSource,
  type CrewBillingState,
  crewEventSettingsTable,
} from "./crew-event-settings"
import { teamTable } from "./teams"
import { userTable } from "./users"

export const CREW_BILLING_EVENT_TYPE = {
  MANUAL_SALE_RECORDED: "manual_sale_recorded",
  PAYMENT_LINK_RECONCILED: "payment_link_reconciled",
  CHECKOUT_COMPLETED: "checkout_completed",
  FOUNDER_OVERRIDE_APPLIED: "founder_override_applied",
  CREDIT_SET: "credit_set",
  CREDIT_APPLIED: "credit_applied",
  REFUND_RECORDED: "refund_recorded",
  EVENT_COMPED: "event_comped",
} as const

export type CrewBillingEventType =
  (typeof CREW_BILLING_EVENT_TYPE)[keyof typeof CREW_BILLING_EVENT_TYPE]

export type CrewBillingPrivateMetadata = Record<string, unknown>

export const crewBillingEventsTable = mysqlTable(
  "crew_billing_events",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCrewBillingEventId())
      .notNull(),
    competitionId: varchar({ length: 255 }).notNull(),
    teamId: varchar({ length: 255 }).notNull(),
    eventType: varchar({ length: 50 }).$type<CrewBillingEventType>().notNull(),
    billingState: varchar({ length: 30 }).$type<CrewBillingState>().notNull(),
    billingSource: varchar({ length: 40 }).$type<CrewBillingSource>().notNull(),
    planId: varchar({ length: 255 }),
    amountCents: int().default(0).notNull(),
    currency: varchar({ length: 3 }).default("usd").notNull(),
    creditCents: int().default(0).notNull(),
    refundedCents: int().default(0).notNull(),
    stripePaymentLinkId: varchar({ length: 255 }),
    stripeCheckoutSessionId: varchar({ length: 255 }),
    stripePaymentIntentId: varchar({ length: 255 }),
    idempotencyKey: varchar({ length: 255 }),
    actorUserId: varchar({ length: 255 }),
    actorLabel: varchar({ length: 255 }),
    publicNote: text(),
    privateMetadata: json().$type<CrewBillingPrivateMetadata>(),
  },
  (table) => [
    index("crew_billing_events_competition_idx").on(table.competitionId),
    index("crew_billing_events_team_idx").on(table.teamId),
    index("crew_billing_events_type_idx").on(table.eventType),
    index("crew_billing_events_state_idx").on(table.billingState),
    index("crew_billing_events_source_idx").on(table.billingSource),
    index("crew_billing_events_plan_idx").on(table.planId),
    index("crew_billing_events_payment_link_idx").on(table.stripePaymentLinkId),
    index("crew_billing_events_checkout_session_idx").on(
      table.stripeCheckoutSessionId,
    ),
    index("crew_billing_events_payment_intent_idx").on(
      table.stripePaymentIntentId,
    ),
    index("crew_billing_events_actor_idx").on(table.actorUserId),
    uniqueIndex("crew_billing_events_idempotency_unique_idx").on(
      table.competitionId,
      table.eventType,
      table.idempotencyKey,
    ),
  ],
)

export const crewBillingEventsRelations = relations(
  crewBillingEventsTable,
  ({ one }) => ({
    competition: one(competitionsTable, {
      fields: [crewBillingEventsTable.competitionId],
      references: [competitionsTable.id],
    }),
    settings: one(crewEventSettingsTable, {
      fields: [crewBillingEventsTable.competitionId],
      references: [crewEventSettingsTable.competitionId],
    }),
    team: one(teamTable, {
      fields: [crewBillingEventsTable.teamId],
      references: [teamTable.id],
    }),
    actor: one(userTable, {
      fields: [crewBillingEventsTable.actorUserId],
      references: [userTable.id],
    }),
  }),
)

export type CrewBillingEvent = InferSelectModel<typeof crewBillingEventsTable>
export type NewCrewBillingEvent = typeof crewBillingEventsTable.$inferInsert
