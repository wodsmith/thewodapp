import { competitionCan } from "./capabilities"

export type PublicScheduleMode = "heats" | "submissionWindows" | "unavailable"

export function canUseHeatScheduling(competitionType: string): boolean {
  return competitionCan(competitionType, "heatScheduling")
}

export function canUseDayOfCheckIn(competitionType: string): boolean {
  return competitionCan(competitionType, "dayOfCheckIn")
}

export function getPublicScheduleMode(
  competitionType: string,
): PublicScheduleMode {
  if (competitionCan(competitionType, "submissionWindows")) {
    return "submissionWindows"
  }

  if (canUseHeatScheduling(competitionType)) {
    return "heats"
  }

  return "unavailable"
}

export function canRunDayOfCheckIn(
  competitionType: string,
  hasCheckInRole: boolean,
): boolean {
  return canUseDayOfCheckIn(competitionType) && hasCheckInRole
}
