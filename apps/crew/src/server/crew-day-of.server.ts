// @lat: [[crew#Day Of Operations Board]]
import {
  buildCrewDayOfOperationsBoard,
  type CrewDayOfOperationsBoard,
} from "../lib/crew/day-of-operations"
import {
  getCrewStaffingReportPage,
  type CrewStaffingReportEvent,
  type CrewStaffingReportPageData,
} from "../server-fns/crew-staffing-fns.server"

export interface CrewDayOfOperationsPageData {
  event: CrewStaffingReportEvent
  board: CrewDayOfOperationsBoard
  sources: CrewStaffingReportPageData["sources"]
}

export async function getCrewDayOfOperationsPage(data: {
  eventId: string
}): Promise<CrewDayOfOperationsPageData> {
  const staffing = await getCrewStaffingReportPage(data.eventId)
  const now = new Date()

  return {
    event: staffing.event,
    board: buildCrewDayOfOperationsBoard({
      matrix: staffing.matrix,
      report: staffing.report,
      now,
    }),
    sources: staffing.sources,
  }
}
