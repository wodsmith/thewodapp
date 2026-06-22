import {
  DEFAULT_TIMEZONE,
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
  const hasOpened = hasDateStartedInTimezone(opensAt, competitionTimezone)
  const hasClosed = isDeadlinePassedInTimezone(closesAt, competitionTimezone)

  return {
    registrationOpen: hasOpened && !hasClosed,
    registrationClosed: !!closesAt && hasClosed,
    registrationNotYetOpen: !!opensAt && !hasOpened,
  }
}
