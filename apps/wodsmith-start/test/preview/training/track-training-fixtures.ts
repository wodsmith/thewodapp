export * from "./fixtures"
import { previewSession } from "./session-ux-fixtures"
import { providerDays, previewContext } from "./track-fixtures"
export async function getTrainingWeekFn({
  data,
}: {
  data: { startDate: string; trackId?: string }
}) {
  const end = new Date(`${data.startDate}T12:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 6)
  return {
    sessions: Array.from({length:7},(_,index) => {const date = new Date(`${data.startDate}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+index);return previewSession(data.trackId ?? "",date.toISOString().slice(0,10))}).filter(item => item !== null),
    myResults: [],
    teamResults: [],
    providerDays: providerDays.filter(
      (day) =>
        day.date >= data.startDate &&
        day.date <= end.toISOString().slice(0, 10),
    ),
  }
}

export async function getTrainingContextFn(){return previewContext}
