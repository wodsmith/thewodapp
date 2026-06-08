import { Link } from "@tanstack/react-router"
import {
  Calendar,
  ExternalLink,
  Eye,
  EyeOff,
  Layers,
  Pencil,
  UserPlus,
} from "lucide-react"
import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  formatDateStringFull,
  getLocalDateKey,
  isSameDateString,
} from "@/utils/date-utils"

interface CompetitionHeaderProps {
  competition: {
    id: string
    name: string
    slug: string
    description: string | null
    startDate: string // YYYY-MM-DD format
    endDate: string // YYYY-MM-DD format
    registrationOpensAt: string | null // YYYY-MM-DD format
    registrationClosesAt: string | null // YYYY-MM-DD format
    visibility: "public" | "private"
    status: "draft" | "published"
    groupId?: string | null
  }
}

function formatDateTime(date: string): string {
  return formatDateStringFull(date) || date
}

function getRegistrationStatus(
  opensAt: string | null,
  closesAt: string | null,
): {
  label: string
  detail: string | null
  variant: "default" | "secondary" | "destructive"
} | null {
  if (!opensAt || !closesAt) return null

  // Get today as YYYY-MM-DD for comparison
  const now = new Date()
  const todayStr = getLocalDateKey(now)

  if (todayStr < opensAt) {
    return {
      label: "Upcoming",
      detail: `Opens ${formatDateTime(opensAt)}`,
      variant: "secondary",
    }
  }
  if (todayStr > closesAt) {
    return {
      label: "Closed",
      detail: `Closed ${formatDateTime(closesAt)}`,
      variant: "destructive",
    }
  }
  return {
    label: "Open",
    detail: `Closes ${formatDateTime(closesAt)}`,
    variant: "default",
  }
}

function getCompetitionStatus(
  startDate: string,
  endDate: string,
): { label: string; variant: "default" | "secondary" | "outline" } {
  const todayStr = getLocalDateKey(new Date())

  if (todayStr < startDate) {
    return { label: "Upcoming", variant: "secondary" }
  }
  if (todayStr > endDate) {
    return { label: "Complete", variant: "outline" }
  }
  return { label: "Live", variant: "default" }
}

function StatusItem({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  )
}

export function CompetitionHeader({ competition }: CompetitionHeaderProps) {
  const registrationStatus = getRegistrationStatus(
    competition.registrationOpensAt,
    competition.registrationClosesAt,
  )
  const competitionStatus = getCompetitionStatus(
    competition.startDate,
    competition.endDate,
  )

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold sm:text-3xl">{competition.name}</h1>
        <div className="mt-2 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <StatusItem label="Setup">
              {competition.status === "draft" ? (
                <Badge variant="secondary" className="shrink-0">
                  Draft
                </Badge>
              ) : (
                <Badge variant="default" className="shrink-0 bg-green-600">
                  Published
                </Badge>
              )}
            </StatusItem>
            <StatusItem label="Visibility">
              {competition.visibility === "private" ? (
                <Badge variant="secondary" className="shrink-0">
                  <EyeOff className="mr-1 h-3 w-3" />
                  Private
                </Badge>
              ) : (
                <Badge variant="outline" className="shrink-0">
                  <Eye className="mr-1 h-3 w-3" />
                  Public
                </Badge>
              )}
            </StatusItem>
            {registrationStatus && (
              <StatusItem label="Registration">
                <Badge variant={registrationStatus.variant}>
                  {registrationStatus.label}
                </Badge>
                {registrationStatus.detail && (
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {registrationStatus.detail}
                  </span>
                )}
              </StatusItem>
            )}
            <StatusItem label="Competition">
              <Badge variant={competitionStatus.variant}>
                {competitionStatus.label}
              </Badge>
            </StatusItem>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>
              {isSameDateString(competition.startDate, competition.endDate)
                ? formatDateStringFull(competition.startDate)
                : `${formatDateStringFull(competition.startDate)} - ${formatDateStringFull(competition.endDate)}`}
            </span>
          </div>
          {competition.registrationOpensAt &&
            competition.registrationClosesAt && (
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                <span>
                  Registration:{" "}
                  {formatDateTime(competition.registrationOpensAt)} -{" "}
                  {formatDateTime(competition.registrationClosesAt)}
                </span>
              </div>
            )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <a href={`/compete/organizer/${competition.id}/edit`}>
          <Button variant="outline" size="sm">
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </a>
        <Link to="/compete/$slug" params={{ slug: competition.slug }}>
          <Button variant="outline" size="sm">
            <ExternalLink className="mr-2 h-4 w-4" />
            View Public Page
          </Button>
        </Link>
        {competition.groupId && (
          <Link
            to="/compete/organizer/series/$groupId"
            params={{ groupId: competition.groupId }}
          >
            <Button variant="outline" size="sm">
              <Layers className="mr-2 h-4 w-4" />
              Go to Series
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}
