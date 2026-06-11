/**
 * Competition Locations Page
 *
 * Shared page body for the organizer and cohost locations routes. The
 * organizer route renders it with defaults; the cohost route injects
 * cohost-permissioned venue mutation overrides.
 */

import { useRouter } from "@tanstack/react-router"
import type { ComponentProps } from "react"
import { VenueManager } from "@/components/organizer/schedule/venue-manager"

type VenueManagerProps = ComponentProps<typeof VenueManager>

interface LocationsPageProps {
  competitionId: string
  competitionName: string
  venues: VenueManagerProps["venues"]
  primaryAddressId: VenueManagerProps["primaryAddressId"]
  primaryAddress: VenueManagerProps["primaryAddress"]
  /** Cohost routes inject cohost-permissioned venue mutations. */
  overrides?: VenueManagerProps["overrides"]
}

export function LocationsPage({
  competitionId,
  competitionName,
  venues,
  primaryAddressId,
  primaryAddress,
  overrides,
}: LocationsPageProps) {
  const router = useRouter()

  // Refresh loader data after any venue mutation
  const handleVenueChange = async () => {
    await router.invalidate()
  }

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Locations & Venues
        </h1>
        <p className="text-muted-foreground">
          Manage venues for {competitionName}. Venues are physical locations
          like "Main Floor" or "Outside Rig" where heats are scheduled.
        </p>
      </div>

      <VenueManager
        competitionId={competitionId}
        venues={venues}
        primaryAddressId={primaryAddressId}
        primaryAddress={primaryAddress}
        onVenueCreate={handleVenueChange}
        onVenueUpdate={handleVenueChange}
        onVenueDelete={handleVenueChange}
        overrides={overrides}
      />
    </div>
  )
}
