// @lat: [[crew#Volunteer Messaging Composer#Message templates]]
import {
  MESSAGE_TEMPLATE_TYPE,
  type MessageTemplateType,
} from "../../db/schemas/message-templates"

export { MESSAGE_TEMPLATE_TYPE }
export type { MessageTemplateType }

/**
 * Ordered list of the message template types an organizer can compose.
 */
export const MESSAGE_TEMPLATE_TYPES = [
  MESSAGE_TEMPLATE_TYPE.ASSIGNMENT_CONFIRMATION,
  MESSAGE_TEMPLATE_TYPE.REMINDER_48_HOUR,
  MESSAGE_TEMPLATE_TYPE.REMINDER_24_HOUR,
  MESSAGE_TEMPLATE_TYPE.CUSTOM_BROADCAST,
] as const satisfies readonly MessageTemplateType[]

/**
 * The full set of substitution variable keys a template body/subject may use.
 * `roleName` maps to the human-readable volunteer role label.
 */
export const CREW_TEMPLATE_VARIABLE_KEYS = [
  "volunteerName",
  "eventName",
  "shiftName",
  "roleName",
  "shiftDate",
  "shiftTime",
  "location",
  "confirmUrl",
  "scheduleUrl",
] as const

export type CrewTemplateVariableKey =
  (typeof CREW_TEMPLATE_VARIABLE_KEYS)[number]

export interface CrewTemplateVariableDefinition {
  key: CrewTemplateVariableKey
  token: string
  label: string
  description: string
}

export const CREW_TEMPLATE_VARIABLES: readonly CrewTemplateVariableDefinition[] =
  [
    {
      key: "volunteerName",
      token: "{{volunteerName}}",
      label: "Volunteer name",
      description: "The recipient's name",
    },
    {
      key: "eventName",
      token: "{{eventName}}",
      label: "Event name",
      description: "The competition / event name",
    },
    {
      key: "shiftName",
      token: "{{shiftName}}",
      label: "Shift name",
      description: "The assigned shift's name",
    },
    {
      key: "roleName",
      token: "{{roleName}}",
      label: "Role",
      description: "The volunteer's role for the shift",
    },
    {
      key: "shiftDate",
      token: "{{shiftDate}}",
      label: "Shift date",
      description: "The shift's date",
    },
    {
      key: "shiftTime",
      token: "{{shiftTime}}",
      label: "Shift time",
      description: "The shift's start and end time",
    },
    {
      key: "location",
      token: "{{location}}",
      label: "Location",
      description: "The shift's location",
    },
    {
      key: "confirmUrl",
      token: "{{confirmUrl}}",
      label: "Confirm link",
      description: "The volunteer's private confirm/respond link",
    },
    {
      key: "scheduleUrl",
      token: "{{scheduleUrl}}",
      label: "Schedule link",
      description: "The volunteer's schedule link",
    },
  ] as const

/**
 * Which variables are meaningful for each template type. Custom broadcasts have
 * no shift context and no per-assignment confirm link, so they are limited to
 * volunteer/event/schedule variables.
 */
const TEMPLATE_VARIABLE_KEYS_BY_TYPE: Record<
  MessageTemplateType,
  readonly CrewTemplateVariableKey[]
> = {
  [MESSAGE_TEMPLATE_TYPE.ASSIGNMENT_CONFIRMATION]: CREW_TEMPLATE_VARIABLE_KEYS,
  [MESSAGE_TEMPLATE_TYPE.REMINDER_48_HOUR]: CREW_TEMPLATE_VARIABLE_KEYS,
  [MESSAGE_TEMPLATE_TYPE.REMINDER_24_HOUR]: CREW_TEMPLATE_VARIABLE_KEYS,
  [MESSAGE_TEMPLATE_TYPE.CUSTOM_BROADCAST]: [
    "volunteerName",
    "eventName",
    "scheduleUrl",
  ],
}

export function getCompetitionMessageTemplateVariables(
  type: MessageTemplateType,
): CrewTemplateVariableDefinition[] {
  const allowed = new Set(TEMPLATE_VARIABLE_KEYS_BY_TYPE[type])
  return CREW_TEMPLATE_VARIABLES.filter((variable) => allowed.has(variable.key))
}

