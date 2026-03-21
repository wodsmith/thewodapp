/**
 * Cohost Competition Pricing Route
 *
 * Allows cohosts to configure registration fees for their competition.
 * Gated by canManagePricing permission.
 * Requires Stripe connection to be verified before showing the pricing form.
 */

import { createFileRoute, getRouteApi, redirect } from "@tanstack/react-router"
import { getCompetitionDivisionFeesFn } from "@/server-fns/commerce-fns"
import {
  getScalingGroupWithLevelsFn,
  parseCompetitionSettings,
} from "@/server-fns/competition-divisions-fns"
import { getStripeConnectionStatusFn } from "@/server-fns/stripe-connect-fns"
import { getTeamFeeSettingsFn, getTeamSlugFn } from "@/server-fns/team-fns"

import { PricingSettingsForm } from "@/routes/compete/organizer/$competitionId/-components/pricing-settings-form"
import { StripeConnectionRequired } from "@/routes/compete/organizer/$competitionId/-components/stripe-connection-required"

const parentRoute = getRouteApi("/compete/cohost/$competitionId")

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/pricing",
)({
  staleTime: 10_000,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition, permissions } = parentMatch.loaderData!

    // Permission gate: canManagePricing
    if (!permissions?.canManagePricing) {
      throw redirect({
        to: "/compete/cohost/$competitionId",
        params: { competitionId: params.competitionId },
      })
    }

    // Get Stripe connection status for the organizing team
    const stripeStatus = await getStripeConnectionStatusFn({
      data: { teamId: competition.organizingTeamId },
    })

    const isStripeConnected = stripeStatus.isConnected

    // Get team slug for Stripe connection redirect (if not connected)
    const teamSlug = await getTeamSlugFn({
      data: { teamId: competition.organizingTeamId },
    })

    // If Stripe not connected, return early with minimal data
    if (!isStripeConnected) {
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

    // Get competition's divisions from scaling group
    const settings = parseCompetitionSettings(competition.settings)
    let divisions: Array<{ id: string; label: string; teamSize: number }> = []

    if (settings?.divisions?.scalingGroupId) {
      const scalingGroup = await getScalingGroupWithLevelsFn({
        data: { scalingGroupId: settings.divisions.scalingGroupId },
      })

      if (scalingGroup?.scalingLevels) {
        divisions = scalingGroup.scalingLevels.map((level) => ({
          id: level.id,
          label: level.label,
          teamSize: level.teamSize ?? 1,
        }))
      }
    }

    // Get current fee configuration
    const feeConfig = await getCompetitionDivisionFeesFn({
      data: { competitionId: competition.id },
    })

    // Get team's fee settings (for founding organizers)
    const teamFeeSettings = await getTeamFeeSettingsFn({
      data: { teamId: competition.organizingTeamId },
    })

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

  if (!isStripeConnected) {
    return (
      <StripeConnectionRequired
        teamSlug={teamSlug ?? ""}
        competitionName={competition.name}
      />
    )
  }

  const fullCompetition = competition as {
    id: string
    name: string
    defaultRegistrationFeeCents: number
    platformFeePercentage: number | null
    platformFeeFixed: number | null
    passStripeFeesToCustomer: boolean
    passPlatformFeesToCustomer: boolean
  }

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
