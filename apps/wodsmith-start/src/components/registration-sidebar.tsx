import { Link } from "@tanstack/react-router"
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Plus,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Competition, CompetitionGroup } from "@/db/schemas/competitions"
import type { PublicCompetitionDivision } from "@/server-fns/competition-divisions-fns"
import type { Team } from "@/db/schemas/teams"
import { formatDateStringFull, isSameDateString } from "@/utils/date-utils"
import {
  DEFAULT_TIMEZONE,
  getEndOfDayInTimezone,
  hasDateStartedInTimezone,
} from "@/utils/timezone-utils"

/**
 * Calculate time remaining until deadline and return urgency level
 * Accepts YYYY-MM-DD string, Date, or number (timestamp)
 * For YYYY-MM-DD strings, uses the competition's timezone to determine end of day
 */
function getDeadlineUrgency(
  deadline: string | Date | number,
  timezone: string = DEFAULT_TIMEZONE,
): {
  daysRemaining: number
  hoursRemaining: number
  urgencyLevel: "critical" | "urgent" | "normal" | "none"
  message: string
} {
  const now = new Date()
  // Handle YYYY-MM-DD strings by parsing to end of day in competition's timezone
  let deadlineDate: Date
  if (typeof deadline === "string") {
    const endOfDay = getEndOfDayInTimezone(deadline, timezone)
    if (!endOfDay) {
      // Invalid date string
      return {
        daysRemaining: 0,
        hoursRemaining: 0,
        urgencyLevel: "none",
        message: "",
      }
    }
    deadlineDate = endOfDay
  } else if (typeof deadline === "number") {
    deadlineDate = new Date(deadline)
  } else {
    deadlineDate = deadline
  }
  const diffMs = deadlineDate.getTime() - now.getTime()

  if (diffMs <= 0) {
    return {
      daysRemaining: 0,
      hoursRemaining: 0,
      urgencyLevel: "none",
      message: "Registration closed",
    }
  }

  const hoursRemaining = Math.floor(diffMs / (1000 * 60 * 60))
  const daysRemaining = Math.floor(hoursRemaining / 24)

  if (hoursRemaining <= 24) {
    const hours = hoursRemaining
    return {
      daysRemaining,
      hoursRemaining,
      urgencyLevel: "critical",
      message:
        hours <= 1 ? "Less than 1 hour left!" : `Only ${hours} hours left!`,
    }
  }

  if (daysRemaining <= 3) {
    return {
      daysRemaining,
      hoursRemaining,
      urgencyLevel: "urgent",
      message:
        daysRemaining === 1
          ? "Last day to register!"
          : `Only ${daysRemaining} days left!`,
    }
  }

  if (daysRemaining <= 7) {
    return {
      daysRemaining,
      hoursRemaining,
      urgencyLevel: "normal",
      message: `${daysRemaining} days left to register`,
    }
  }

  return {
    daysRemaining,
    hoursRemaining,
    urgencyLevel: "none",
    message: "",
  }
}

interface UserRegistrationEntry {
  registration: {
    id: string
    divisionId: string | null
    status: string
    userId: string
    teamName: string | null
    captainUserId: string | null
    athleteTeamId: string | null
  }
  division: PublicCompetitionDivision | null
}

interface RegistrationSidebarProps {
  competition: Competition & {
    organizingTeam: Team | null
    group: CompetitionGroup | null
  }
  isRegistered: boolean
  registrationOpen: boolean
  maxSpots?: number
  userDivision?: string | null
  registrationId?: string | null
  isTeamRegistration?: boolean
  isCaptain?: boolean
  isVolunteer?: boolean
  userRegistrations?: UserRegistrationEntry[]
  session?: { userId: string } | null
  competitionCapacity?: {
    spotsAvailable: number | null
    isFull: boolean
    totalOccupied: number
    effectiveMax: number | null
  } | null
}

