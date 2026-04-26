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
import { and, count, eq, gt, ne, sql } from "drizzle-orm"
import { getDb } from "@/db"
import {
  COMMERCE_PAYMENT_STATUS,
  COMMERCE_PURCHASE_STATUS,
  COMPETITION_INVITE_STATUS,
  commercePurchaseTable,
  competitionDivisionsTable,
  competitionInvitesTable,
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
  notifyRegistrationConfirmed,
  registerForCompetition,
} from "@/server/registration"
import { recordRedemption, cleanupStripeCoupon } from "@/server/coupons"
import {
  recordPaymentCompleted,
  recordRefundCompleted,
} from "@/server/commerce/financial-events"
import { PENDING_PURCHASE_MAX_AGE_MINUTES } from "@/server-fns/competition-divisions-fns"
import { calculateDivisionCapacity } from "@/utils/division-capacity"
import { calculateCompetitionCapacity } from "@/utils/competition-capacity"

export interface CheckoutCompletedParams {
  stripeEventId: string
  session: {
    id: string
    payment_intent: string | null
    amount_total: number | null
    customer_email: string | null
    metadata: {
      purchaseId: string
      competitionId: string
      divisionId: string
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
}

// =========================================================================
// Standalone processing functions (used by both Workflow and inline fallback)
// =========================================================================

async function createRegistration(
  session: CheckoutCompletedParams["session"],
): Promise<RegistrationStepResult | null> {
  const db = getDb()
  const { purchaseId, competitionId, divisionId, userId } = session.metadata

  // IDEMPOTENCY CHECK 1: Get purchase and check status
  const existingPurchase = await db.query.commercePurchaseTable.findFirst({
    where: eq(commercePurchaseTable.id, purchaseId),
  })

  if (!existingPurchase) {
    logError({
      message: "[Workflow] Purchase not found",
      attributes: { purchaseId },
    })
    return null
  }

  if (existingPurchase.status === COMMERCE_PURCHASE_STATUS.COMPLETED) {
    logInfo({
      message: "[Workflow] Purchase already completed, skipping registration",
      attributes: { purchaseId },
    })
    return null
  }

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
          paymentStatus: COMMERCE_PAYMENT_STATUS.PAID,
          paidAt: new Date(),
        })
        .where(eq(competitionRegistrationsTable.id, regToReconcile.id))
    }
    // Ensure purchase is marked as completed
    await db
      .update(commercePurchaseTable)
      .set({
        status: COMMERCE_PURCHASE_STATUS.COMPLETED,
        completedAt: new Date(),
      })
      .where(eq(commercePurchaseTable.id, purchaseId))
    return null
  }

  // Parse stored registration data from purchase metadata
  let registrationData: {
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
  } = {}

  if (existingPurchase.metadata) {
    try {
      registrationData = JSON.parse(existingPurchase.metadata)
    } catch {
      logWarning({
        message: "[Workflow] Failed to parse purchase metadata",
        attributes: { purchaseId },
      })
    }
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
    return null
  }

  const divisionConfig = await db.query.competitionDivisionsTable.findFirst({
    where: and(
      eq(competitionDivisionsTable.competitionId, competitionId),
      eq(competitionDivisionsTable.divisionId, divisionId),
    ),
  })

  // Fetch division label separately for notification display
  const divisionRecord = await db.query.scalingLevelsTable.findFirst({
    where: eq(scalingLevelsTable.id, divisionId),
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
          gt(commercePurchaseTable.createdAt, new Date(Date.now() - PENDING_PURCHASE_MAX_AGE_MINUTES * 60 * 1000)),
          sql`${commercePurchaseTable.id} != ${purchaseId}`,
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

    // Mark purchase as failed
    await db
      .update(commercePurchaseTable)
      .set({
        status: COMMERCE_PURCHASE_STATUS.FAILED,
        completedAt: new Date(),
      })
      .where(eq(commercePurchaseTable.id, purchaseId))

    // Trigger automatic refund
    if (session.payment_intent) {
      try {
        const stripe = getStripe()
        const refund = await stripe.refunds.create({
          payment_intent: session.payment_intent,
          reason: "requested_by_customer",
        })
        logInfo({
          message: "[Workflow] Refund issued for division-full scenario",
          attributes: {
            purchaseId,
            paymentIntentId: session.payment_intent,
            refundId: refund.id,
          },
        })

        // Record refund in financial event log
        try {
          await recordRefundCompleted({
            purchaseId,
            teamId: competition.organizingTeamId,
            amountCents: existingPurchase.totalCents,
            stripePaymentIntentId: session.payment_intent,
            stripeRefundId: refund.id,
            reason:
              "Division filled during payment - automatic refund",
          })
        } catch (eventErr) {
          logWarning({
            message:
              "[Workflow] Failed to record refund event (non-fatal)",
            error: eventErr,
            attributes: { purchaseId },
          })
        }
      } catch (refundError) {
        logError({
          message: "[Workflow] Failed to issue automatic refund",
          error:
            refundError instanceof Error
              ? refundError
              : new Error(String(refundError)),
          attributes: {
            purchaseId,
            paymentIntentId: session.payment_intent,
          },
        })
      }
    }

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
            gt(commercePurchaseTable.createdAt, new Date(Date.now() - PENDING_PURCHASE_MAX_AGE_MINUTES * 60 * 1000)),
            sql`${commercePurchaseTable.id} != ${purchaseId}`,
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
        message:
          "[Workflow] Competition filled during payment - refund needed",
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

      if (session.payment_intent) {
        try {
          const stripe = getStripe()
          const refund = await stripe.refunds.create({
            payment_intent: session.payment_intent,
            reason: "requested_by_customer",
          })
          logInfo({
            message:
              "[Workflow] Refund issued for competition-full scenario",
            attributes: {
              purchaseId,
              paymentIntentId: session.payment_intent,
              refundId: refund.id,
            },
          })

          // Record refund in financial event log
          try {
            await recordRefundCompleted({
              purchaseId,
              teamId: competition.organizingTeamId,
              amountCents: existingPurchase.totalCents,
              stripePaymentIntentId: session.payment_intent,
              stripeRefundId: refund.id,
              reason:
                "Competition filled during payment - automatic refund",
            })
          } catch (eventErr) {
            logWarning({
              message:
                "[Workflow] Failed to record refund event (non-fatal)",
              error: eventErr,
              attributes: { purchaseId },
            })
          }
        } catch (refundError) {
          logError({
            message: "[Workflow] Failed to issue automatic refund",
            error:
              refundError instanceof Error
                ? refundError
                : new Error(String(refundError)),
            attributes: {
              purchaseId,
              paymentIntentId: session.payment_intent,
            },
          })
        }
      }

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
        paymentStatus: COMMERCE_PAYMENT_STATUS.PAID,
        paidAt: new Date(),
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
        message:
          "[Workflow] Failed to record payment event (non-fatal)",
        error: eventErr,
        attributes: { purchaseId },
      })
    }

    // Record coupon redemption if present
    if (session.metadata.couponId && session.metadata.stripeCouponId) {
      try {
        await recordRedemption({
          couponId: session.metadata.couponId,
          userId,
          purchaseId,
          competitionId,
          amountOffCents: Number(session.metadata.couponDiscountCents || 0),
          stripeCouponId: session.metadata.stripeCouponId,
        })
        await cleanupStripeCoupon(session.metadata.stripeCouponId)
      } catch (couponErr) {
        logWarning({
          message: "[Workflow] Coupon redemption/cleanup failed (non-fatal)",
          error: couponErr,
          attributes: { purchaseId, couponId: session.metadata.couponId },
        })
      }
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

    // Fetch user for notifications
    const user = await db.query.userTable.findFirst({
      where: eq(userTable.id, userId),
    })

    return {
      registrationId: result.registrationId,
      userId,
      competitionId,
      divisionId,
      purchaseId,
      amountTotal: session.amount_total,
      customerEmail: session.customer_email,
      userName: user
        ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || null
        : null,
      competitionName: competition.name,
      divisionName: divisionRecord?.label ?? null,
      teamName: registrationData.teamName ?? null,
      registrationDivisionId: divisionId,
      registrationTeamName: registrationData.teamName ?? null,
      registrationPendingTeammates: null,
      competitionSlug: competition.slug,
      competitionStartDate: competition.startDate,
      userEmail: user?.email ?? null,
      userFirstName: user?.firstName ?? null,
      inviteId: registrationData.inviteId ?? null,
    }
  } catch (err) {
    logError({
      message: "[Workflow] Failed to create registration",
      error: err,
      attributes: { purchaseId, competitionId, userId },
    })
    await db
      .update(commercePurchaseTable)
      .set({ status: COMMERCE_PURCHASE_STATUS.FAILED })
      .where(eq(commercePurchaseTable.id, purchaseId))
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
      claimTokenHash: null,
      claimTokenLast4: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(competitionInvitesTable.id, result.inviteId),
        eq(
          competitionInvitesTable.status,
          COMPETITION_INVITE_STATUS.PENDING,
        ),
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
      isPaid: true,
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

async function sendSlackNotification(
  result: RegistrationStepResult,
  session: CheckoutCompletedParams["session"],
): Promise<void> {
  try {
    await notifyCompetitionRegistration({
      amountCents: session.amount_total ?? 0,
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
    const { purchaseId, competitionId } = session.metadata

    // Step 1: Core registration (critical path)
    const registrationResult = await step.do(
      "create-registration",
      {
        retries: { limit: 3, delay: "1 second", backoff: "exponential" },
      },
      async () => {
        return await createRegistration(session)
      },
    )

    if (!registrationResult) {
      logInfo({
        message:
          "[Workflow] Registration step returned null, skipping notifications",
        attributes: { purchaseId, competitionId },
      })
      return
    }

    // Step 2a: Flip competition invite status to `accepted_paid` when the
    // purchase originated from an invite. Critical for invite-backed
    // purchases — silently continuing on failure would strand the invite
    // in `pending` forever, because Cloudflare Workflows cache successful
    // step outputs and a re-running workflow would skip step 1 (already
    // succeeded) without re-attempting this step. Surface the failure so
    // the workflow itself fails and gets retried by Stripe's webhook
    // delivery, or alerts on a permanent fault.
    await step.do(
      "update-competition-invite-status",
      {
        retries: { limit: 3, delay: "1 second", backoff: "exponential" },
      },
      async () => {
        await updateCompetitionInviteStatus(registrationResult)
      },
    )

    // Step 2: Send confirmation email (non-critical, retries independently)
    // Wrapped in try-catch so email failure doesn't block Slack notification
    try {
      await step.do(
        "send-confirmation-email",
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
          purchaseId,
          registrationId: registrationResult.registrationId,
        },
      })
    }

    // Step 3: Send Slack notification (non-critical, retries independently)
    try {
      await step.do(
        "send-slack-notification",
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
          purchaseId,
          registrationId: registrationResult.registrationId,
        },
      })
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

  const registrationResult = await createRegistration(session)

  if (!registrationResult) {
    return
  }

  try {
    await updateCompetitionInviteStatus(registrationResult)
  } catch (err) {
    logWarning({
      message: "[Inline Checkout] Invite status flip failed, continuing",
      error: err,
      attributes: {
        purchaseId: registrationResult.purchaseId,
        inviteId: registrationResult.inviteId ?? null,
      },
    })
  }

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
