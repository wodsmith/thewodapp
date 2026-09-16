// @lat: [[crew#Import Apply]]
import {
  DEFAULT_TIMEZONE,
  parseTimeInTimezone,
} from "../../../utils/timezone-utils"

/** Keep import invitations valid through the event's final local calendar day. */
export function getCrewImportInvitationExpiry({
  now,
  endDate,
  timezone,
}: {
  now: Date
  endDate: string
  timezone: string | null
}): Date {
  const finalMinute = parseTimeInTimezone(
    "23:59",
    endDate,
    timezone ?? DEFAULT_TIMEZONE,
  )
  if (!finalMinute || !Number.isFinite(finalMinute.getTime())) {
    throw new Error(
      "A valid event end date and timezone are required to import volunteers.",
    )
  }
  return new Date(
    Math.max(
      now.getTime() + 30 * 24 * 60 * 60 * 1000,
      finalMinute.getTime() + 60_000,
    ),
  )
}
