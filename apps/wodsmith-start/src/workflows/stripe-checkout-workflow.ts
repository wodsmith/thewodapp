/**
 * Stripe Checkout Workflow
 *
 * Cloudflare Workflow that processes checkout.session.completed events
 * asynchronously with durable steps and per-step retries.
 *
 * The webhook handler verifies the Stripe signature, dispatches to this
 * workflow (keyed by event ID for idempotency), and returns 200 immediately.
 *
 * Steps:
 * 1. create-registration: Core DB operations (idempotency checks, capacity, registration, payment)
 * 2. send-confirmation-email: Email notification (retries independently)
 * 3. send-slack-notification: Slack notification (retries independently)
 *
 * In local dev (where Workflows aren't available), the webhook handler
 * calls processCheckoutInline() which runs the same logic synchronously.
 */

import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers"
import { WorkflowEntrypoint } from "cloudflare:workers"
import * as Sentry from "@sentry/cloudflare"
import {
  and,
  count,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm"
import { getDb } from "@/db"
import type { CommercePurchase } from "@/db/schema"
import {
  COMMERCE_PAYMENT_STATUS,
  COMMERCE_PRODUCT_TYPE,
  COMMERCE_PURCHASE_STATUS,
  COMPETITION_INVITE_STATUS,
  commerceProductTable,
  commercePurchaseTable,
  competitionDivisionsTable,
  competitionInvitesTable,
  competitionProductVariantsTable,
  competitionRegistrationAnswersTable,
  competitionRegistrationsTable,
  competitionsTable,
  REGISTRATION_STATUS,
  scalingLevelsTable,
  userTable,
} from "@/db/schema"
import {
  logError,
  logInfo,
  logWarning,
} from "@/lib/logging/posthog-otel-logger"
import { getSentryOptions } from "@/lib/sentry/server"
import { notifyCompetitionRegistration } from "@/lib/slack"
import { getStripe } from "@/lib/stripe"
import {
  recordPaymentCompleted,
  recordRefundCompleted,
} from "@/server/commerce/financial-events"
import {
  getOccupiedCountForBucket,
  resolveAllocationForInvite,
} from "@/server/competition-invites/claim"
import { assertInviteWithinAllocation } from "@/server/competition-invites/identity"
import { recordRedemption } from "@/server/coupons"
import {
  notifyRegistrationConfirmed,
  registerForCompetition,
} from "@/server/registration"
import { PENDING_PURCHASE_MAX_AGE_MINUTES } from "@/server-fns/competition-divisions-fns"
import { calculateCompetitionCapacity } from "@/utils/competition-capacity"
import { calculateDivisionCapacity } from "@/utils/division-capacity"

export interface CheckoutCompletedParams {
  stripeEventId: string
  session: {
    id: string
    payment_intent: string | null
    amount_total: number | null
    customer_email: string | null
    metadata: {
      purchaseIds?: string[]
      /** Legacy single-purchase webhook payload. */
      purchaseId?: string
      competitionId: string
      /** Legacy payload field; purchase rows are now authoritative. */
      divisionId?: string
      userId: string
      couponId?: string
      stripeCouponId?: string
      couponCode?: string
      couponDiscountCents?: string
    }
  }
}

interface RegistrationStepResult {
  registrationId: string
  userId: string
  competitionId: string
  divisionId: string
  purchaseId: string
  amountTotal: number | null
  customerEmail: string | null
  userName: string | null
  competitionName: string
  divisionName: string | null
  teamName: string | null
  registrationDivisionId: string | null
  registrationTeamName: string | null
  registrationPendingTeammates: string | null
  competitionSlug: string
  competitionStartDate: string | Date | null
  userEmail: string | null
  userFirstName: string | null
  /**
   * ADR-0011 Phase 2: if the purchase metadata carried an `inviteId`,
   * the registration-creating step hands it off so a downstream step can
   * flip the invite's status to `accepted_paid`. Null when this was a
   * non-invite registration.
   */
  inviteId: string | null
  isPaid: boolean
}

interface StoredRegistrationData {
  teamName?: string
  affiliateName?: string
  teammates?: Array<{
    email: string
    firstName?: string
    lastName?: string
    affiliateName?: string
  }>
  answers?: Array<{
    questionId: string
    answer: string
  }>
  inviteId?: string | null
  isFreeRegistration?: boolean
}

// =========================================================================
// Standalone processing functions (used by both Workflow and inline fallback)
// =========================================================================

const affectedRows = (result: unknown): number =>
  (result as { rowsAffected?: number }).rowsAffected ??
  (result as [{ affectedRows?: number }])[0]?.affectedRows ??
  0

function parseRegistrationData(
  purchaseId: string,
  metadata: string | null,
): StoredRegistrationData {
  if (!metadata) return {}
  try {
    return JSON.parse(metadata) as StoredRegistrationData
  } catch {
    logWarning({
      message: "[Workflow] Failed to parse purchase metadata",
      attributes: { purchaseId },
    })
    return {}
  }
}

async function buildRegistrationStepResult({
  session,
  purchase,
  registrationId,
  registrationData,
}: {
  session: CheckoutCompletedParams["session"]
  purchase: CommercePurchase
  registrationId: string
  registrationData: StoredRegistrationData
}): Promise<RegistrationStepResult> {
  const db = getDb()
  const competitionId = purchase.competitionId
  const divisionId = purchase.divisionId
  if (!competitionId || !divisionId) {
    throw new Error(`Registration purchase ${purchase.id} is missing context`)
  }

  const [competition, division, user, registration] = await Promise.all([
    db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, competitionId),
    }),
    db.query.scalingLevelsTable.findFirst({
      where: eq(scalingLevelsTable.id, divisionId),
    }),
    db.query.userTable.findFirst({ where: eq(userTable.id, purchase.userId) }),
    db.query.competitionRegistrationsTable.findFirst({
      where: eq(competitionRegistrationsTable.id, registrationId),
    }),
  ])
  if (!competition) throw new Error(`Competition not found: ${competitionId}`)

  const isFree =
    registrationData.isFreeRegistration === true || purchase.totalCents === 0
  const teamName = registrationData.teamName ?? registration?.teamName ?? null
  return {
    registrationId,
    userId: purchase.userId,
    competitionId,
    divisionId,
    purchaseId: purchase.id,
    amountTotal: purchase.totalCents,
    customerEmail: session.customer_email,
    userName: user
      ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || null
      : null,
    competitionName: competition.name,
    divisionName: division?.label ?? null,
    teamName,
    registrationDivisionId: divisionId,
    registrationTeamName: teamName,
    registrationPendingTeammates: registration?.pendingTeammates ?? null,
    competitionSlug: competition.slug,
    competitionStartDate: competition.startDate,
    userEmail: user?.email ?? null,
    userFirstName: user?.firstName ?? null,
    inviteId: registrationData.inviteId ?? null,
    isPaid: !isFree,
  }
}

