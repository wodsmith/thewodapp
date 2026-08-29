import {
  DEFAULT_TIMEZONE,
  getEndOfDayInTimezone,
  getStartOfDayInTimezone,
  hasDateStartedInTimezone,
  isDeadlinePassedInTimezone,
} from "@/utils/timezone-utils"

export interface RegistrationWindowStatus {
  registrationOpen: boolean
  registrationClosed: boolean
  registrationNotYetOpen: boolean
}

export function getRegistrationWindowStatus({
  opensAt,
  closesAt,
  timezone,
}: {
  opensAt: string | null | undefined
  closesAt: string | null | undefined
  timezone?: string | null
}): RegistrationWindowStatus {
  const competitionTimezone = timezone || DEFAULT_TIMEZONE
  // Fail closed: a malformed date must not make registration appear open
  const opensAtInvalid =
    !!opensAt && !getStartOfDayInTimezone(opensAt, competitionTimezone)
  const closesAtInvalid =
    !!closesAt && !getEndOfDayInTimezone(closesAt, competitionTimezone)
  const hasOpened =
    !opensAtInvalid && hasDateStartedInTimezone(opensAt, competitionTimezone)
  const hasClosed =
    closesAtInvalid || isDeadlinePassedInTimezone(closesAt, competitionTimezone)

  return {
    registrationOpen: hasOpened && !hasClosed,
    registrationClosed: !!closesAt && hasClosed,
    registrationNotYetOpen: !!opensAt && !hasOpened,
  }
}
