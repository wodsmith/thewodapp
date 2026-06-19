import { competitionCan } from "./capabilities"

export type VolunteerDashboardTab =
  | "roster"
  | "shifts"
  | "schedule"
  | "registration-rules"

export function canDisplayPhysicalVenue(competitionType: string): boolean {
  return competitionCan(competitionType, "physicalVenue")
}

export function canUseVolunteerScheduling(competitionType: string): boolean {
  return competitionCan(competitionType, "volunteerScheduling")
}

export function getVolunteerEffectiveTab(
  competitionType: string,
  tab: VolunteerDashboardTab,
): VolunteerDashboardTab {
  if (tab === "schedule" && !canUseVolunteerScheduling(competitionType)) {
    return "roster"
  }

  return tab
}