async function refundCheckoutPurchase(
  session: CheckoutCompletedParams["session"],
  purchase: CommercePurchase,
  reason: string,
  kind: "registration" | "addon",
): Promise<void> {
  const db = getDb()
  if (purchase.status === COMMERCE_PURCHASE_STATUS.COMPLETED) return

  let refundId: string | undefined
  if (purchase.totalCents > 0) {
    if (!session.payment_intent) {
      throw new Error(`Cannot refund ${purchase.id}: missing payment intent`)
    }
    try {
      const refund = await getStripe().refunds.create(
        {
          payment_intent: session.payment_intent,
          amount: purchase.totalCents,
          reverse_transfer: true,
          refund_application_fee: false,
          reason: "requested_by_customer",
          metadata: {
            purchaseId: purchase.id,
            kind: `${kind}_auto_refund`,
          },
        },
        { idempotencyKey: `checkout-auto-refund:${purchase.id}` },
      )
      refundId = refund.id
    } catch (error) {
      logError({
        message: "[Workflow] Failed to issue automatic refund",
        error: error instanceof Error ? error : new Error(String(error)),
        attributes: {
          purchaseId: purchase.id,
          paymentIntentId: session.payment_intent,
          kind,
        },
      })
      // Leave an add-on PENDING (or a registration FAILED) and fail the
      // durable step. The stable idempotency key makes the retry safe.
      throw error
    }
  }

  await db
    .update(commercePurchaseTable)
    .set({
      status: COMMERCE_PURCHASE_STATUS.FAILED,
      stripePaymentIntentId: session.payment_intent ?? undefined,
      completedAt: new Date(),
    })
    .where(eq(commercePurchaseTable.id, purchase.id))

  const competition = purchase.competitionId
    ? await db.query.competitionsTable.findFirst({
        where: eq(competitionsTable.id, purchase.competitionId),
        columns: { organizingTeamId: true },
      })
    : null
  if (refundId && competition && session.payment_intent) {
    try {
      await recordRefundCompleted({
        purchaseId: purchase.id,
        teamId: competition.organizingTeamId,
        amountCents: purchase.totalCents,
        stripePaymentIntentId: session.payment_intent,
        stripeRefundId: refundId,
        reason,
      })
    } catch (eventError) {
      logWarning({
        message: "[Workflow] Failed to record automatic refund event",
        error: eventError,
        attributes: { purchaseId: purchase.id, refundId },
      })
    }
  }

  logInfo({
    message: "[Workflow] Automatic refund completed",
    attributes: {
      purchaseId: purchase.id,
      refundId,
      amountCents: purchase.totalCents,
      kind,
      reason,
    },
  })
}

/**
 * Complete an ADDON (registration merch) purchase after registration lines
 * reach terminal states for the same Checkout Session.
 *
 * Responsibilities:
 *  1. Stock: atomically increment the variant's soldQty with a conditional
 *     UPDATE; zero rows affected means the variant oversold during payment
 *     → partial-refund just this line, then mark FAILED.
 *     Deadline-only products need no re-check — availability was validated
 *     at checkout creation and Stripe's session expiry bounds the race.
 *  3. Mark COMPLETED + record the PAYMENT_COMPLETED financial event.
 */
