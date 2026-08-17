import type { CompetitionType } from "@/db/schemas/competitions"

// @lat: [[competition-type-capabilities#Registry Source of Truth]]
export type CompetitionCapability =
  | "videoSubmissions"
  | "submissionWindows"
  | "optInResultPublishing"
  | "perpetual"
  | "heatScheduling"
  | "dayOfCheckIn"
  | "physicalVenue"
  | "volunteerScheduling"
  | "organizerEntersResults"
  | "benchmarkScoringTiers"
  | "cohosts"
  | "volunteerShifts"
  | "publicVolunteerSignup"

export type PublicCompetitionTabId =
  | "details"
  | "workouts"
  | "schedule"
  | "leaderboard"
  | "announcements"
  | "stats"

export type RegisteredCompetitionTypeId = CompetitionType
export type CompetitionTypeId = RegisteredCompetitionTypeId
export type LeaderboardVariant = "standard" | "online"
export type ResultsEntryMode = "organizer-entered" | "athlete-submitted"
export type ResultsNavLabel = "Results" | "Submissions"

export interface CompetitionTypeDef {
  id: RegisteredCompetitionTypeId
  label: string
  createPickerDescription: string
  capabilities: ReadonlySet<CompetitionCapability>
  leaderboardVariant: LeaderboardVariant
  selectableOnCreate: boolean
  publicTabs: readonly PublicCompetitionTabId[]
}

export interface CompetitionTypePickerOption {
  id: string
  label: string
  description: string
  displayLabel: string
}

const EMPTY_CAPABILITIES: ReadonlySet<CompetitionCapability> = new Set()

const DEFAULT_PUBLIC_TABS: readonly PublicCompetitionTabId[] = [
  "details",
  "workouts",
  "schedule",
  "leaderboard",
  "announcements",
]

export const COMPETITION_TYPE_REGISTRY = {
  "in-person": {
    id: "in-person",
    label: "In-Person",
    createPickerDescription: "Traditional venue-based competition",
    leaderboardVariant: "standard",
    selectableOnCreate: true,
    publicTabs: DEFAULT_PUBLIC_TABS,
    capabilities: new Set([
      "heatScheduling",
      "dayOfCheckIn",
      "physicalVenue",
      "volunteerScheduling",
      "organizerEntersResults",
      "cohosts",
      "volunteerShifts",
      "publicVolunteerSignup",
    ]),
  },
  online: {
    id: "online",
    label: "Online",
    createPickerDescription: "Virtual competition with video submissions",
    leaderboardVariant: "online",
    selectableOnCreate: true,
    publicTabs: DEFAULT_PUBLIC_TABS,
    capabilities: new Set([
      "videoSubmissions",
      "submissionWindows",
      "optInResultPublishing",
      "cohosts",
      "volunteerShifts",
      "publicVolunteerSignup",
    ]),
  },
  benchmark: {
    id: "benchmark",
    label: "Benchmark",
    createPickerDescription: "Perpetual benchmark board with video submissions",
    leaderboardVariant: "online",
    selectableOnCreate: true,
    publicTabs: [
      "details",
      "workouts",
      "leaderboard",
      "announcements",
      "stats",
    ],
    capabilities: new Set([
      "videoSubmissions",
      "perpetual",
      "benchmarkScoringTiers",
    ]),
  },
} as const satisfies Readonly<Record<CompetitionType, CompetitionTypeDef>>

export type SelectableCompetitionTypeId = {
  [Type in CompetitionTypeId]: (typeof COMPETITION_TYPE_REGISTRY)[Type]["selectableOnCreate"] extends true
    ? Type
    : never
}[CompetitionTypeId]

export function isCompetitionTypeValue(
  value: unknown,
): value is CompetitionTypeId {
  return (
    typeof value === "string" && Object.hasOwn(COMPETITION_TYPE_REGISTRY, value)
  )
}

export function competitionCan(
  type: string,
  capability: CompetitionCapability,
): boolean {
  const capabilities = isCompetitionTypeValue(type)
    ? COMPETITION_TYPE_REGISTRY[type].capabilities
    : EMPTY_CAPABILITIES
  return capabilities.has(capability)
}

export function publicCompetitionTabs(
  type: string,
): readonly PublicCompetitionTabId[] {
  return (
    COMPETITION_TYPE_REGISTRY[type as keyof typeof COMPETITION_TYPE_REGISTRY]
      ?.publicTabs ?? DEFAULT_PUBLIC_TABS
  )
}

export function leaderboardVariant(type: string): LeaderboardVariant {
  return isCompetitionTypeValue(type)
    ? COMPETITION_TYPE_REGISTRY[type].leaderboardVariant
    : "standard"
}

export function isSelectableType(
  type: string,
): type is SelectableCompetitionTypeId {
  return (
    isCompetitionTypeValue(type) &&
    COMPETITION_TYPE_REGISTRY[type].selectableOnCreate
  )
}

export function isSelectableCompetitionTypeValue(
  value: unknown,
): value is SelectableCompetitionTypeId {
  return typeof value === "string" && isSelectableType(value)
}

const COMPETITION_TYPE_OPTIONS: ReadonlyArray<CompetitionTypePickerOption> =
  Object.values(COMPETITION_TYPE_REGISTRY).map((definition) => ({
    id: definition.id,
    label: definition.label,
    description: definition.createPickerDescription,
    displayLabel: `${definition.label} - ${definition.createPickerDescription}`,
  }))
const SELECTABLE_COMPETITION_TYPE_OPTIONS = COMPETITION_TYPE_OPTIONS.filter(
  (option) => isSelectableType(option.id),
)

export function competitionTypeOptions(): ReadonlyArray<CompetitionTypePickerOption> {
  return COMPETITION_TYPE_OPTIONS
}

export function selectableCompetitionTypes(): CompetitionTypeDef[] {
  return Object.values(COMPETITION_TYPE_REGISTRY).filter((definition) =>
    isSelectableType(definition.id),
  )
}

export function selectableCompetitionTypeOptions(): ReadonlyArray<CompetitionTypePickerOption> {
  return SELECTABLE_COMPETITION_TYPE_OPTIONS
}

export function canOrganizerEnterResults(type: string): boolean {
  return competitionCan(type, "organizerEntersResults")
}

export function resultsEntryMode(type: string): ResultsEntryMode {
  return canOrganizerEnterResults(type)
    ? "organizer-entered"
    : "athlete-submitted"
}

export function resultsNavLabel(type: string): ResultsNavLabel {
  return canOrganizerEnterResults(type) ? "Results" : "Submissions"
}
