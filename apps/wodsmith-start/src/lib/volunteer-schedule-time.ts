/** Event-local schedule formatting, shared by server windows and volunteer cards. */
export function getScheduleDayKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function formatScheduleDay(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date)
}

export function formatScheduleTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date)
}

export function formatScheduleTimeRange(
  start: Date,
  end: Date,
  timezone: string,
  includeDay = false,
): string {
  const startTime = formatScheduleTime(start, timezone)
  const endTime = formatScheduleTime(end, timezone)
  if (getScheduleDayKey(start, timezone) !== getScheduleDayKey(end, timezone)) {
    return `${formatScheduleDay(start, timezone)} ${startTime} - ${formatScheduleDay(end, timezone)} ${endTime}`
  }
  return `${includeDay ? `${formatScheduleDay(start, timezone)} ` : ""}${startTime} - ${endTime}`
}
