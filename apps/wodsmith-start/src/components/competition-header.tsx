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
  variant: "default" | "secondary" | "destructive"
} | null {
  if (!opensAt || !closesAt) return null

  // Get today as YYYY-MM-DD for comparison
  const now = new Date()
  const todayStr = getLocalDateKey(now)

  if (todayStr < opensAt) {
    return {
      label: "Upcoming",
      variant: "secondary",
    }
  }
  if (todayStr > closesAt) {
    return {
      label: "Closed",
      variant: "destructive",
    }
  }
  return {
    label: "Open",
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

function HeaderField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0 rounded-md bg-muted/30 py-1.5 pr-2.5 pl-0">
      <div className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-foreground">
        {children}
      </div>
    </div>
  )
}

function MutedDetail({ children }: { children: ReactNode }) {
  return (
    <span className="min-w-0 truncate text-xs text-muted-foreground">
      {children}
    </span>
  )
}

function formatDateRange(startDate: string, endDate: string): string {
  if (isSameDateString(startDate, endDate)) {
    return formatDateStringFull(startDate) || startDate
  }

  return `${formatDateStringFull(startDate) || startDate} - ${
    formatDateStringFull(endDate) || endDate
  }`
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
        <h1 className="text-2xl font-bold text-pretty sm:text-3xl">
          {competition.name}
        </h1>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <HeaderField label="Publication">
            {competition.status === "draft" ? (
              <Badge variant="secondary" className="shrink-0">
                Draft
              </Badge>
            ) : (
              <Badge variant="default" className="shrink-0 bg-green-600">
                Published
              </Badge>
            )}
          </HeaderField>
          <HeaderField label="Visibility">
            {competition.visibility === "private" ? (
              <Badge variant="secondary" className="shrink-0">
                <EyeOff className="mr-1 h-3 w-3" aria-hidden="true" />
                Private
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0">
                <Eye className="mr-1 h-3 w-3" aria-hidden="true" />
                Public
              </Badge>
            )}
          </HeaderField>
          {registrationStatus && (
            <HeaderField label="Registration">
              <Badge variant={registrationStatus.variant} className="shrink-0">
                {registrationStatus.label}
              </Badge>
              {competition.registrationOpensAt &&
                competition.registrationClosesAt && (
                  <>
                    <UserPlus
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <MutedDetail>
                      {formatDateTime(competition.registrationOpensAt)} -{" "}
                      {formatDateTime(competition.registrationClosesAt)}
                    </MutedDetail>
                  </>
                )}
            </HeaderField>
          )}
          <HeaderField label="Competition">
            <Badge variant={competitionStatus.variant} className="shrink-0">
              {competitionStatus.label}
            </Badge>
            <Calendar
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <MutedDetail>
              {formatDateRange(competition.startDate, competition.endDate)}
            </MutedDetail>
          </HeaderField>
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