function formatDateShort(date: string | Date | number): string {
  // Handle YYYY-MM-DD strings using utility
  if (typeof date === "string") {
    return formatDateStringFull(date) || date
  }
  const d = typeof date === "number" ? new Date(date) : date
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatDeadlineDate(date: string | Date | number): string {
  return formatDateShort(date)
}

export function RegistrationSidebar({
  competition,
  isRegistered,
  registrationOpen,
  maxSpots: _maxSpots, // Reserved for future "X spots left" feature
  userDivision,
  registrationId,
  isTeamRegistration,
  isCaptain,
  isVolunteer = false,
  userRegistrations = [],
  session,
  competitionCapacity,
}: RegistrationSidebarProps) {
  const regClosesAt = competition.registrationClosesAt
  const regOpensAt = competition.registrationOpensAt
  const competitionTimezone = competition.timezone || DEFAULT_TIMEZONE

  // Calculate urgency for deadline (using competition's timezone)
  const urgency = regClosesAt
    ? getDeadlineUrgency(regClosesAt, competitionTimezone)
    : null

  // Check if registration hasn't opened yet (using competition's timezone)
  const registrationNotYetOpen =
    regOpensAt && !hasDateStartedInTimezone(regOpensAt, competitionTimezone)

  const hasMultipleRegistrations = userRegistrations.length > 1

  return (
    <div className="space-y-4">
      {/* Volunteer Dashboard Button */}
      {isVolunteer && (
        <Card className="border-2 border-blue-500/20 bg-white/5 backdrop-blur-md">
          <CardContent className="p-4">
            <Button asChild variant="default" size="sm" className="w-full">
              <a href={`/compete/${competition.slug}/my-schedule`}>
                <Calendar className="mr-2 h-4 w-4" />
                Volunteer Dashboard
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Registration CTA Card - shown when NOT registered at all */}
      {!isRegistered && registrationOpen && (
        <Card
          className={`backdrop-blur-md ${
            urgency?.urgencyLevel === "critical"
              ? "border-2 border-red-500/50 bg-red-500/10"
              : urgency?.urgencyLevel === "urgent"
                ? "border-2 border-amber-500/50 bg-amber-500/10"
                : "border-2 border-orange-500/20 bg-white/5"
          }`}
        >
          <CardContent className="p-4 space-y-3">
            {/* Urgency Message */}
            {urgency && urgency.urgencyLevel !== "none" && (
              <div
                className={`flex items-center gap-2 ${
                  urgency.urgencyLevel === "critical"
                    ? "text-red-600"
                    : urgency.urgencyLevel === "urgent"
                      ? "text-amber-600"
                      : "text-muted-foreground"
                }`}
              >
                {urgency.urgencyLevel === "critical" ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
                <span className="text-sm font-semibold">{urgency.message}</span>
              </div>
            )}

            {/* Competition-wide capacity */}
            {competitionCapacity?.isFull && (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-semibold">Competition is full</span>
              </div>
            )}
            {competitionCapacity && !competitionCapacity.isFull && competitionCapacity.spotsAvailable !== null && competitionCapacity.spotsAvailable <= 5 && (
              <div className="flex items-center gap-2 text-amber-600">
                <Users className="h-4 w-4" />
                <span className="text-sm font-semibold">
                  Only {competitionCapacity.spotsAvailable} spot{competitionCapacity.spotsAvailable === 1 ? '' : 's'} left!
                </span>
              </div>
            )}

            {/* Register Button */}
            {!competitionCapacity?.isFull && (
              <Button asChild size="lg" className="w-full">
                <Link
                  to="/compete/$slug/register"
                  params={{ slug: competition.slug }}
                >
                  Register Now
                </Link>
              </Button>
            )}

            {/* Deadline info (if not already shown in urgency) */}
            {regClosesAt && urgency?.urgencyLevel === "none" && (
              <p className="text-xs text-muted-foreground text-center">
                Registration closes {formatDeadlineDate(regClosesAt)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Registration Not Yet Open */}
      {!isRegistered &&
        !registrationOpen &&
        registrationNotYetOpen &&
        regOpensAt && (
          <Card className="border-white/10 bg-white/5 backdrop-blur-md">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Registration opens soon
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Opens {formatDeadlineDate(regOpensAt)}
              </p>
            </CardContent>
          </Card>
        )}

      {/* Registration Closed */}
      {!isRegistered &&
        !registrationOpen &&
        !registrationNotYetOpen &&
        regClosesAt && (
          <Card className="border-white/10 bg-white/5 backdrop-blur-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">Registration closed</span>
              </div>
            </CardContent>
          </Card>
        )}

      {/* My Registrations Card - shown when registered */}
      {isRegistered &&
        (() => {
          const allRemoved =
            userRegistrations.length > 0 &&
            userRegistrations.every((e) => e.registration.status === "removed")
          return (
            <Card
              className={`border-2 ${allRemoved ? "border-red-500/20" : "border-green-500/20"} bg-white/5 backdrop-blur-md`}
            >
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div
                    className={`flex items-center gap-2 ${allRemoved ? "text-red-600" : "text-green-600"}`}
                  >
                    {allRemoved ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                    <span className="font-semibold">
                      {allRemoved
                        ? "Registration Removed"
                        : hasMultipleRegistrations
                          ? "My Registrations"
                          : "You're Registered!"}
                    </span>
                  </div>

                  {/* Multiple registrations: show list */}
                  {hasMultipleRegistrations ? (
                    <div className="space-y-2">
                      {userRegistrations.map((entry) => {
                        const isTeam = (entry.division?.teamSize ?? 1) > 1
                        const isEntryCaptain =
                          entry.registration.captainUserId === session?.userId
                        const isEntryRemoved =
                          entry.registration.status === "removed"
                        return (
                          <div
                            key={entry.registration.id}
                            className={`flex items-center justify-between p-2 rounded-md border ${
                              isEntryRemoved
                                ? "border-red-500/30 bg-red-500/10 opacity-60"
                                : "border-green-500/10 bg-green-500/5"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {entry.division?.label ?? "Division"}
                                {isEntryRemoved && (
                                  <span className="text-xs text-red-500 ml-1">
                                    (Removed)
                                  </span>
                                )}
                              </p>
                              {entry.registration.teamName && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {entry.registration.teamName}
                                </p>
                              )}
                            </div>
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              className="shrink-0 h-7 text-xs"
                            >
                              <a
                                href={`/compete/${competition.slug}/teams/${entry.registration.id}`}
                              >
                                {isTeam
                                  ? isEntryCaptain
                                    ? "Manage"
                                    : "View"
                                  : "View"}
                              </a>
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <>
                      {/* Single registration: original display */}
                      {userDivision && (
                        <p className="text-sm text-muted-foreground">
                          Division:{" "}
                          <span className="font-medium">{userDivision}</span>
                        </p>
                      )}
                      {registrationId && (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          <a
                            href={`/compete/${competition.slug}/teams/${registrationId}`}
                          >
                            <Users className="mr-2 h-4 w-4" />
                            {isTeamRegistration
                              ? isCaptain
                                ? "Manage Team"
                                : "View Team"
                              : "View Registration"}
                          </a>
                        </Button>
                      )}
                    </>
                  )}

                  {/* Register for Another Division - shown when registered AND registration is open AND not full */}
                  {registrationOpen && !competitionCapacity?.isFull && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Link
                        to="/compete/$slug/register"
                        params={{ slug: competition.slug }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Register for Another Division
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })()}

      {/* Date & Location Card */}
      <Card className="border-white/10 bg-white/5 backdrop-blur-md">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">
                {formatDateShort(competition.startDate)}
                {!isSameDateString(
                  competition.startDate,
                  competition.endDate,
                ) && <> - {formatDateShort(competition.endDate)}</>}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">
                {competition.organizingTeam?.name || "Location TBA"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