// @lat: [[commerce#Registration Add-ons#Checkout Session Settlement]]
async function completeAddonPurchase(
  session: CheckoutCompletedParams["session"],
  purchase: CommercePurchase,
): Promise<void> {
  const db = getDb()

  if (purchase.status !== COMMERCE_PURCHASE_STATUS.PENDING) {
    logInfo({
      message: "[Workflow] Add-on purchase not pending, skipping",
      attributes: { purchaseId: purchase.id, status: purchase.status },
    })
    return
  }

  const competition = purchase.competitionId
    ? await db.query.competitionsTable.findFirst({
        where: eq(competitionsTable.id, purchase.competitionId),
        columns: { id: true, organizingTeamId: true },
      })
    : null

  // Stock claim and completion in ONE transaction, gated by the
  // conditional PENDING→COMPLETED transition. The workflow step retries the
  // whole function on a transient failure; without the transaction a retry
  // after a successful soldQty increment (but before the status write) would
  // claim the stock a second time. With it, either both writes committed
  // (retry short-circuits on the status guard) or neither did.
  // Thrown inside the transaction to roll back a stock claim when a
  // concurrent run already completed this purchase.
  class AddonAlreadyProcessed extends Error {}

  let outcome: "completed" | "oversold"
  try {
    outcome = await db.transaction(async (tx) => {
      // Atomic stock claim (only for variant-tracked products). Zero rows
      // affected = the variant oversold during payment.
      if (purchase.variantId) {
        const claimResult = await tx
          .update(competitionProductVariantsTable)
          .set({
            soldQty: sql`${competitionProductVariantsTable.soldQty} + ${purchase.quantity}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(competitionProductVariantsTable.id, purchase.variantId),
              or(
                isNull(competitionProductVariantsTable.stockQty),
                sql`${competitionProductVariantsTable.soldQty} + ${purchase.quantity} <= ${competitionProductVariantsTable.stockQty}`,
              ),
            ),
          )
        if (affectedRows(claimResult) === 0) {
          // Nothing written yet — safe to return and refund outside.
          return "oversold" as const
        }
      }

      const completeResult = await tx
        .update(commercePurchaseTable)
        .set({
          status: COMMERCE_PURCHASE_STATUS.COMPLETED,
          stripePaymentIntentId: session.payment_intent ?? undefined,
          completedAt: new Date(),
        })
        .where(
          and(
            eq(commercePurchaseTable.id, purchase.id),
            eq(commercePurchaseTable.status, COMMERCE_PURCHASE_STATUS.PENDING),
          ),
        )
      if (affectedRows(completeResult) === 0) {
        // A concurrent run already settled this purchase — abort so the
        // stock claim above rolls back instead of double-counting.
        throw new AddonAlreadyProcessed()
      }

      return "completed" as const
    })
  } catch (err) {
    if (err instanceof AddonAlreadyProcessed) {
      logInfo({
        message:
          "[Workflow] Add-on purchase already settled by a concurrent run, skipping",
        attributes: { purchaseId: purchase.id },
      })
      return
    }
    throw err
  }

  if (outcome === "oversold") {
    await refundCheckoutPurchase(
      session,
      purchase,
      "Add-on sold out during payment - automatic refund",
      "addon",
    )
    return
  }

  if (competition) {
    try {
      await recordPaymentCompleted({
        purchaseId: purchase.id,
        teamId: competition.organizingTeamId,
        totalCents: purchase.totalCents,
        platformFeeCents: purchase.platformFeeCents,
        stripeFeeCents: purchase.stripeFeeCents,
        organizerNetCents: purchase.organizerNetCents,
        stripePaymentIntentId: session.payment_intent ?? undefined,
      })
    } catch (eventErr) {
      logWarning({
        message: "[Workflow] Failed to record add-on payment event (non-fatal)",
        error: eventErr,
        attributes: { purchaseId: purchase.id },
      })
    }
  }

  logInfo({
    message: "[Workflow] Add-on purchase completed",
    attributes: {
      purchaseId: purchase.id,
      competitionId: purchase.competitionId,
      variantId: purchase.variantId,
      quantity: purchase.quantity,
      totalCents: purchase.totalCents,
    },
  })
}

async function createRegistration(
  session: CheckoutCompletedParams["session"],
  purchaseId: string,
  sessionPurchaseIds: string[],
): Promise<RegistrationStepResult | null> {
  const db = getDb()

  // IDEMPOTENCY CHECK 1: Get purchase and check status
  const existingPurchase = await db.query.commercePurchaseTable.findFirst({
    where: eq(commercePurchaseTable.id, purchaseId),
  })

  if (!existingPurchase) {
    logError({
      message: "[Workflow] Purchase not found",
      attributes: { purchaseId },
    })
    throw new Error(`Purchase not found: ${purchaseId}`)
  }

  if (
    existingPurchase.status === COMMERCE_PURCHASE_STATUS.FAILED ||
    existingPurchase.status === COMMERCE_PURCHASE_STATUS.CANCELLED
  ) {
    return null
  }

  // ADDON purchases (registration merch) complete without creating a
  // registration. Branch before the registration idempotency checks — they
  // key on divisionId, which add-on purchases don't have.
  const purchaseProduct = await db.query.commerceProductTable.findFirst({
    where: eq(commerceProductTable.id, existingPurchase.productId),
    columns: { type: true },
  })
  if (purchaseProduct?.type === COMMERCE_PRODUCT_TYPE.ADDON) {
    return null
  }
  if (!purchaseProduct) {
    throw new Error(`Product not found for registration purchase ${purchaseId}`)
  }

  const competitionId = existingPurchase.competitionId
  const divisionId = existingPurchase.divisionId
  const userId = existingPurchase.userId
  if (!competitionId || !divisionId) {
    throw new Error(`Registration purchase ${purchaseId} is missing context`)
  }
  const registrationData = parseRegistrationData(
    purchaseId,
    existingPurchase.metadata,
  )

  // IDEMPOTENCY CHECK 2: Check if registration already exists
  // Primary: by commercePurchaseId (set after registerForCompetition + update)
  const existingRegistration =
    await db.query.competitionRegistrationsTable.findFirst({
      where: eq(competitionRegistrationsTable.commercePurchaseId, purchaseId),
    })

  // Secondary: by (eventId, userId, divisionId) to catch partial failures where
  // registerForCompetition succeeded but the commercePurchaseId update failed
  const existingRegByUser = !existingRegistration
    ? await db.query.competitionRegistrationsTable.findFirst({
        where: and(
          eq(competitionRegistrationsTable.eventId, competitionId),
          eq(competitionRegistrationsTable.userId, userId),
          eq(competitionRegistrationsTable.divisionId, divisionId),
        ),
      })
    : null

  const regToReconcile = existingRegistration ?? existingRegByUser

  if (regToReconcile) {
    logInfo({
      message:
        "[Workflow] Registration already exists for purchase, ensuring purchase completed",
      attributes: {
        purchaseId,
        registrationId: regToReconcile.id,
        matchedBy: existingRegistration ? "purchaseId" : "eventId+userId",
      },
    })
    // Ensure registration is linked to purchase and has payment info
    if (!regToReconcile.commercePurchaseId) {
      await db
        .update(competitionRegistrationsTable)
        .set({
          commercePurchaseId: purchaseId,
          paymentStatus:
            existingPurchase.totalCents === 0
              ? COMMERCE_PAYMENT_STATUS.FREE
              : COMMERCE_PAYMENT_STATUS.PAID,
          paidAt: existingPurchase.totalCents === 0 ? null : new Date(),
        })
        .where(eq(competitionRegistrationsTable.id, regToReconcile.id))
    }
    // Ensure purchase is marked as completed
    await db
      .update(commercePurchaseTable)
      .set({
        status: COMMERCE_PURCHASE_STATUS.COMPLETED,
        stripePaymentIntentId: session.payment_intent ?? undefined,
        completedAt: new Date(),
      })
      .where(eq(commercePurchaseTable.id, purchaseId))
    return buildRegistrationStepResult({
      session,
      purchase: existingPurchase,
      registrationId: regToReconcile.id,
      registrationData,
    })
  }

  // Capacity check — direct DB query instead of createServerFn wrapper
  const competition = await db.query.competitionsTable.findFirst({
    where: eq(competitionsTable.id, competitionId),
  })

  if (!competition) {
    logError({
      message: "[Workflow] Competition not found for capacity check",
      attributes: { competitionId },
    })
    throw new Error(`Competition not found: ${competitionId}`)
  }

  const divisionConfig = await db.query.competitionDivisionsTable.findFirst({
    where: and(
      eq(competitionDivisionsTable.competitionId, competitionId),
      eq(competitionDivisionsTable.divisionId, divisionId),
    ),
  })

  const [registrations, pendingPurchases] = await Promise.all([
    db
      .select({ count: count() })
      .from(competitionRegistrationsTable)
      .where(
        and(
          eq(competitionRegistrationsTable.divisionId, divisionId),
          eq(competitionRegistrationsTable.eventId, competitionId),
          ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
        ),
      ),
    db
      .select({ count: count() })
      .from(commercePurchaseTable)
      .where(
        and(
          eq(commercePurchaseTable.competitionId, competitionId),
          eq(commercePurchaseTable.divisionId, divisionId),
          eq(commercePurchaseTable.status, COMMERCE_PURCHASE_STATUS.PENDING),
          gt(
            commercePurchaseTable.createdAt,
            new Date(Date.now() - PENDING_PURCHASE_MAX_AGE_MINUTES * 60 * 1000),
          ),
          sessionPurchaseIds.length > 0
            ? notInArray(commercePurchaseTable.id, sessionPurchaseIds)
            : undefined,
        ),
      ),
  ])

  const confirmedCount = Number(registrations[0]?.count ?? 0)
  const pendingCount = Number(pendingPurchases[0]?.count ?? 0)
  const capacity = calculateDivisionCapacity({
    registrationCount: confirmedCount,
    pendingCount,
    divisionMaxSpots: divisionConfig?.maxSpots,
    competitionDefaultMax: competition.defaultMaxSpotsPerDivision,
  })

  if (capacity.isFull) {
    logError({
      message: "[Workflow] Division filled during payment - refund needed",
      attributes: {
        purchaseId,
        competitionId,
        divisionId,
        userId,
        maxSpots: capacity.effectiveMax,
        registered: capacity.totalOccupied,
      },
    })

    await db
      .update(commercePurchaseTable)
      .set({
        status: COMMERCE_PURCHASE_STATUS.FAILED,
        completedAt: new Date(),
      })
      .where(eq(commercePurchaseTable.id, purchaseId))
    return null
  }

  // Competition-wide capacity re-check
  if (competition.maxTotalRegistrations != null) {
    const [compRegistrations, compPendingPurchases] = await Promise.all([
      db
        .select({ count: count() })
        .from(competitionRegistrationsTable)
        .where(
          and(
            eq(competitionRegistrationsTable.eventId, competitionId),
            ne(
              competitionRegistrationsTable.status,
              REGISTRATION_STATUS.REMOVED,
            ),
          ),
        ),
      db
        .select({ count: count() })
        .from(commercePurchaseTable)
        .where(
          and(
            eq(commercePurchaseTable.competitionId, competitionId),
            eq(commercePurchaseTable.status, COMMERCE_PURCHASE_STATUS.PENDING),
            // ADDON (merch) purchases share competitionId but have no
            // division and must not occupy registration capacity — an
            // athlete's own pending add-on would otherwise count against
            // their registration here and could trigger a wrongful
            // competition-full auto-refund.
            isNotNull(commercePurchaseTable.divisionId),
            gt(
              commercePurchaseTable.createdAt,
              new Date(
                Date.now() - PENDING_PURCHASE_MAX_AGE_MINUTES * 60 * 1000,
              ),
            ),
            sessionPurchaseIds.length > 0
              ? notInArray(commercePurchaseTable.id, sessionPurchaseIds)
              : undefined,
          ),
        ),
    ])

    const compCapacity = calculateCompetitionCapacity({
      registrationCount: Number(compRegistrations[0]?.count ?? 0),
      pendingCount: Number(compPendingPurchases[0]?.count ?? 0),
      maxTotalRegistrations: competition.maxTotalRegistrations,
    })

    if (compCapacity.isFull) {
      logError({
        message: "[Workflow] Competition filled during payment - refund needed",
        attributes: {
          purchaseId,
          competitionId,
          userId,
          maxTotalRegistrations: compCapacity.effectiveMax,
          registered: compCapacity.totalOccupied,
        },
      })

      await db
        .update(commercePurchaseTable)
        .set({
          status: COMMERCE_PURCHASE_STATUS.FAILED,
          completedAt: new Date(),
        })
        .where(eq(commercePurchaseTable.id, purchaseId))
      return null
    }
  }

  // If the athlete has an active claimable invite for this division, the
  // invite is the authorization to register and the public window does not
  // apply. `initiateRegistrationPaymentFn` already validated the invite at
  // payment time and persisted its id into purchase metadata — trust that
  // signal here instead of re-probing. Re-probing introduces a race: an
  // organizer revoking an invite between Stripe checkout and webhook
  // delivery would deny registration to an athlete who already paid.
  const inviteAuthorized = !!registrationData.inviteId

  // ADR-0012 Phase 5: per-(source, division) allocation guardrail —
  // authoritative re-check at payment confirmation. The claim-time gate
  // is best-effort UX; the genuine race (two athletes paying for the
  // last spot concurrently) is closed here. Pattern matches the existing
  // division-capacity-overflow handling above: mark purchase failed,
  // refund-and-fail. Bespoke invites (no sourceId) bypass.
  if (registrationData.inviteId) {
    const inviteRow = await db.query.competitionInvitesTable.findFirst({
      where: eq(competitionInvitesTable.id, registrationData.inviteId),
    })
    if (inviteRow?.sourceId) {
      // Authoritative re-check: count accepted_paid + in-flight pending
      // purchases in the bucket, excluding our own purchase row (which is
      // still PENDING at this point in the workflow). This closes the
      // millisecond race where two purchases initiate concurrently — only
      // the first webhook to reach this check sees occupiedCount = 0.
      const [allocation, occupiedCount] = await Promise.all([
        resolveAllocationForInvite({ invite: inviteRow }),
        getOccupiedCountForBucket({
          sourceId: inviteRow.sourceId,
          championshipCompetitionId: inviteRow.championshipCompetitionId,
          championshipDivisionId: inviteRow.championshipDivisionId,
          excludePurchaseId: purchaseId,
        }),
      ])
      const allocationCheck = assertInviteWithinAllocation({
        invite: { sourceId: inviteRow.sourceId },
        allocation: allocation ?? 0,
        acceptedCount: occupiedCount,
      })
      if (!allocationCheck.ok) {
        logError({
          message:
            "[Workflow] Invite allocation filled during payment - refund needed",
          attributes: {
            purchaseId,
            competitionId,
            divisionId,
            userId,
            inviteId: registrationData.inviteId,
            sourceId: inviteRow.sourceId,
            allocation,
            occupiedCount,
          },
        })

        await db
          .update(commercePurchaseTable)
          .set({
            status: COMMERCE_PURCHASE_STATUS.FAILED,
            completedAt: new Date(),
          })
          .where(eq(commercePurchaseTable.id, purchaseId))
        return null
      }
    }
  }

  // Create the registration
  try {
    const result = await registerForCompetition({
      competitionId,
      userId,
      divisionId,
      teamName: registrationData.teamName,
      affiliateName: registrationData.affiliateName,
      teammates: registrationData.teammates,
      isOrganizerOverride: inviteAuthorized,
    })

    // Update registration with payment info
    await db
      .update(competitionRegistrationsTable)
      .set({
        commercePurchaseId: purchaseId,
        paymentStatus: registrationData.isFreeRegistration
          ? COMMERCE_PAYMENT_STATUS.FREE
          : COMMERCE_PAYMENT_STATUS.PAID,
        paidAt: registrationData.isFreeRegistration ? null : new Date(),
      })
      .where(eq(competitionRegistrationsTable.id, result.registrationId))

    // Store registration answers if present
    if (registrationData.answers && registrationData.answers.length > 0) {
      await db.insert(competitionRegistrationAnswersTable).values(
        registrationData.answers.map((answer) => ({
          questionId: answer.questionId,
          registrationId: result.registrationId,
          userId,
          answer: answer.answer,
        })),
      )
    }

    // Mark purchase as completed
    await db
      .update(commercePurchaseTable)
      .set({
        status: COMMERCE_PURCHASE_STATUS.COMPLETED,
        stripePaymentIntentId: session.payment_intent ?? undefined,
        completedAt: new Date(),
      })
      .where(eq(commercePurchaseTable.id, purchaseId))

    // Record payment in financial event log
    try {
      await recordPaymentCompleted({
        purchaseId,
        teamId: competition.organizingTeamId,
        totalCents: existingPurchase.totalCents,
        platformFeeCents: existingPurchase.platformFeeCents,
        stripeFeeCents: existingPurchase.stripeFeeCents,
        organizerNetCents: existingPurchase.organizerNetCents,
        stripePaymentIntentId: session.payment_intent ?? undefined,
      })
    } catch (eventErr) {
      logWarning({
        message: "[Workflow] Failed to record payment event (non-fatal)",
        error: eventErr,
        attributes: { purchaseId },
      })
    }

    logInfo({
      message: "[Workflow] Registration created",
      attributes: {
        registrationId: result.registrationId,
        purchaseId,
        competitionId,
        userId,
      },
    })

    return buildRegistrationStepResult({
      session,
      purchase: existingPurchase,
      registrationId: result.registrationId,
      registrationData,
    })
  } catch (err) {
    logError({
      message: "[Workflow] Failed to create registration",
      error: err,
      attributes: { purchaseId, competitionId, userId },
    })
    // Re-throw to trigger step retry
    throw err
  }
}

/**
 * Flip the competition invite to `accepted_paid` after the Stripe webhook
 * confirms payment and the registration row exists.
 *
 * Idempotent: guarded by status=pending so a duplicate workflow run
 * won't trip the transition twice. Safe to retry. A zero-affected-rows
 * outcome just logs — the invite may already have been paid or revoked.
 */
async function updateCompetitionInviteStatus(
  result: RegistrationStepResult,
): Promise<void> {
  if (!result.inviteId) return

  const db = getDb()
  const now = new Date()

  const updateResult = await db
    .update(competitionInvitesTable)
    .set({
      status: COMPETITION_INVITE_STATUS.ACCEPTED_PAID,
      paidAt: now,
      claimedRegistrationId: result.registrationId,
      // Null the token so a replay of the old email link short-circuits.
      claimToken: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(competitionInvitesTable.id, result.inviteId),
        eq(competitionInvitesTable.status, COMPETITION_INVITE_STATUS.PENDING),
      ),
    )

  const affected =
    (updateResult as unknown as { rowsAffected?: number }).rowsAffected ??
    (updateResult as unknown as [{ affectedRows?: number }])[0]?.affectedRows ??
    0

  if (affected === 0) {
    logInfo({
      message:
        "[Workflow] Invite status flip skipped (already terminal or missing)",
      attributes: {
        inviteId: result.inviteId,
        registrationId: result.registrationId,
      },
    })
    return
  }

  logInfo({
    message: "[Workflow] Competition invite flipped to accepted_paid",
    attributes: {
      inviteId: result.inviteId,
      registrationId: result.registrationId,
      competitionId: result.competitionId,
    },
  })
}

async function sendConfirmationEmail(
  result: RegistrationStepResult,
): Promise<void> {
  try {
    await notifyRegistrationConfirmed({
      userId: result.userId,
      registrationId: result.registrationId,
      competitionId: result.competitionId,
      isPaid: result.isPaid,
      amountPaidCents: result.amountTotal ?? undefined,
      prefetched: {
        user: {
          id: result.userId,
          email: result.userEmail,
          firstName: result.userFirstName,
        },
        competition: {
          id: result.competitionId,
          name: result.competitionName,
          slug: result.competitionSlug,
          startDate: result.competitionStartDate,
        },
        registration: {
          id: result.registrationId,
          divisionId: result.registrationDivisionId,
          teamName: result.registrationTeamName,
          pendingTeammates: result.registrationPendingTeammates,
        },
        divisionName: result.divisionName ?? undefined,
      },
    })
  } catch (emailErr) {
    logError({
      message: "[Workflow] Failed to send confirmation email",
      error: emailErr,
      attributes: {
        purchaseId: result.purchaseId,
        competitionId: result.competitionId,
        userId: result.userId,
        registrationId: result.registrationId,
      },
    })
    throw emailErr
  }
}

async function processCheckoutSession(
  session: CheckoutCompletedParams["session"],
): Promise<RegistrationStepResult[]> {
  const db = getDb()
  const sessionPurchaseIds = session.metadata.purchaseIds ?? []
  const purchaseIds = [
    ...new Set(
      (sessionPurchaseIds.length > 0
        ? sessionPurchaseIds
        : session.metadata.purchaseId
          ? [session.metadata.purchaseId]
          : []
      ).filter(Boolean),
    ),
  ]
  if (purchaseIds.length === 0) {
    throw new Error("Checkout Session has no purchase IDs")
  }

  const purchases = await db.query.commercePurchaseTable.findMany({
    where: inArray(commercePurchaseTable.id, purchaseIds),
  })
  if (purchases.length !== purchaseIds.length) {
    const found = new Set(purchases.map((purchase) => purchase.id))
    throw new Error(
      `Checkout Session references missing purchases: ${purchaseIds.filter((id) => !found.has(id)).join(",")}`,
    )
  }
  const products = await db.query.commerceProductTable.findMany({
    where: inArray(commerceProductTable.id, [
      ...new Set(purchases.map((purchase) => purchase.productId)),
    ]),
    columns: { id: true, type: true },
  })
  const productTypeById = new Map(
    products.map((product) => [product.id, product.type]),
  )
  const registrationPurchases = purchases.filter(
    (purchase) =>
      productTypeById.get(purchase.productId) !== COMMERCE_PRODUCT_TYPE.ADDON,
  )
  const addonPurchases = purchases.filter(
    (purchase) =>
      productTypeById.get(purchase.productId) === COMMERCE_PRODUCT_TYPE.ADDON,
  )

  // Registration lines are authoritative and always settle before merch.
  const registrationResults: RegistrationStepResult[] = []
  for (const purchase of registrationPurchases) {
    const result = await createRegistration(session, purchase.id, purchaseIds)
    if (result) registrationResults.push(result)
  }

  const settledRegistrations = registrationPurchases.length
    ? await db.query.commercePurchaseTable.findMany({
        where: inArray(
          commercePurchaseTable.id,
          registrationPurchases.map((purchase) => purchase.id),
        ),
      })
    : []
  const nonterminalRegistration = settledRegistrations.find(
    (purchase) =>
      purchase.status === COMMERCE_PURCHASE_STATUS.PENDING ||
      purchase.status === COMMERCE_PURCHASE_STATUS.CANCELLED,
  )
  if (nonterminalRegistration) {
    throw new Error(
      `Registration purchase did not reach a terminal state: ${nonterminalRegistration.id}`,
    )
  }

  const completedRegistrationCount = settledRegistrations.filter(
    (purchase) => purchase.status === COMMERCE_PURCHASE_STATUS.COMPLETED,
  ).length
  for (const purchase of settledRegistrations) {
    if (purchase.status === COMMERCE_PURCHASE_STATUS.FAILED) {
      await refundCheckoutPurchase(
        session,
        purchase,
        "Registration could not be completed after payment",
        "registration",
      )
    }
  }

  for (const originalPurchase of addonPurchases) {
    const purchase = await db.query.commercePurchaseTable.findFirst({
      where: eq(commercePurchaseTable.id, originalPurchase.id),
    })
    if (!purchase)
      throw new Error(`Add-on purchase not found: ${originalPurchase.id}`)
    if (registrationPurchases.length > 0 && completedRegistrationCount === 0) {
      await refundCheckoutPurchase(
        session,
        purchase,
        "All registrations in this checkout failed",
        "addon",
      )
      continue
    }
    await completeAddonPurchase(session, purchase)
  }

  if (
    session.metadata.couponId &&
    completedRegistrationCount > 0 &&
    Number(session.metadata.couponDiscountCents || 0) > 0
  ) {
    try {
      await recordRedemption({
        couponId: session.metadata.couponId,
        userId: session.metadata.userId,
        purchaseId:
          settledRegistrations.find(
            (purchase) =>
              purchase.status === COMMERCE_PURCHASE_STATUS.COMPLETED,
          )?.id ?? null,
        competitionId: session.metadata.competitionId,
        amountOffCents: Number(session.metadata.couponDiscountCents),
      })
    } catch (couponError) {
      logWarning({
        message: "[Workflow] Coupon redemption recording failed",
        error: couponError,
        attributes: {
          couponId: session.metadata.couponId,
          checkoutSessionId: session.id,
        },
      })
    }
  }

  return registrationResults
}

async function sendSlackNotification(
  result: RegistrationStepResult,
  session: CheckoutCompletedParams["session"],
): Promise<void> {
  try {
    await notifyCompetitionRegistration({
      amountCents: result.amountTotal ?? 0,
      customerEmail: session.customer_email ?? result.userEmail ?? undefined,
      customerName: result.userName ?? undefined,
      competitionName: result.competitionName,
      divisionName: result.divisionName ?? undefined,
      teamName: result.teamName ?? undefined,
      purchaseId: result.purchaseId,
    })
  } catch (slackErr) {
    logWarning({
      message: "[Workflow] Failed to send Slack notification",
      error: slackErr,
      attributes: {
        purchaseId: result.purchaseId,
        competitionId: result.competitionId,
        userId: result.userId,
      },
    })
    throw slackErr
  }
}

// =========================================================================
// Cloudflare Workflow class (production — durable execution with retries)
// =========================================================================

// @lat: [[registration#Stripe Checkout Workflow]]
class StripeCheckoutWorkflowBase extends WorkflowEntrypoint<
  Env,
  CheckoutCompletedParams
> {
  async run(event: WorkflowEvent<CheckoutCompletedParams>, step: WorkflowStep) {
    const { session } = event.payload
    const { competitionId } = session.metadata

    // The entire Checkout Session is one durable critical section. This
    // guarantees registration outcomes are known before merch is completed
    // or refunded.
    const registrationResults = await step.do(
      "process-checkout-session",
      {
        retries: { limit: 3, delay: "1 second", backoff: "exponential" },
      },
      async () => {
        return await processCheckoutSession(session)
      },
    )

    if (registrationResults.length === 0) {
      logInfo({
        message:
          "[Workflow] Checkout session settled without new registration notifications",
        attributes: {
          purchaseIds: session.metadata.purchaseIds?.join(",") ?? "",
          competitionId,
        },
      })
      return
    }

    for (const registrationResult of registrationResults) {
      await step.do(
        `update-competition-invite-${registrationResult.purchaseId}`,
        {
          retries: { limit: 3, delay: "1 second", backoff: "exponential" },
        },
        async () => {
          await updateCompetitionInviteStatus(registrationResult)
        },
      )

      try {
        await step.do(
          `send-confirmation-email-${registrationResult.purchaseId}`,
          {
            retries: { limit: 3, delay: "2 seconds", backoff: "exponential" },
          },
          async () => {
            await sendConfirmationEmail(registrationResult)
          },
        )
      } catch (emailErr) {
        logWarning({
          message:
            "[Workflow] Email step failed after retries, continuing to Slack",
          error: emailErr,
          attributes: {
            purchaseId: registrationResult.purchaseId,
            registrationId: registrationResult.registrationId,
          },
        })
      }

      try {
        await step.do(
          `send-slack-notification-${registrationResult.purchaseId}`,
          {
            retries: { limit: 2, delay: "1 second", backoff: "linear" },
          },
          async () => {
            await sendSlackNotification(registrationResult, session)
          },
        )
      } catch (slackErr) {
        logWarning({
          message: "[Workflow] Slack step failed after retries",
          error: slackErr,
          attributes: {
            purchaseId: registrationResult.purchaseId,
            registrationId: registrationResult.registrationId,
          },
        })
      }
    }
  }
}

export const StripeCheckoutWorkflow = Sentry.instrumentWorkflowWithSentry(
  (env: Env) => getSentryOptions(env),
  StripeCheckoutWorkflowBase,
)

// =========================================================================
// Inline processing (local dev fallback — no durable execution)
// =========================================================================

/**
 * Process checkout synchronously without Cloudflare Workflows.
 * Used in local dev where the STRIPE_CHECKOUT_WORKFLOW binding isn't available.
 * Notification failures are caught and logged (non-critical).
 */
export async function processCheckoutInline(
  params: CheckoutCompletedParams,
): Promise<void> {
  const { session } = params
  const registrationResults = await processCheckoutSession(session)

  for (const registrationResult of registrationResults) {
    await updateCompetitionInviteStatus(registrationResult)

    try {
      await sendConfirmationEmail(registrationResult)
    } catch (err) {
      logWarning({
        message: "[Inline Checkout] Email notification failed, continuing",
        error: err,
        attributes: {
          purchaseId: registrationResult.purchaseId,
          competitionId: registrationResult.competitionId,
        },
      })
    }

    try {
      await sendSlackNotification(registrationResult, session)
    } catch (err) {
      logWarning({
        message: "[Inline Checkout] Slack notification failed, continuing",
        error: err,
        attributes: {
          purchaseId: registrationResult.purchaseId,
          competitionId: registrationResult.competitionId,
        },
      })
    }
  }
}
