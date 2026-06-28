export type CrewSetupChecklistKey =
  | "eventBasicsConfirmed"
  | "sourceAccessConfirmed"
  | "volunteerNeedsDrafted"
  | "staffingPlanDrafted"
  | "operatorHandoffReady"

export interface CrewSetupState {
  desiredGoLiveDate: string
  sourceContactName: string
  sourceContactEmail: string
  volunteerTarget: string
  staffingLead: string
  checklist: Record<CrewSetupChecklistKey, boolean>
  internalNotes: string
  assumptions: string
}

export interface CrewOrganizerSetupState {
  volunteerTarget: string
  staffingLead: string
  assumptions: string
  checklist: Record<CrewSetupChecklistKey, boolean>
}

export interface ParsedCrewSettings {
  setup: CrewSetupState
  baseSettings: Record<string, unknown>
  parseError: string | null
}

export const organizerCrewSetupFieldKeys = [
  "volunteerTarget",
  "staffingLead",
  "assumptions",
] as const satisfies readonly (keyof CrewOrganizerSetupState)[]

export const adminOnlyCrewSetupFieldKeys = [
  "desiredGoLiveDate",
  "sourceContactName",
  "sourceContactEmail",
  "internalNotes",
] as const satisfies readonly (keyof CrewSetupState)[]

export const crewSetupChecklistItems: Array<{
  key: CrewSetupChecklistKey
  label: string
}> = [
  {
    key: "eventBasicsConfirmed",
    label: "Event name, dates, and timezone confirmed",
  },
  { key: "sourceAccessConfirmed", label: "Volunteer signup link added" },
  {
    key: "volunteerNeedsDrafted",
    label: "Volunteer roles and targets drafted",
  },
  {
    key: "staffingPlanDrafted",
    label: "Floors, lanes, and staffing assumptions ready",
  },
  {
    key: "operatorHandoffReady",
    label: "Ready to import volunteers and heat schedule",
  },
]

const defaultChecklist = {} as Record<CrewSetupChecklistKey, boolean>
for (const item of crewSetupChecklistItems) {
  defaultChecklist[item.key] = false
}

export function createDefaultCrewSetupState(): CrewSetupState {
  return {
    desiredGoLiveDate: "",
    sourceContactName: "",
    sourceContactEmail: "",
    volunteerTarget: "",
    staffingLead: "",
    checklist: { ...defaultChecklist },
    internalNotes: "",
    assumptions: "",
  }
}

export function createDefaultCrewOrganizerSetupState(): CrewOrganizerSetupState {
  return toOrganizerCrewSetupState(createDefaultCrewSetupState())
}

export function toOrganizerCrewSetupState(
  setup: CrewSetupState,
): CrewOrganizerSetupState {
  return {
    volunteerTarget: setup.volunteerTarget,
    staffingLead: setup.staffingLead,
    assumptions: setup.assumptions,
    checklist: { ...setup.checklist },
  }
}

export function mergeOrganizerCrewSetupState(
  current: CrewSetupState,
  organizer: CrewOrganizerSetupState,
): CrewSetupState {
  return {
    ...current,
    volunteerTarget: organizer.volunteerTarget,
    staffingLead: organizer.staffingLead,
    assumptions: organizer.assumptions,
    checklist: {
      ...current.checklist,
      ...organizer.checklist,
    },
  }
}

export function parseCrewSettings(
  settingsText: string | null,
): ParsedCrewSettings {
  const setup = createDefaultCrewSetupState()

  if (!settingsText?.trim()) {
    return { setup, baseSettings: {}, parseError: null }
  }

  try {
    const parsed = JSON.parse(settingsText) as unknown
    if (!isPlainObject(parsed)) {
      return {
        setup,
        baseSettings: { legacySettings: parsed },
        parseError: null,
      }
    }

    const parsedSetup = isPlainObject(parsed.setup) ? parsed.setup : {}

    return {
      setup: {
        desiredGoLiveDate: readText(parsedSetup.desiredGoLiveDate),
        sourceContactName: readText(parsedSetup.sourceContactName),
        sourceContactEmail: readText(parsedSetup.sourceContactEmail),
        volunteerTarget: readText(parsedSetup.volunteerTarget),
        staffingLead: readText(parsedSetup.staffingLead),
        checklist: readChecklist(parsedSetup.checklist),
        internalNotes: readText(parsedSetup.internalNotes),
        assumptions: readSetupAssumptions(parsedSetup, parsed),
      },
      baseSettings: parsed,
      parseError: null,
    }
  } catch (error) {
    return {
      setup,
      baseSettings: { legacySettingsText: settingsText },
      parseError:
        error instanceof Error
          ? error.message
          : "Could not parse settings JSON",
    }
  }
}

export function serializeCrewSettings(
  settingsText: string | null,
  setup: CrewSetupState,
) {
  const parsed = parseCrewSettings(settingsText)

  return JSON.stringify(
    {
      ...parsed.baseSettings,
      setup,
    },
    null,
    2,
  )
}

export function calculateSetupProgress(setup: CrewSetupState) {
  const completed = crewSetupChecklistItems.filter(
    (item) => setup.checklist[item.key],
  ).length

  return {
    completed,
    total: crewSetupChecklistItems.length,
    percent: Math.round((completed / crewSetupChecklistItems.length) * 100),
  }
}

function readChecklist(value: unknown): Record<CrewSetupChecklistKey, boolean> {
  if (!isPlainObject(value)) return { ...defaultChecklist }

  const checklist = {} as Record<CrewSetupChecklistKey, boolean>
  for (const item of crewSetupChecklistItems) {
    checklist[item.key] = value[item.key] === true
  }

  return checklist
}

function readRootAssumptions(settings: Record<string, unknown>) {
  if (typeof settings.assumptions === "string") return settings.assumptions

  if (Array.isArray(settings.assumptions)) {
    return settings.assumptions
      .filter(
        (assumption): assumption is string => typeof assumption === "string",
      )
      .join("\n")
  }

  return ""
}

function readSetupAssumptions(
  setup: Record<string, unknown>,
  rootSettings: Record<string, unknown>,
) {
  if (Object.hasOwn(setup, "assumptions")) {
    return readText(setup.assumptions)
  }

  return readRootAssumptions(rootSettings)
}

function readText(value: unknown) {
  return typeof value === "string" ? value : ""
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