export interface MessageTemplateContent {
  subject: string
  body: string
}

const DEFAULT_TEMPLATES: Record<MessageTemplateType, MessageTemplateContent> = {
  [MESSAGE_TEMPLATE_TYPE.ASSIGNMENT_CONFIRMATION]: {
    subject: "{{eventName}}: confirm {{shiftName}}",
    body: [
      "Hi {{volunteerName}},",
      "You are assigned to help with {{eventName}}. Please confirm that this shift still works for you, or request a change if something needs attention.",
      "Shift: {{shiftName}}\nRole: {{roleName}}\nTime: {{shiftDate}} {{shiftTime}}\nLocation: {{location}}",
      "You can also view your schedule at {{scheduleUrl}}.",
    ].join("\n\n"),
  },
  [MESSAGE_TEMPLATE_TYPE.REMINDER_48_HOUR]: {
    subject: "{{eventName}}: reminder for {{shiftName}}",
    body: [
      "Hi {{volunteerName}},",
      "{{eventName}} is coming up, and we still need your response for this assignment. Please confirm, decline, or request a change.",
      "Shift: {{shiftName}}\nRole: {{roleName}}\nTime: {{shiftDate}} {{shiftTime}}\nLocation: {{location}}",
      "Your private schedule link is {{scheduleUrl}}.",
    ].join("\n\n"),
  },
  [MESSAGE_TEMPLATE_TYPE.REMINDER_24_HOUR]: {
    subject: "{{eventName}}: reminder for {{shiftName}}",
    body: [
      "Hi {{volunteerName}},",
      "Your {{eventName}} crew shift is within 24 hours and still needs a response. Please let the organizer know whether you can make it.",
      "Shift: {{shiftName}}\nRole: {{roleName}}\nTime: {{shiftDate}} {{shiftTime}}\nLocation: {{location}}",
      "You can also review your private schedule from {{scheduleUrl}}.",
    ].join("\n\n"),
  },
  [MESSAGE_TEMPLATE_TYPE.CUSTOM_BROADCAST]: {
    subject: "{{eventName}} update",
    body: [
      "Hi {{volunteerName}},",
      "Share your update with the crew here.",
      "You can view your schedule anytime at {{scheduleUrl}}.",
    ].join("\n\n"),
  },
}

/**
 * The default (uncustomized) copy for a template type. The returned object is a
 * fresh copy so callers can't mutate the shared defaults.
 */
export function getDefaultCompetitionMessageTemplate(
  type: MessageTemplateType,
): MessageTemplateContent {
  const template = DEFAULT_TEMPLATES[type]
  return { subject: template.subject, body: template.body }
}

export interface RenderCompetitionMessageTemplateInput {
  subject: string
  body: string
  variables: Partial<Record<CrewTemplateVariableKey, string>>
}

export interface RenderedCompetitionMessageTemplate {
  subject: string
  paragraphs: string[]
}

const TEMPLATE_TOKEN_PATTERN = /\{\{\s*(\w+)\s*\}\}/g

/**
 * Substitute `{{variable}}` tokens with their values. Unknown variables (no
 * matching key in `variables`) are left literal. Empty-string values are
 * treated as absent and left literal so an unset optional (e.g. a missing
 * location) doesn't collapse into a blank.
 */
function substituteTemplateTokens(
  input: string,
  variables: Partial<Record<CrewTemplateVariableKey, string>>,
): string {
  return input.replace(TEMPLATE_TOKEN_PATTERN, (match, key: string) => {
    // Tokens are free text: an unknown key isn't in the union, so index with a
    // cast and let the missing-value branch leave it literal.
    const value = variables[key as CrewTemplateVariableKey]
    return value == null || value === "" ? match : value
  })
}

/**
 * Render a template into a subject line plus paragraph list. The body is split
 * into paragraphs on blank lines; substitution runs on the subject and body.
 */
export function renderCompetitionMessageTemplate(
  input: RenderCompetitionMessageTemplateInput,
): RenderedCompetitionMessageTemplate {
  const subject = substituteTemplateTokens(input.subject, input.variables)
  const substitutedBody = substituteTemplateTokens(input.body, input.variables)
  const paragraphs = substitutedBody
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
  return { subject, paragraphs }
}
