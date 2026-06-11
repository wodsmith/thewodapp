/**
 * Competition Dashboard Shell
 *
 * Shared chrome for the organizer and cohost competition dashboards: sidebar,
 * breadcrumb, and competition header around the page content. Both layout
 * routes render this so cohost pages automatically pick up organizer chrome
 * changes; cohost mode filters the sidebar by permissions and hides
 * organizer-only header actions.
 */

import { useMatches } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { CompetitionHeader } from "@/components/competition-header"
import { CompetitionSidebar } from "@/components/competition-sidebar"
import {
  type BreadcrumbSegment,
  OrganizerBreadcrumb,
} from "@/components/organizer-breadcrumb"
import type { CohostMembershipMetadata } from "@/db/schemas/cohost"

// Map route paths to breadcrumb labels
// Note: "results" label is handled dynamically based on competition type
const routeLabels: Record<string, string> = {
  divisions: "Divisions",
  athletes: "Registrations",
  invites: "Invites",
  events: "Events",
  "event-divisions": "Event divisions",
  "submission-windows": "Submission windows",
  schedule: "Schedule",
  locations: "Locations",
  volunteers: "Volunteers",
  waivers: "Waivers",
  scoring: "Scoring",
  results: "Results", // Overridden to "Submissions" for online competitions
  "leaderboard-preview": "Leaderboard preview",
  review: "Review",
  pricing: "Pricing",
  revenue: "Revenue",
  coupons: "Coupons",
  sponsors: "Sponsors",
  "co-hosts": "Co-Hosts",
  settings: "Settings",
  edit: "Edit",
  "danger-zone": "Danger zone",
}

interface CompetitionDashboardShellProps {
  competition: {
    id: string
    name: string
    slug: string
    description: string | null
    startDate: string
    endDate: string
    registrationOpensAt: string | null
    registrationClosesAt: string | null
    visibility: "public" | "private"
    status: "draft" | "published"
    groupId?: string | null
    competitionType?: "in-person" | "online"
  }
  /** When set, renders the cohost variant of the sidebar, breadcrumb, and header. */
  cohostPermissions?: CohostMembershipMetadata
  /** Rendered above the breadcrumb, inside the sidebar inset (e.g. pending-approval banner). */
  banner?: ReactNode
  children: ReactNode
}

export function CompetitionDashboardShell({
  competition,
  cohostPermissions,
  banner,
  children,
}: CompetitionDashboardShellProps) {
  const matches = useMatches()

  // Get the current child route segment for breadcrumb
  const currentPath = matches[matches.length - 1]?.pathname ?? ""
  const segments = currentPath.split("/").filter(Boolean)
  const lastSegment = segments[segments.length - 1]

  // Build breadcrumb segments
  const breadcrumbSegments: BreadcrumbSegment[] = [{ label: competition.name }]

  // Add current page to breadcrumb if not on overview
  if (lastSegment && lastSegment !== competition.id) {
    let label = routeLabels[lastSegment] || lastSegment
    // Show "Submissions" instead of "Results" for online competitions
    if (lastSegment === "results" && competition.competitionType === "online") {
      label = "Submissions"
    }
    breadcrumbSegments.push({ label })
  }

  return (
    <CompetitionSidebar
      competitionId={competition.id}
      competitionType={competition.competitionType}
      cohost={
        cohostPermissions
          ? {
              competitionName: competition.name,
              permissions: cohostPermissions,
            }
          : undefined
      }
    >
      {banner}
      <div className="flex flex-1 flex-col gap-4 p-4 sm:gap-6 sm:p-6">
        {/* Breadcrumb */}
        <OrganizerBreadcrumb
          segments={breadcrumbSegments}
          root={
            cohostPermissions
              ? { label: "Co-Host" }
              : { label: "Organizer", href: "/compete/organizer" }
          }
        />

        {/* Competition Header */}
        <CompetitionHeader
          competition={{
            id: competition.id,
            name: competition.name,
            slug: competition.slug,
            description: competition.description,
            startDate: competition.startDate,
            endDate: competition.endDate,
            registrationOpensAt: competition.registrationOpensAt,
            registrationClosesAt: competition.registrationClosesAt,
            visibility: competition.visibility,
            status: competition.status,
            groupId: competition.groupId,
          }}
          showOrganizerActions={!cohostPermissions}
        />

        {/* Child route content */}
        {children}
      </div>
    </CompetitionSidebar>
  )
}
