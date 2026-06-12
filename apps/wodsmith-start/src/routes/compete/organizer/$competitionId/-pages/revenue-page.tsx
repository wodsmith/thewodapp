/**
 * Competition Revenue Page
 *
 * Shared page body for the organizer and cohost revenue routes. The cohost
 * route hides the payout setup link since cohosts cannot configure Stripe for
 * the organizing team.
 */
// @lat: [[organizer-dashboard#Cohost Dashboard#Shared Component Callback Pattern#Shared Page Components]]

import type { ComponentProps } from "react"
import { RevenueStatsDisplay } from "../-components/revenue-stats-display"

type RevenueStatsDisplayProps = ComponentProps<typeof RevenueStatsDisplay>

interface RevenuePageProps {
  stats: RevenueStatsDisplayProps["stats"]
  stripeStatus?: RevenueStatsDisplayProps["stripeStatus"]
  /** Cohost routes hide the organizer-only payout setup link. */
  hidePayoutSetupLink?: boolean
}

export function RevenuePage({
  stats,
  stripeStatus,
  hidePayoutSetupLink,
}: RevenuePageProps) {
  return (
    <RevenueStatsDisplay
      stats={stats}
      stripeStatus={stripeStatus}
      hidePayoutSetupLink={hidePayoutSetupLink}
    />
  )
}
