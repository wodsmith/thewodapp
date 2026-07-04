// @lat: [[crew#Volunteer Messaging Composer]]
// @lat: [[crew#Server Function Runtime Boundary]]
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { MESSAGE_TEMPLATE_TYPE } from "../db/schemas/message-templates"
import type {
  CrewMessageComposerData,
  CrewMessageHistoryItem,
  CrewMessageMode,
  PreviewCrewMessageRecipientsResult,
  QueueCrewMessagesResult,
} from "../server/crew-messages.server"

export type {
  CrewMessageFilters,
  CrewMessageRecipientSkipReason,
  CrewMessageRecipientSkipSummary,
  CrewMessageRecipientState,
} from "../lib/crew/message-recipients"
export type {
  CrewMessageComposerData,
  CrewMessageComposerEvent,
  CrewMessageComposerTemplate,
  CrewMessageFilterOptions,
  CrewMessageHistoryItem,
  CrewMessageHistoryKind,
  CrewMessageMode,
  CrewMessageRecipient,
  MessageTemplateType,
  PreviewCrewMessageRecipientsResult,
  QueueCrewMessagesResult,
} from "../server/crew-messages.server"

/** Alias for the History tab list item. */
export type CrewMessageHistoryEntry = CrewMessageHistoryItem
/** Alias for the recipient preview / send mode. */
export type CrewMessagePreviewMode = CrewMessageMode

const RECIPIENT_STATES = [
  "not_ready",
  "pending",
  "sent",
  "confirmed",
  "checked_in",
  "declined",
  "change_requested",
  "no_show",
  "replaced",
] as const

const MESSAGE_MODES = [
  "assignment_confirmation",
  "reminder",
  "custom_broadcast",
] as const

const templateTypeSchema = z.enum([
  MESSAGE_TEMPLATE_TYPE.ASSIGNMENT_CONFIRMATION,
  MESSAGE_TEMPLATE_TYPE.REMINDER_48_HOUR,
  MESSAGE_TEMPLATE_TYPE.REMINDER_24_HOUR,
  MESSAGE_TEMPLATE_TYPE.CUSTOM_BROADCAST,
])

const templateContentSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required").max(255),
  body: z.string().trim().min(1, "Body is required").max(20000),
})

const eventInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
})

const saveTemplateInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  templateType: templateTypeSchema,
  subject: z.string().trim().min(1, "Subject is required").max(255),
  body: z.string().trim().min(1, "Body is required").max(20000),
})

const resetTemplateInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  templateType: templateTypeSchema,
})

const messageFiltersSchema = z.object({
  states: z.array(z.enum(RECIPIENT_STATES)).optional(),
  roles: z.array(z.string()).optional(),
  shiftIds: z.array(z.string()).optional(),
  includeAlreadySent: z.boolean().optional(),
  search: z.string().trim().max(255).optional(),
})

const previewRecipientsInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  mode: z.enum(MESSAGE_MODES),
  filters: messageFiltersSchema.default({}),
})

const queueMessagesInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  mode: z.enum(MESSAGE_MODES),
  recipientKeys: z.array(z.string()).min(1, "Select at least one recipient"),
  template: templateContentSchema,
})

export const getCrewMessageComposerFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => eventInputSchema.parse(data))
  .handler(async ({ data }): Promise<CrewMessageComposerData> => {
    const { getCrewMessageComposer } = await import(
      "../server/crew-messages.server"
    )
    return getCrewMessageComposer(data)
  })

export const saveCompetitionMessageTemplateFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) => saveTemplateInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { saveCompetitionMessageTemplate } = await import(
      "../server/crew-messages.server"
    )
    return saveCompetitionMessageTemplate(data)
  })

export const resetCompetitionMessageTemplateFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) => resetTemplateInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { resetCompetitionMessageTemplate } = await import(
      "../server/crew-messages.server"
    )
    return resetCompetitionMessageTemplate(data)
  })

export const previewCrewMessageRecipientsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => previewRecipientsInputSchema.parse(data))
  .handler(async ({ data }): Promise<PreviewCrewMessageRecipientsResult> => {
    const { previewCrewMessageRecipients } = await import(
      "../server/crew-messages.server"
    )
    return previewCrewMessageRecipients(data)
  })

export const queueCrewMessagesFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => queueMessagesInputSchema.parse(data))
  .handler(async ({ data }): Promise<QueueCrewMessagesResult> => {
    const { queueCrewMessages } = await import("../server/crew-messages.server")
    return queueCrewMessages(data)
  })
