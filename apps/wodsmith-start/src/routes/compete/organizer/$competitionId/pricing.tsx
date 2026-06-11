/**
 * Competition Pricing Route
 * Port from apps/wodsmith/src/app/(compete)/compete/organizer/[competitionId]/(with-sidebar)/pricing/page.tsx
 *
 * Allows organizers to configure registration fees for their competition.
 * Requires Stripe connection to be verified before showing the pricing form.
 */
// @lat: [[organizer-dashboard#Pricing]]

import { createFileRoute } from "@tanstack/react-router"
import { getCompetitionDivisionFeesFn } from "@/server-fns/commerce-fns"
import {
  getScalingGroupWithLevelsFn,
  parseCompetitionSettings,
} from "@/server-fns/competition-divisions-fns"
import { getStripeConnectionStatusFn } from "@/server-fns/stripe-connect-fns"
import { getTeamFeeSettingsFn, getTeamSlugFn } from "@/server-fns/team-fns"

import { PricingPage } from "./-pages/pricing-page"

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/pricing",
)({
  staleTime: 10_000,
  loader: async ({ parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    const settings = parseCompetitionSettings(competition.settings)
    const scalingGroupId = settings?.divisions?.scalingGroupId

    // All five lookups are independent — fetch in parallel
    const [stripeStatus, teamSlug, scalingGroup, feeConfig, teamFeeSettings] =
      await Promise.all([
        getStripeConnectionStatusFn({
          data: { teamId: competition.organizingTeamId },
        }),
        getTeamSlugFn({
          data: { teamId: competition.organizingTeamId },
        }),
        scalingGroupId
          ? getScalingGroupWithLevelsFn({
              data: { scalingGroupId },
            })
          : Promise.resolve(null),
        getCompetitionDivisionFeesFn({
          data: { competitionId: competition.id },
        }),
        getTeamFeeSettingsFn({
          data: { teamId: competition.organizingTeamId },
        }),
      ])

    // If Stripe not connected, return early with minimal data
    if (!stripeStatus.isConnected) {
      return {
        competition: {
          id: competition.id,
          name: competition.name,
        },
        isStripeConnected: false,
        teamSlug,
        divisions: [],
        currentFees: null,
      }
    }

    const divisions: Array<{ id: string; label: string; teamSize: number }> =
      scalingGroup?.scalingLevels
        ? scalingGroup.scalingLevels.map((level) => ({
            id: level.id,
            label: level.label,
            teamSize: level.teamSize ?? 1,
          }))
        : []

    return {
      competition: {
        id: competition.id,
        name: competition.name,
        defaultRegistrationFeeCents:
          competition.defaultRegistrationFeeCents ?? 0,
        platformFeePercentage: competition.platformFeePercentage ?? null,
        platformFeeFixed: competition.platformFeeFixed ?? null,
        passStripeFeesToCustomer: competition.passStripeFeesToCustomer ?? false,
        passPlatformFeesToCustomer:
          competition.passPlatformFeesToCustomer ?? true,
      },
      isStripeConnected: true,
      teamSlug,
      divisions,
      currentFees: feeConfig,
      teamFeeSettings,
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const {
    competition,
    isStripeConnected,
    teamSlug,
    divisions,
    currentFees,
    teamFeeSettings,
  } = Route.useLoaderData()

  return (
    <PricingPage
      competition={competition}
      isStripeConnected={isStripeConnected}
      teamSlug={teamSlug}
      divisions={divisions}
      currentFees={currentFees}
      teamFeeSettings={teamFeeSettings}
    />
  )
}
