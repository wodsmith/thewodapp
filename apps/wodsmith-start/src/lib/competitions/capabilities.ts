// @lat: [[competition-type-capabilities#Registry Source of Truth]]
export type CompetitionCapability =
  | "videoSubmissions"
  | "submissionWindows"
  | "optInResultPublishing"
  | "heatScheduling"
  | "dayOfCheckIn"
  | "physicalVenue"
  | "volunteerScheduling"
  | "organizerEntersResults"

export type LeaderboardVariant = "standard" | "online"

export interface CompetitionTypeDef {
  id: string
  label: string
  capabilities: ReadonlySet<CompetitionCapability>
  leaderboardVariant: LeaderboardVariant
  selectableOnCreate: boolean
}

const EMPTY_CAPABILITIES: ReadonlySet<CompetitionCapability> = new Set()

export const COMPETITION_TYPE_REGISTRY: Readonly<
  Record<"in-person" | "online", CompetitionTypeDef>
> = {
  "in-person": {
    id: "in-person",
    label: "In-Person",
    leaderboardVariant: "standard",
    selectableOnCreate: true,
    capabilities: new Set([
      "heatScheduling",
      "dayOfCheckIn",
      "physicalVenue",
      "volunteerScheduling",
      "organizerEntersResults",
    ]),
  },
  online: {
    id: "online",
    label: "Online",
    leaderboardVariant: "online",
    selectableOnCreate: true,
    capabilities: new Set([
      "videoSubmissions",
      "submissionWindows",
      "optInResultPublishing",
    ]),
  },
}

export function competitionCan(
  type: string,
  capability: CompetitionCapability,
): boolean {
  return (
    COMPETITION_TYPE_REGISTRY[type as keyof typeof COMPETITION_TYPE_REGISTRY]
      ?.capabilities ?? EMPTY_CAPABILITIES
  ).has(capability)
}

export function leaderboardVariant(type: string): LeaderboardVariant {
  return (
    COMPETITION_TYPE_REGISTRY[type as keyof typeof COMPETITION_TYPE_REGISTRY]
      ?.leaderboardVariant ?? "standard"
  )
}

export function isSelectableType(type: string): boolean {
  return (
    COMPETITION_TYPE_REGISTRY[type as keyof typeof COMPETITION_TYPE_REGISTRY]
      ?.selectableOnCreate ?? false
  )
}
