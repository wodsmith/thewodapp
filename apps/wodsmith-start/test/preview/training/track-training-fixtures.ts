export * from "./fixtures"
import { providerDays } from "./track-fixtures"
export async function getTrainingWeekFn({
  data,
}: {
  data: { startDate: string }
}) {
  const end = new Date(`${data.startDate}T12:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 6)
  return {
    sessions: [],
    myResults: [],
    teamResults: [],
    providerDays: providerDays.filter(
      (day) =>
        day.date >= data.startDate &&
        day.date <= end.toISOString().slice(0, 10),
    ),
  }
}
