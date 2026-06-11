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

import { PricingSettingsForm } from "./-components/pricing-settings-form"
import { StripeConnectionRequired } from "./-components/stripe-connection-required"

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
  component: PricingPage,
})

function PricingPage() {
  const {
    competition,
    isStripeConnected,
    teamSlug,
    divisions,
    currentFees,
    teamFeeSettings,
  } = Route.useLoaderData()

  // If Stripe not connected, show connection prompt
  if (!isStripeConnected) {
    return (
      <StripeConnectionRequired
        teamSlug={teamSlug ?? ""}
        competitionName={competition.name}
      />
    )
  }

  // Type assertion is safe here because when isStripeConnected is true,
  // the loader returns the full competition object with all fields
  const fullCompetition = competition as {
    id: string
    name: string
    defaultRegistrationFeeCents: number
    platformFeePercentage: number | null
    platformFeeFixed: number | null
    passStripeFeesToCustomer: boolean
    passPlatformFeesToCustomer: boolean
  }

  // Show pricing settings form
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Pricing Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure registration fees for {competition.name}
        </p>
      </div>

      <PricingSettingsForm
        competition={fullCompetition}
        divisions={divisions}
        currentFees={currentFees ?? { defaultFeeCents: 0, divisionFees: [] }}
        teamFeeSettings={teamFeeSettings}
      />
    </div>
  )
}
