import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import { commonColumns, createMessageTemplateId } from "./common"
import { competitionsTable } from "./competitions"

/**
 * Message template types an organizer can compose and send to competition
 * volunteers. The reminder + confirmation types seed their default copy from
 * app-defined defaults; `custom_broadcast` is a free-form message.
 */
export const MESSAGE_TEMPLATE_TYPE = {
  ASSIGNMENT_CONFIRMATION: "assignment_confirmation",
  REMINDER_48_HOUR: "reminder_48_hour",
  REMINDER_24_HOUR: "reminder_24_hour",
  CUSTOM_BROADCAST: "custom_broadcast",
} as const

export type MessageTemplateType =
  (typeof MESSAGE_TEMPLATE_TYPE)[keyof typeof MESSAGE_TEMPLATE_TYPE]

/**
 * Per-competition overrides of the default message copy, shared by Start and
 * Crew. A row exists only when an organizer has customized a template; the
 * absence of a row means the default copy is used. Body is plain text with
 * `{{variable}}` placeholders and paragraphs split on blank lines.
 */
export const competitionMessageTemplatesTable = mysqlTable(
  "competition_message_templates",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createMessageTemplateId())
      .notNull(),
    competitionId: varchar({ length: 255 }).notNull(),
    templateType: varchar({ length: 64 })
      .$type<MessageTemplateType>()
      .notNull(),
    subject: varchar({ length: 255 }).notNull(),
    body: text().notNull(),
  },
  (table) => [
    uniqueIndex("competition_message_templates_competition_type_unique_idx").on(
      table.competitionId,
      table.templateType,
    ),
  ],
)

export const competitionMessageTemplatesRelations = relations(
  competitionMessageTemplatesTable,
  ({ one }) => ({
    competition: one(competitionsTable, {
      fields: [competitionMessageTemplatesTable.competitionId],
      references: [competitionsTable.id],
    }),
  }),
)

export type CompetitionMessageTemplate = InferSelectModel<
  typeof competitionMessageTemplatesTable
>
export type NewCompetitionMessageTemplate =
  typeof competitionMessageTemplatesTable.$inferInsert
