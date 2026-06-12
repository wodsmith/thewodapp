/**
 * Competition Pricing Page
 *
 * Shared page body for the organizer and cohost pricing routes. Shows a
 * Stripe-connection prompt until the organizing team connects Stripe. The
 * cohost route injects cohost-permissioned fee callbacks, a cohost route
 * prefix for form links, and read-only Stripe connection messaging.
 */
// @lat: [[organizer-dashboard#Cohost Dashboard#Shared Component Callback Pattern#Shared Page Components]]

import type { ComponentProps } from "react"
import { PricingSettingsForm } from "../-components/pricing-settings-form"
import { StripeConnectionRequired } from "../-components/stripe-connection-required"

type PricingFormProps = ComponentProps<typeof PricingSettingsForm>

interface PricingPageProps {
  /** Minimal `{ id, name }` when Stripe is not connected; full fee fields otherwise. */
  competition: Pick<PricingFormProps["competition"], "id" | "name"> &
    Partial<PricingFormProps["competition"]>
  isStripeConnected: boolean
  teamSlug: string | null
  divisions: PricingFormProps["divisions"]
  currentFees: PricingFormProps["currentFees"] | null
  teamFeeSettings?: PricingFormProps["teamFeeSettings"]
  /** Cohost routes show read-only Stripe messaging instead of payout setup links. */
  isCohost?: boolean
  /** Cohost routes point form navigation links at the cohost tree. */
  routePrefix?: PricingFormProps["routePrefix"]
  /** Cohost routes inject cohost-permissioned mutations. */
  onUpdateFeeConfig?: PricingFormProps["onUpdateFeeConfig"]
  onUpdateDivisionFee?: PricingFormProps["onUpdateDivisionFee"]
}

export function PricingPage({
  competition,
  isStripeConnected,
  teamSlug,
  divisions,
  currentFees,
  teamFeeSettings,
  isCohost,
  routePrefix,
  onUpdateFeeConfig,
  onUpdateDivisionFee,
}: PricingPageProps) {
  // If Stripe not connected, show connection prompt
  if (!isStripeConnected) {
    return (
      <StripeConnectionRequired
        teamSlug={teamSlug ?? ""}
        competitionName={competition.name}
        isCohost={isCohost}
      />
    )
  }

  // Type assertion is safe here because when isStripeConnected is true,
  // the route loaders return the full competition object with all fields
  const fullCompetition = competition as PricingFormProps["competition"]

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
        routePrefix={routePrefix}
        onUpdateFeeConfig={onUpdateFeeConfig}
        onUpdateDivisionFee={onUpdateDivisionFee}
      />
    </div>
  )
}
