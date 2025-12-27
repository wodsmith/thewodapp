/**
 * Competition Pricing Route
 * Port from apps/wodsmith/src/app/(compete)/compete/organizer/[competitionId]/(with-sidebar)/pricing/page.tsx
 *
 * Allows organizers to configure registration fees for their competition.
 * Requires Stripe connection to be verified before showing the pricing form.
 */

import { createFileRoute } from '@tanstack/react-router'
import { getCompetitionByIdFn } from '@/server-fns/competition-detail-fns'
import { getCompetitionDivisionFeesFn } from '@/server-fns/commerce-fns'
import { getStripeConnectionStatusFn } from '@/server-fns/stripe-connect-fns'
import {
  parseCompetitionSettings,
  getScalingGroupWithLevelsFn,
} from '@/server-fns/competition-divisions-fns'
import { getTeamSlugFn } from '@/server-fns/team-fns'

import { PricingSettingsForm } from './-components/pricing-settings-form'
import { StripeConnectionRequired } from './-components/stripe-connection-required'

export const Route = createFileRoute(
  '/compete/organizer/$competitionId/pricing',
)({
  loader: async ({ params }) => {
    // 1. Get competition details
    const result = await getCompetitionByIdFn({
      data: { competitionId: params.competitionId },
    })

    if (!result.competition) {
      throw new Error('Competition not found')
    }

    const competition = result.competition

    // 2. Get Stripe connection status for the organizing team
    const stripeStatus = await getStripeConnectionStatusFn({
      data: { teamId: competition.organizingTeamId },
    })

    const isStripeConnected = stripeStatus.isConnected

    // 3. Get team slug for Stripe connection redirect (if not connected)
    const teamSlug = await getTeamSlugFn({
      data: { teamId: competition.organizingTeamId },
    })

    // 4. If Stripe not connected, return early with minimal data
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

    // 5. Get competition's divisions from scaling group
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

    // 6. Get current fee configuration
    const feeConfig = await getCompetitionDivisionFeesFn({
      data: { competitionId: competition.id },
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
    }
  },
  component: PricingPage,
})

function PricingPage() {
  const { competition, isStripeConnected, teamSlug, divisions, currentFees } =
    Route.useLoaderData()

  // If Stripe not connected, show connection prompt
  if (!isStripeConnected) {
    return (
      <StripeConnectionRequired
        teamSlug={teamSlug ?? ''}
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
        currentFees={currentFees!}
      />
    </div>
  )
}
