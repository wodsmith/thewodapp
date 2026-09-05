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

export function formatScheduleTime(
  date: Date,
  timezone: string,
  includeTimezone = false,
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...(includeTimezone ? { timeZoneName: "short" as const } : {}),
  }).format(date)
}

export function formatScheduleTimeRange(
  start: Date,
  end: Date,
  timezone: string,
  includeDay = false,
): string {
  const offsetFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  })
  const offsetAt = (date: Date) =>
    offsetFormatter
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value
  const changesOffset = offsetAt(start) !== offsetAt(end)
  const startTime = formatScheduleTime(start, timezone, changesOffset)
  const endTime = formatScheduleTime(end, timezone, changesOffset)
  if (getScheduleDayKey(start, timezone) !== getScheduleDayKey(end, timezone)) {
    return `${formatScheduleDay(start, timezone)} ${startTime} - ${formatScheduleDay(end, timezone)} ${endTime}`
  }
  return `${includeDay ? `${formatScheduleDay(start, timezone)} ` : ""}${startTime} - ${endTime}`
}
