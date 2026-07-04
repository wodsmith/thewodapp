// @lat: [[competition-type-capabilities#Perpetual End Dates]]
import { isDeadlinePassed, isSameDateString } from "@/utils/date-utils"
import { competitionCan } from "./capabilities"

interface CompetitionDates {
  competitionType: string
  startDate: string
  endDate: string
}

/**
 * Perpetual (benchmark) competitions treat endDate === startDate as
 * "no end date set" — the board runs forever. The endDate column is
 * NOT NULL, so this sentinel is how "open-ended" is stored.
 */
export function isOpenEnded(competition: CompetitionDates): boolean {
  return (
    competitionCan(competition.competitionType, "perpetual") &&
    isSameDateString(competition.startDate, competition.endDate)
  )
}

/**
 * True when a perpetual competition has an explicit end date that has
 * passed. Submissions close; the leaderboard stays visible forever.
 */
export function perpetualSubmissionsClosed(
  competition: CompetitionDates,
): boolean {
  if (!competitionCan(competition.competitionType, "perpetual")) return false
  if (isOpenEnded(competition)) return false
  return isDeadlinePassed(competition.endDate)
}
