/**
 * Cohost Competition Pricing Route
 *
 * Allows cohosts to configure registration fees for their competition.
 * Gated by pricing permission.
 * Requires Stripe connection to be verified before showing the pricing form.
 * Renders the shared organizer PricingPage with cohost-permissioned fee
 * callbacks so the page stays in sync with the organizer route.
 */

import { createFileRoute, redirect } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  cohostUpdateDefaultFeeFn,
  cohostUpdateDivisionFeeFn,
} from "@/server-fns/cohost/cohost-pricing-fns"
import {
  getCompetitionDivisionFeesFn,
  getOrganizerStripeStatusFn,
} from "@/server-fns/commerce-fns"
import {
  getScalingGroupWithLevelsFn,
  parseCompetitionSettings,
} from "@/server-fns/competition-divisions-fns"
import { getTeamFeeSettingsFn } from "@/server-fns/team-fns"
import { PricingPage } from "../../organizer/$competitionId/-pages/pricing-page"

export const Route = createFileRoute("/compete/cohost/$competitionId/pricing")({
  staleTime: 10_000,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition, permissions } = parentMatch.loaderData!

    // Permission gate: pricing
    if (!permissions?.pricing) {
      throw redirect({
        to: "/compete/cohost/$competitionId",
        params: { competitionId: params.competitionId },
      })
    }

    // Get Stripe connection status + team slug for the organizing team.
    // Cohosts are not members of the organizing team, so we use the no-auth
    // organizer-status fn rather than getStripeConnectionStatusFn (which
    // requires team membership).
    const { stripeStatus } = await getOrganizerStripeStatusFn({
      data: { organizingTeamId: competition.organizingTeamId },
    })

    const isStripeConnected = stripeStatus?.isConnected ?? false
    const teamSlug = stripeStatus?.teamSlug ?? null

    const competitionTeamId = competition.competitionTeamId!

    // If Stripe not connected, return early with minimal data
    if (!isStripeConnected) {
      return {
        competition: {
          id: competition.id,
          name: competition.name,
        },
        competitionTeamId,
        isStripeConnected: false,
        teamSlug,
        divisions: [],
        currentFees: null,
      }
    }

    // Parallel fetch divisions (from scaling group), fee configuration, and
    // team fee settings (for founding organizers)
    const settings = parseCompetitionSettings(competition.settings)
    const [scalingGroup, feeConfig, teamFeeSettings] = await Promise.all([
      settings?.divisions?.scalingGroupId
        ? getScalingGroupWithLevelsFn({
            data: { scalingGroupId: settings.divisions.scalingGroupId },
          })
        : null,
      getCompetitionDivisionFeesFn({
        data: { competitionId: competition.id },
      }),
      getTeamFeeSettingsFn({
        data: { teamId: competition.organizingTeamId },
      }),
    ])

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
      competitionTeamId,
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
    competitionTeamId,
    isStripeConnected,
    teamSlug,
    divisions,
    currentFees,
    teamFeeSettings,
  } = Route.useLoaderData()
  const updateDefaultFee = useServerFn(cohostUpdateDefaultFeeFn)
  const updateDivisionFee = useServerFn(cohostUpdateDivisionFeeFn)

  return (
    <PricingPage
      competition={competition}
      isStripeConnected={isStripeConnected}
      teamSlug={teamSlug}
      divisions={divisions}
      currentFees={currentFees}
      teamFeeSettings={teamFeeSettings}
      isCohost
      routePrefix="/compete/cohost"
      onUpdateFeeConfig={async (data) => {
        await updateDefaultFee({
          data: { ...data, competitionTeamId },
        })
      }}
      onUpdateDivisionFee={async (data) => {
        await updateDivisionFee({
          data: { ...data, competitionTeamId },
        })
      }}
    />
  )
}
