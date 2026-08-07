import type {
  FeeBreakdown,
  FeeConfiguration,
} from "@/server/commerce/fee-calculator"

export interface CheckoutFeeLineInput {
  key: string
  /** Price set by the organizer, after multiplying by quantity. */
  basePriceCents: number
  /** Registration lines use the configured fixed platform fee; merch uses 0. */
  platformFixedCents?: number
  /** Organizer-funded discount allocated to this line. */
  discountCents?: number
}

export interface CheckoutFeeLine extends FeeBreakdown {
  key: string
  discountCents: number
}

export interface CheckoutFeeResult {
  lines: CheckoutFeeLine[]
  totalChargeCents: number
  totalOrganizerNetCents: number
  totalPlatformFeeCents: number
  totalStripeFeeCents: number
}

/** Allocate an integer amount proportionally while preserving the exact sum. */
export function allocateCents(total: number, weights: number[]): number[] {
  if (weights.length === 0) return []
  if (total <= 0) return weights.map(() => 0)

  const positiveWeights = weights.map((weight) => Math.max(0, weight))
  const weightTotal = positiveWeights.reduce((sum, weight) => sum + weight, 0)
  if (weightTotal === 0) {
    return weights.map((_, index) => (index === 0 ? total : 0))
  }

  const exact = positiveWeights.map((weight) => (total * weight) / weightTotal)
  const allocated = exact.map(Math.floor)
  const remaining = total - allocated.reduce((sum, value) => sum + value, 0)
  const remainderOrder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)

  for (let index = 0; index < remaining; index += 1) {
    allocated[remainderOrder[index % remainderOrder.length].index] += 1
  }

  return allocated
}

/**
 * Calculate fees for one Stripe transaction, then allocate Stripe's single
 * percentage-plus-fixed processing fee across its purchase rows.
 */
export function calculateCheckoutFees(
  inputs: CheckoutFeeLineInput[],
  config: FeeConfiguration,
): CheckoutFeeResult {
  if (inputs.length === 0) {
    return {
      lines: [],
      totalChargeCents: 0,
      totalOrganizerNetCents: 0,
      totalPlatformFeeCents: 0,
      totalStripeFeeCents: 0,
    }
  }

  const prepared = inputs.map((input) => {
    const basePriceCents = Math.max(0, Math.trunc(input.basePriceCents))
    const discountCents = Math.min(
      basePriceCents,
      Math.max(0, Math.trunc(input.discountCents ?? 0)),
    )
    const platformFeeCents =
      Math.round(
        basePriceCents * (config.platformPercentageBasisPoints / 10_000),
      ) + (input.platformFixedCents ?? config.platformFixedCents)
    const customerSubtotalCents = Math.max(
      0,
      basePriceCents -
        discountCents +
        (config.passPlatformFeesToCustomer ? platformFeeCents : 0),
    )
    const organizerBeforeStripeCents =
      basePriceCents -
      discountCents -
      (config.passPlatformFeesToCustomer ? 0 : platformFeeCents)

    return {
      ...input,
      basePriceCents,
      discountCents,
      platformFeeCents,
      customerSubtotalCents,
      organizerBeforeStripeCents,
    }
  })

  const customerSubtotalCents = prepared.reduce(
    (sum, line) => sum + line.customerSubtotalCents,
    0,
  )
  const stripeRate = config.stripePercentageBasisPoints / 10_000
  const totalChargeCents =
    customerSubtotalCents === 0
      ? 0
      : config.passStripeFeesToCustomer
        ? Math.ceil(
            (customerSubtotalCents + config.stripeFixedCents) /
              (1 - stripeRate),
          )
        : customerSubtotalCents
  const totalStripeFeeCents =
    customerSubtotalCents === 0
      ? 0
      : config.passStripeFeesToCustomer
        ? totalChargeCents - customerSubtotalCents
        : Math.round(totalChargeCents * stripeRate) + config.stripeFixedCents
  const allocatedStripeFees = allocateCents(
    totalStripeFeeCents,
    prepared.map((line) => line.customerSubtotalCents),
  )

  const lines = prepared.map((line, index): CheckoutFeeLine => {
    const stripeFeeCents = allocatedStripeFees[index]
    return {
      key: line.key,
      registrationFeeCents: line.basePriceCents,
      discountCents: line.discountCents,
      platformFeeCents: line.platformFeeCents,
      stripeFeeCents,
      totalChargeCents:
        line.customerSubtotalCents +
        (config.passStripeFeesToCustomer ? stripeFeeCents : 0),
      organizerNetCents:
        line.organizerBeforeStripeCents -
        (config.passStripeFeesToCustomer ? 0 : stripeFeeCents),
      stripeFeesPassedToCustomer: config.passStripeFeesToCustomer,
      platformFeesPassedToCustomer: config.passPlatformFeesToCustomer,
    }
  })

  return {
    lines,
    totalChargeCents: lines.reduce(
      (sum, line) => sum + line.totalChargeCents,
      0,
    ),
    totalOrganizerNetCents: lines.reduce(
      (sum, line) => sum + line.organizerNetCents,
      0,
    ),
    totalPlatformFeeCents: lines.reduce(
      (sum, line) => sum + line.platformFeeCents,
      0,
    ),
    totalStripeFeeCents,
  }
}
