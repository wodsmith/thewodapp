/**
 * Competition Sponsors Page
 *
 * Shared page body for the organizer and cohost sponsors routes. The
 * organizer route renders it with defaults; the cohost route injects
 * cohost-permissioned sponsor mutation overrides.
 */

import type { ComponentProps } from "react"
import { SponsorManager } from "@/components/sponsors/sponsor-manager"

type SponsorManagerProps = ComponentProps<typeof SponsorManager>

interface SponsorsPageProps {
  competitionId: string
  organizingTeamId: string
  groups: SponsorManagerProps["groups"]
  ungroupedSponsors: SponsorManagerProps["ungroupedSponsors"]
  /** Cohost routes inject cohost-permissioned sponsor mutations. */
  overrides?: SponsorManagerProps["overrides"]
}

export function SponsorsPage({
  competitionId,
  organizingTeamId,
  groups,
  ungroupedSponsors,
  overrides,
}: SponsorsPageProps) {
  return (
    <SponsorManager
      competitionId={competitionId}
      organizingTeamId={organizingTeamId}
      groups={groups}
      ungroupedSponsors={ungroupedSponsors}
      overrides={overrides}
    />
  )
}
