/**
 * Competition Waivers Page
 *
 * Shared page body for the organizer and cohost waivers routes. The organizer
 * route renders it with defaults; the cohost route injects
 * cohost-permissioned waiver mutation overrides.
 */
// @lat: [[organizer-dashboard#Cohost Dashboard#Shared Component Callback Pattern#Shared Page Components]]

import type { ComponentProps } from "react"
import { WaiverList } from "../-components/waiver-list"

type WaiverListProps = ComponentProps<typeof WaiverList>

interface WaiversPageProps {
  competitionId: string
  /** Organizing team for organizers, competition team for cohosts. */
  teamId: string
  waivers: WaiverListProps["waivers"]
  /** Cohost routes inject cohost-permissioned waiver mutations. */
  overrides?: WaiverListProps["overrides"]
}

export function WaiversPage({
  competitionId,
  teamId,
  waivers,
  overrides,
}: WaiversPageProps) {
  return (
    <WaiverList
      competitionId={competitionId}
      teamId={teamId}
      waivers={waivers}
      overrides={overrides}
    />
  )
}
