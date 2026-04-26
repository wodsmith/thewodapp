/**
 * Registration Server Functions for TanStack Start
 *
 * This file uses top-level imports for server-only modules.
 * Port of commerce.action.ts registration functions
 *
 * OBSERVABILITY:
 * - All registration operations are logged with request context
 * - Registration IDs, competition IDs, and payment info are tracked
 * - Payment flow states (pending, completed, cancelled) are logged
 */

import { createId } from "@paralleldrive/cuid2"
import { createServerFn } from "@tanstack/react-start"
import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm"
import type Stripe from "stripe"
import { z } from "zod"
import { CLAIM_TOKEN_EXPIRATION_SECONDS } from "@/constants"
import { getDb } from "@/db"
import type { ProductCoupon } from "@/db/schema"
import {
  affiliatesTable,
  COMMERCE_PAYMENT_STATUS,
  COMMERCE_PRODUCT_TYPE,
  COMMERCE_PURCHASE_STATUS,
  commerceProductTable,
  commercePurchaseTable,
  competitionEventsTable,
  competitionHeatAssignmentsTable,
  competitionRegistrationAnswersTable,
  competitionRegistrationQuestionsTable,
  competitionRegistrationsTable,
  competitionsTable,
  createCommerceProductId,
  createCommercePurchaseId,
  createTeamId,
  createTeamMembershipId,
  createUserId,
  REGISTRATION_STATUS,
  ROLES_ENUM,
  scalingGroupsTable,
  scalingLevelsTable,
  scoresTable,
  TEAM_PERMISSIONS,
  teamInvitationTable,
  teamMembershipTable,
  teamTable,
  userTable,
} from "@/db/schema"
import {
  buildFeeConfig,
  calculateCompetitionFees,
  type FeeBreakdown,
  getRegistrationFee,
  type TeamFeeOverrides,
} from "@/lib/commerce-stubs"
import { getAppUrl } from "@/lib/env"
import { getEvlog } from "@/lib/evlog"
import {
  addRequestContextAttribute,
  logEntityCreated,
  logInfo,
  logWarning,
  updateRequestContext,
} from "@/lib/logging"
import {
  notifyRegistrationConfirmed,
  registerForCompetition,
} from "@/lib/registration-stubs"
import { getStripe } from "@/lib/stripe"
import {
  COMPETITION_INVITE_STATUS,
  competitionInvitesTable,
} from "@/db/schemas/competition-invites"
import {
  assertInviteClaimable,
  findActiveInviteForEmail,
  resolveInviteForClaim,
} from "@/server/competition-invites/claim"
import { normalizeInviteEmail } from "@/server/competition-invites/issue"
import { recordRedemption, validateCoupon } from "@/server/coupons"
import { requireVerifiedEmail } from "@/utils/auth"
import { createToken, getClaimTokenKey } from "@/utils/auth-utils"
import {
  DEFAULT_TIMEZONE,
  hasDateStartedInTimezone,
  isDeadlinePassedInTimezone,
} from "@/utils/timezone-utils"
import {
  getCompetitionSpotsAvailableFn,
  getDivisionSpotsAvailableFn,
} from "./competition-divisions-fns"

// ============================================================================
// Input Schemas
// ============================================================================

const registrationItemSchema = z.object({
  divisionId: z.string().min(1, "Division ID is required"),
  teamName: z.string().optional(),
  teammates: z
    .array(
      z.object({
        email: z.string().email(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        affiliateName: z.string().max(255).optional(),
      }),
    )
    .optional(),
})

const initiateRegistrationPaymentInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  // Multi-division support: array of division entries
  items: z
    .array(registrationItemSchema)
    .min(1, "At least one division is required")
    .refine(
      (items) => new Set(items.map((i) => i.divisionId)).size === items.length,
      { message: "Duplicate division selections are not allowed" },
    ),
  // Shared fields
  affiliateName: z.string().max(255).optional(),
  couponCode: z.string().max(100).optional(),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        answer: z.string().max(5000),
      }),
    )
    .optional(),
  /**
   * Optional competition-invite claim token. When present:
   *  - re-validates the invite (email-locked to the session),
   *  - skips the registration-window check (invite-holders can register
   *    before public open / after close),
   *  - tags the Stripe purchase metadata with `inviteId` so the webhook
   *    workflow can flip the invite to `accepted_paid`.
   */
  inviteToken: z.string().min(1).optional(),
})

const getRegistrationFeeBreakdownInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  divisionId: z.string().min(1, "Division ID is required"),
})

const getUserCompetitionRegistrationInputSchema = z.object({
  competitionId: z.string().min(1, "Competition ID is required"),
  userId: z.string().min(1, "User ID is required"),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate that all required questions have answers
 * Throws error if required questions are missing
 */
async function validateRequiredQuestions(
  competitionId: string,
  answers: Array<{ questionId: string; answer: string }> | undefined,
): Promise<void> {
  const db = getDb()

  // Look up the competition's groupId
  const [competition] = await db
    .select({ groupId: competitionsTable.groupId })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))

  // Build where clause: competition-specific questions OR series-level questions
  // Only validate athlete-targeted questions (volunteer questions are separate)
  const conditions = [
    and(
      eq(competitionRegistrationQuestionsTable.competitionId, competitionId),
      eq(competitionRegistrationQuestionsTable.required, true),
      eq(competitionRegistrationQuestionsTable.questionTarget, "athlete"),
    ),
  ]
  if (competition?.groupId) {
    conditions.push(
      and(
        eq(competitionRegistrationQuestionsTable.groupId, competition.groupId),
        eq(competitionRegistrationQuestionsTable.required, true),
        eq(competitionRegistrationQuestionsTable.questionTarget, "athlete"),
      ),
    )
  }

  const requiredQuestions = await db
    .select()
    .from(competitionRegistrationQuestionsTable)
    .where(or(...conditions))

  if (requiredQuestions.length === 0) return

  // Check each required question has an answer
  const answerMap = new Map(answers?.map((a) => [a.questionId, a.answer]))

  const missingQuestions = requiredQuestions.filter(
    (q) => !answerMap.has(q.id) || !answerMap.get(q.id)?.trim(),
  )

  if (missingQuestions.length > 0) {
    throw new Error(
      `Please answer all required questions: ${missingQuestions.map((q) => q.label).join(", ")}`,
    )
  }
}

/**
 * Store registration answers in the database
 */
async function storeRegistrationAnswers(
  registrationId: string,
  userId: string,
  answers: Array<{ questionId: string; answer: string }> | undefined,
): Promise<void> {
  if (!answers || answers.length === 0) return

  const db = getDb()

  // Insert all answers in a single batch
  await db.insert(competitionRegistrationAnswersTable).values(
    answers.map((answer) => ({
      questionId: answer.questionId,
      registrationId,
      userId,
      answer: answer.answer,
    })),
  )
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Initiate payment for competition registration (supports multi-division)
 *
 * For FREE competitions ($0), creates registration directly.
 * For PAID competitions, creates pending purchase(s) + Stripe Checkout Session.
 * Registration is completed by webhook after payment succeeds.
 *
 * Supports registering for multiple divisions in a single checkout.
 * Each division becomes a separate line item and purchase record.
 */
// @lat: [[registration#Registration Flow#Athlete Self-Registration]]
export const initiateRegistrationPaymentFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    initiateRegistrationPaymentInputSchema.parse(data),
  )
  .handler(async ({ data: input }) => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    const db = getDb()
    const userId = session.user.id

    // Update request context with user and competition info
    updateRequestContext({ userId })
    addRequestContextAttribute("competitionId", input.competitionId)
    addRequestContextAttribute("divisionCount", input.items.length.toString())
    getEvlog()?.set({
      action: "register_for_competition",
      registration: { competitionId: input.competitionId },
    })

    logInfo({
      message: "[Registration] Payment initiation started",
      attributes: {
        competitionId: input.competitionId,
        divisionCount: input.items.length,
        divisionIds: input.items.map((i) => i.divisionId).join(","),
        hasInviteToken: !!input.inviteToken,
      },
    })

    // 1. Get competition and validate
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, input.competitionId),
    })
    if (!competition) {
      logWarning({
        message: "[Registration] Competition not found",
        attributes: { competitionId: input.competitionId },
      })
      throw new Error("Competition not found")
    }

    // 2. Invite-aware registration. The invite has its own lifecycle
    // (pending / expired / declined / revoked / accepted_paid) and is
    // independent of the public registration window: an organizer can
    // issue a last-minute invite after public registration has closed and
    // the invitee should still be able to register. A matching invite both
    // bypasses the window check and carries the `inviteId` through to
    // Stripe purchase metadata so the webhook workflow can flip the invite
    // to `accepted_paid`.
    //
    // Resolution order: explicit token first, then a per-item identity
    // probe so an athlete who navigates straight to /register (skipping
    // the claim CTA) still benefits if they have an active invite on file.
    const sessionEmail = normalizeInviteEmail(session.user.email ?? "")
    let inviteAuthorized = false
    let inviteIdForPurchase: string | null = null
    let inviteDivisionIdForPurchase: string | null = null
    if (input.inviteToken) {
      const { invite } = await resolveInviteForClaim(input.inviteToken)
      if (sessionEmail !== normalizeInviteEmail(invite.email)) {
        throw new Error("Invitation does not match this account")
      }
      if (invite.championshipCompetitionId !== input.competitionId) {
        throw new Error("Invitation is for a different competition")
      }
      if (input.items.length !== 1) {
        throw new Error(
          "Invite-based registrations must be for a single division",
        )
      }
      if (input.items[0].divisionId !== invite.championshipDivisionId) {
        throw new Error("Invitation is for a different division")
      }
      inviteAuthorized = true
      inviteIdForPurchase = invite.id
      inviteDivisionIdForPurchase = invite.championshipDivisionId
    } else if (sessionEmail && input.items.length === 1) {
      // No token — probe by identity. Active AND claimable
      // (assertInviteClaimable throws on expired etc.).
      const probe = await findActiveInviteForEmail({
        championshipCompetitionId: input.competitionId,
        championshipDivisionId: input.items[0].divisionId,
        email: sessionEmail,
      })
      if (probe) {
        try {
          assertInviteClaimable(probe)
          inviteAuthorized = true
          inviteIdForPurchase = probe.id
          inviteDivisionIdForPurchase = probe.championshipDivisionId
        } catch {
          // expired / declined / revoked etc — fall through to public-window
          // gating; the public flow will give the right error.
        }
      }
    }

    const competitionTimezone = competition.timezone || DEFAULT_TIMEZONE
    if (!inviteAuthorized) {
      if (
        !hasDateStartedInTimezone(
          competition.registrationOpensAt,
          competitionTimezone,
        )
      ) {
        throw new Error("Registration has not opened yet")
      }
      if (
        isDeadlinePassedInTimezone(
          competition.registrationClosesAt,
          competitionTimezone,
        )
      ) {
        throw new Error("Registration has closed")
      }
    }

    // 3. Check not already registered for any of these divisions (exclude removed registrations)
    for (const item of input.items) {
      const existingRegistration =
        await db.query.competitionRegistrationsTable.findFirst({
          where: and(
            eq(competitionRegistrationsTable.eventId, input.competitionId),
            eq(competitionRegistrationsTable.userId, userId),
            eq(competitionRegistrationsTable.divisionId, item.divisionId),
            ne(
              competitionRegistrationsTable.status,
              REGISTRATION_STATUS.REMOVED,
            ),
          ),
        })
      if (existingRegistration) {
        const division = await db.query.scalingLevelsTable.findFirst({
          where: eq(scalingLevelsTable.id, item.divisionId),
        })
        throw new Error(
          `You are already registered for ${division?.label ?? "this division"}`,
        )
      }
    }

    // 3.5. Check division capacity for all items
    for (const item of input.items) {
      const capacityCheck = await getDivisionSpotsAvailableFn({
        data: {
          competitionId: input.competitionId,
          divisionId: item.divisionId,
        },
      })
      if (capacityCheck.isFull) {
        const division = await db.query.scalingLevelsTable.findFirst({
          where: eq(scalingLevelsTable.id, item.divisionId),
        })
        throw new Error(
          `${division?.label ?? "This division"} is full. Please select a different division.`,
        )
      }
    }

    // 3.6. Check competition-wide capacity
    const competitionCapacity = await getCompetitionSpotsAvailableFn({
      data: { competitionId: input.competitionId },
    })
    if (
      competitionCapacity.available !== null &&
      competitionCapacity.available < input.items.length
    ) {
      throw new Error(
        competitionCapacity.available === 0
          ? "This competition is full. Registration is no longer available."
          : `Only ${competitionCapacity.available} spot${competitionCapacity.available === 1 ? "" : "s"} remaining in this competition.`,
      )
    }

    // 3.7. Validate required questions have answers
    await validateRequiredQuestions(input.competitionId, input.answers)

    // 4. Get registration fee for each division
    const itemFees = await Promise.all(
      input.items.map(async (item) => ({
        ...item,
        feeCents: await getRegistrationFee(
          input.competitionId,
          item.divisionId,
        ),
      })),
    )

    const totalFeeCents = itemFees.reduce((sum, item) => sum + item.feeCents, 0)

    // Coupon validation
    let couponDiscount = 0
    let validatedCoupon: ProductCoupon | null = null
    if (input.couponCode) {
      validatedCoupon = await validateCoupon(
        input.couponCode,
        input.competitionId,
      )
      if (!validatedCoupon) throw new Error("Invalid or expired coupon code")
      couponDiscount = Math.min(validatedCoupon.amountOffCents, totalFeeCents)
      logInfo({
        message: "[Registration] Coupon applied",
        attributes: {
          couponCode: input.couponCode,
          couponId: validatedCoupon.id,
          discountCents: couponDiscount,
          originalTotalCents: totalFeeCents,
        },
      })
    }

    // Adjust total after coupon
    const discountedTotalFeeCents = totalFeeCents - couponDiscount
    const allFree = discountedTotalFeeCents === 0

    // 5. For paid items, verify organizer has Stripe connected
    // Fetch organizing team once with all needed columns (also used for Stripe connection below)
    let teamFeeOverrides: TeamFeeOverrides | undefined
    const organizingTeam = !allFree
      ? await db.query.teamTable.findFirst({
          where: eq(teamTable.id, competition.organizingTeamId),
          columns: {
            stripeConnectedAccountId: true,
            stripeAccountStatus: true,
            organizerFeePercentage: true,
            organizerFeeFixed: true,
          },
        })
      : null

    if (!allFree) {
      if (organizingTeam?.stripeAccountStatus !== "VERIFIED") {
        throw new Error(
          "This competition is temporarily unable to accept paid registrations. " +
            "Please contact the organizer.",
        )
      }

      teamFeeOverrides = {
        organizerFeePercentage: organizingTeam.organizerFeePercentage,
        organizerFeeFixed: organizingTeam.organizerFeeFixed,
      }
    }

    // 6. ALL FREE - create registrations directly
    if (allFree) {
      let firstRegistrationId: string | null = null

      for (const item of input.items) {
        const result = await registerForCompetition({
          competitionId: input.competitionId,
          userId,
          divisionId: item.divisionId,
          teamName: item.teamName,
          affiliateName: input.affiliateName,
          teammates: item.teammates,
        })

        if (!firstRegistrationId) {
          firstRegistrationId = result.registrationId
        }

        // Mark as free registration
        await db
          .update(competitionRegistrationsTable)
          .set({ paymentStatus: COMMERCE_PAYMENT_STATUS.FREE })
          .where(eq(competitionRegistrationsTable.id, result.registrationId))

        // Store registration answers (shared across all divisions)
        await storeRegistrationAnswers(
          result.registrationId,
          userId,
          input.answers,
        )

        // Send registration confirmation email
        await notifyRegistrationConfirmed({
          userId,
          registrationId: result.registrationId,
          competitionId: input.competitionId,
          isPaid: false,
        })

        logEntityCreated({
          entity: "registration",
          id: result.registrationId,
          parentEntity: "competition",
          parentId: input.competitionId,
          attributes: {
            paymentStatus: "FREE",
            divisionId: item.divisionId,
          },
        })
      }

      logInfo({
        message: "[Registration] Free registration(s) completed",
        attributes: {
          competitionId: input.competitionId,
          divisionCount: input.items.length,
        },
      })

      // Mirror the Stripe-workflow invite flip when an invite-locked
      // checkout zeroes out (e.g. 100% coupon). The paid path tags
      // purchase metadata with `inviteId` and the workflow flips the
      // invite to `accepted_paid` post-webhook, but the free branch
      // skips Stripe entirely — so we have to flip inline or the invite
      // stays `pending` indefinitely. Guarded by status=pending so a
      // racing claim/decline doesn't get stomped.
      if (inviteIdForPurchase && firstRegistrationId) {
        const now = new Date()
        await db
          .update(competitionInvitesTable)
          .set({
            status: COMPETITION_INVITE_STATUS.ACCEPTED_PAID,
            paidAt: now,
            claimedRegistrationId: firstRegistrationId,
            claimToken: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(competitionInvitesTable.id, inviteIdForPurchase),
              eq(
                competitionInvitesTable.status,
                COMPETITION_INVITE_STATUS.PENDING,
              ),
            ),
          )
        logInfo({
          message: "[Registration] Free-checkout invite flipped to accepted_paid",
          attributes: {
            inviteId: inviteIdForPurchase,
            registrationId: firstRegistrationId,
            competitionId: input.competitionId,
          },
        })
      }

      // Record coupon redemption if a coupon covered the full amount
      if (validatedCoupon && couponDiscount > 0) {
        await recordRedemption({
          couponId: validatedCoupon.id,
          userId,
          purchaseId: null,
          competitionId: input.competitionId,
          amountOffCents: couponDiscount,
        })
      }

      return {
        purchaseId: null,
        checkoutUrl: null,
        totalCents: 0,
        isFree: true,
        registrationId: firstRegistrationId,
      }
    }

    // 7. PAID - Find or create product (idempotent)
    let product = await db.query.commerceProductTable.findFirst({
      where: and(
        eq(
          commerceProductTable.type,
          COMMERCE_PRODUCT_TYPE.COMPETITION_REGISTRATION,
        ),
        eq(commerceProductTable.resourceId, input.competitionId),
      ),
    })

    if (!product) {
      const productId = createCommerceProductId()
      await db.insert(commerceProductTable).values({
        id: productId,
        name: `Competition Registration - ${competition.name}`,
        type: COMMERCE_PRODUCT_TYPE.COMPETITION_REGISTRATION,
        resourceId: input.competitionId,
        priceCents: 0, // Individual item prices vary per division
      })
      product = await db.query.commerceProductTable.findFirst({
        where: eq(commerceProductTable.id, productId),
      })
    }

    if (!product) {
      throw new Error("Failed to get or create product")
    }

    // 8. Create purchase records and build line items for each division
    const feeConfig = buildFeeConfig(competition, teamFeeOverrides)
    const purchaseIds: string[] = []
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
    let totalChargeCents = 0
    let totalOrganizerNetCents = 0

    // Process free items immediately, create purchases for paid items
    for (const item of itemFees) {
      if (item.feeCents === 0) {
        // Register free division immediately
        const result = await registerForCompetition({
          competitionId: input.competitionId,
          userId,
          divisionId: item.divisionId,
          teamName: item.teamName,
          affiliateName: input.affiliateName,
          teammates: item.teammates,
        })

        await db
          .update(competitionRegistrationsTable)
          .set({ paymentStatus: COMMERCE_PAYMENT_STATUS.FREE })
          .where(eq(competitionRegistrationsTable.id, result.registrationId))

        await storeRegistrationAnswers(
          result.registrationId,
          userId,
          input.answers,
        )

        await notifyRegistrationConfirmed({
          userId,
          registrationId: result.registrationId,
          competitionId: input.competitionId,
          isPaid: false,
        })

        logEntityCreated({
          entity: "registration",
          id: result.registrationId,
          parentEntity: "competition",
          parentId: input.competitionId,
          attributes: {
            paymentStatus: "FREE",
            divisionId: item.divisionId,
            mixedCheckout: true,
          },
        })

        continue
      }

      // Paid division - create purchase record
      // Use full fee for Stripe line items; Stripe coupon handles the discount
      const feeBreakdown = calculateCompetitionFees(item.feeCents, feeConfig)
      const itemProportion =
        totalFeeCents > 0 ? item.feeCents / totalFeeCents : 0
      const itemDiscount = validatedCoupon
        ? Math.round(couponDiscount * itemProportion)
        : 0
      const purchaseId = createCommercePurchaseId()
      purchaseIds.push(purchaseId)

      await db.insert(commercePurchaseTable).values({
        id: purchaseId,
        userId,
        productId: product.id,
        status: COMMERCE_PURCHASE_STATUS.PENDING,
        competitionId: input.competitionId,
        divisionId: item.divisionId,
        totalCents: feeBreakdown.totalChargeCents,
        platformFeeCents: feeBreakdown.platformFeeCents,
        stripeFeeCents: feeBreakdown.stripeFeeCents,
        organizerNetCents: feeBreakdown.organizerNetCents,
        metadata: JSON.stringify({
          teamName: item.teamName,
          affiliateName: input.affiliateName,
          teammates: item.teammates,
          answers: input.answers,
          couponCode: input.couponCode,
          couponDiscountCents: itemDiscount,
          inviteId:
            inviteIdForPurchase &&
            item.divisionId === inviteDivisionIdForPurchase
              ? inviteIdForPurchase
              : null,
        }),
      })

      totalChargeCents += feeBreakdown.totalChargeCents
      totalOrganizerNetCents += feeBreakdown.organizerNetCents

      // Get division label for Stripe line item
      const division = await db.query.scalingLevelsTable.findFirst({
        where: eq(scalingLevelsTable.id, item.divisionId),
      })

      lineItems.push({
        price_data: {
          currency: "usd",
          unit_amount: feeBreakdown.totalChargeCents,
          product_data: {
            name: `${competition.name} - ${division?.label ?? "Registration"}`,
            description: "Competition Registration",
          },
        },
        quantity: 1,
      })
    }

    // If no paid items remain (all were free after splitting), return
    if (purchaseIds.length === 0 || lineItems.length === 0) {
      return {
        purchaseId: null,
        checkoutUrl: null,
        totalCents: 0,
        isFree: true,
        registrationId: null,
      }
    }

    // 9. Create Stripe Checkout Session with multiple line items
    const appUrl = getAppUrl()
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      metadata: {
        purchaseIds: purchaseIds.join(","),
        userId,
        competitionId: input.competitionId,
        type: COMMERCE_PRODUCT_TYPE.COMPETITION_REGISTRATION,
        multiDivision: purchaseIds.length > 1 ? "true" : "false",
      },
      success_url: `${appUrl}/compete/${competition.slug}/registered?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/compete/${competition.slug}/register?canceled=true`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      customer_email: session.user.email ?? undefined,
    }

    // Add transfer_data if organizer has verified Stripe connection
    if (
      organizingTeam?.stripeConnectedAccountId &&
      organizingTeam.stripeAccountStatus === "VERIFIED"
    ) {
      const applicationFeeAmount = Math.max(
        0,
        totalChargeCents - totalOrganizerNetCents,
      )

      sessionParams.payment_intent_data = {
        application_fee_amount: applicationFeeAmount,
        transfer_data: {
          destination: organizingTeam.stripeConnectedAccountId,
        },
      }
    }

    // Create transient Stripe coupon and attach to session if applicable
    if (validatedCoupon && couponDiscount > 0) {
      const stripeCouponId = `wod-${validatedCoupon.id}-${purchaseIds[0]}`
      await getStripe().coupons.create({
        id: stripeCouponId,
        amount_off: couponDiscount,
        currency: "usd",
        duration: "once",
        max_redemptions: 1,
        metadata: { couponId: validatedCoupon.id, purchaseId: purchaseIds[0] },
      })
      sessionParams.discounts = [{ coupon: stripeCouponId }]
      sessionParams.metadata = {
        ...sessionParams.metadata,
        couponId: validatedCoupon.id,
        stripeCouponId,
        couponCode: input.couponCode ?? "",
        couponDiscountCents: couponDiscount.toString(),
      }
    }

    const checkoutSession =
      await getStripe().checkout.sessions.create(sessionParams)

    // 11. Update all purchases with Checkout Session ID
    for (const purchaseId of purchaseIds) {
      await db
        .update(commercePurchaseTable)
        .set({ stripeCheckoutSessionId: checkoutSession.id })
        .where(eq(commercePurchaseTable.id, purchaseId))
    }

    logInfo({
      message: "[Registration] Checkout session created",
      attributes: {
        purchaseIds: purchaseIds.join(","),
        competitionId: input.competitionId,
        lineItemCount: lineItems.length,
        totalCents: totalChargeCents,
        hasConnectedAccount: !!organizingTeam?.stripeConnectedAccountId,
      },
    })

    return {
      purchaseId: purchaseIds[0],
      checkoutUrl: checkoutSession.url,
      totalCents: totalChargeCents,
      isFree: false,
    }
  })

/**
 * Get fee breakdown for a specific division (for display before payment)
 */
export const getRegistrationFeeBreakdownFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getRegistrationFeeBreakdownInputSchema.parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<
      | { isFree: true; totalCents: 0; registrationFeeCents: 0 }
      | ({ isFree: false; registrationFeeCents: number } & FeeBreakdown)
    > => {
      const db = getDb()

      const competition = await db.query.competitionsTable.findFirst({
        where: eq(competitionsTable.id, data.competitionId),
      })
      if (!competition) throw new Error("Competition not found")

      // Get per-division fee (falls back to competition default)
      const registrationFeeCents = await getRegistrationFee(
        data.competitionId,
        data.divisionId,
      )

      if (registrationFeeCents === 0) {
        return { isFree: true, totalCents: 0, registrationFeeCents: 0 }
      }

      // Get organizing team for fee overrides (founding organizers get special rates)
      const organizingTeam = await db.query.teamTable.findFirst({
        where: eq(teamTable.id, competition.organizingTeamId),
        columns: {
          organizerFeePercentage: true,
          organizerFeeFixed: true,
        },
      })

      const teamFeeOverrides: TeamFeeOverrides | undefined = organizingTeam
        ? {
            organizerFeePercentage: organizingTeam.organizerFeePercentage,
            organizerFeeFixed: organizingTeam.organizerFeeFixed,
          }
        : undefined

      const feeConfig = buildFeeConfig(competition, teamFeeOverrides)
      const breakdown = calculateCompetitionFees(
        registrationFeeCents,
        feeConfig,
      )

      return {
        isFree: false,
        ...breakdown,
      }
    },
  )

/**
 * Check if a user is already registered for a competition
 */
export const getUserCompetitionRegistrationFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    getUserCompetitionRegistrationInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    const registration = await db.query.competitionRegistrationsTable.findFirst(
      {
        where: and(
          eq(competitionRegistrationsTable.eventId, data.competitionId),
          eq(competitionRegistrationsTable.userId, data.userId),
          ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
        ),
      },
    )

    return {
      isRegistered: !!registration,
      registration: registration || null,
    }
  })

/**
 * Get scaling group with levels for registration form
 */
export const getScalingGroupWithLevelsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ scalingGroupId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()
    const scalingGroup = await db.query.scalingGroupsTable.findFirst({
      where: eq(scalingGroupsTable.id, data.scalingGroupId),
      with: {
        scalingLevels: {
          orderBy: (table, { asc }) => [asc(table.position)],
        },
      },
    })

    return { scalingGroup }
  })

/**
 * Get user's affiliate name for registration form
 */
export const getUserAffiliateNameFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    const user = await db.query.userTable.findFirst({
      where: eq(userTable.id, data.userId),
      columns: { affiliateName: true },
    })

    return { affiliateName: user?.affiliateName ?? null }
  })

// ============================================================================
// Team Roster Types
// ============================================================================

interface TeamMemberData {
  id: string
  userId: string | null
  roleId: string
  isCaptain: boolean
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string | null
    avatar: string | null
  } | null
}

interface PendingInviteData {
  id: string
  email: string
  token: string | null
  invitedAt: Date | null
  expiresAt: Date | null
}

export interface TeamRosterResult {
  registration: {
    id: string
    status: string
    teamName: string | null
    captainUserId: string | null
    userId: string
    metadata: string | null
    pendingTeammates: string | null
    athleteTeamId: string | null
    competition: {
      id: string
      name: string
      slug: string
    } | null
    division: {
      id: string
      label: string
    } | null
  }
  members: TeamMemberData[]
  pending: PendingInviteData[]
  isTeamRegistration: boolean
}

// ============================================================================
// Update Registration Affiliate
// ============================================================================

const updateRegistrationAffiliateInputSchema = z.object({
  registrationId: z.string().min(1, "Registration ID is required"),
  userId: z.string().min(1, "User ID is required"),
  affiliateName: z.string().max(255).nullable(),
})

/**
 * Update the affiliate for a registration
 * Each team member can update their own affiliate
 * Affiliates are stored per-user in metadata.affiliates[userId]
 */
export const updateRegistrationAffiliateFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    updateRegistrationAffiliateInputSchema.parse(data),
  )
  .handler(async ({ data: input }) => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    // Validate user ID matches session
    if (input.userId !== session.user.id) {
      throw new Error("You can only update your own affiliate")
    }
    getEvlog()?.set({
      action: "update_registration",
      registration: { id: input.registrationId },
    })

    const db = getDb()

    // Get the registration
    const registration = await db.query.competitionRegistrationsTable.findFirst(
      {
        where: eq(competitionRegistrationsTable.id, input.registrationId),
      },
    )

    if (!registration) {
      throw new Error("Registration not found")
    }

    // For individual registrations, user must be the registered user
    // For team registrations, user must be a member of the athlete team
    const isRegisteredUser = registration.userId === input.userId
    let isTeamMember = false

    if (registration.athleteTeamId) {
      const membership = await db.query.teamMembershipTable.findFirst({
        where: and(
          eq(teamMembershipTable.teamId, registration.athleteTeamId),
          eq(teamMembershipTable.userId, input.userId),
        ),
      })
      isTeamMember = !!membership
    }

    if (!isRegisteredUser && !isTeamMember) {
      throw new Error("You must be a team member to update your affiliate")
    }

    // Parse existing metadata
    let metadata: Record<string, unknown> = {}
    if (registration.metadata) {
      try {
        metadata = JSON.parse(registration.metadata) as Record<string, unknown>
      } catch {
        metadata = {}
      }
    }

    // Ensure affiliates object exists
    if (!metadata.affiliates || typeof metadata.affiliates !== "object") {
      metadata.affiliates = {}
    }
    const affiliates = metadata.affiliates as Record<string, string | null>

    // Update this user's affiliate
    if (input.affiliateName) {
      affiliates[input.userId] = input.affiliateName
    } else {
      delete affiliates[input.userId]
    }

    // Clean up affiliates object if empty
    if (Object.keys(affiliates).length === 0) {
      delete metadata.affiliates
    }

    // Save updated metadata + upsert affiliate in a single transaction
    const trimmedAffiliate = input.affiliateName?.trim()
    await db.transaction(async (tx) => {
      await tx
        .update(competitionRegistrationsTable)
        .set({
          metadata:
            Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
          updatedAt: new Date(),
        })
        .where(eq(competitionRegistrationsTable.id, input.registrationId))

      if (
        trimmedAffiliate &&
        trimmedAffiliate.toLowerCase() !== "independent"
      ) {
        await tx
          .insert(affiliatesTable)
          .values({ name: trimmedAffiliate })
          .onDuplicateKeyUpdate({ set: { name: sql`name` } })
      }
    })

    return { success: true }
  })

/**
 * Get team roster for a registration
 */
export const getTeamRosterFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ registrationId: z.string() }).parse(data),
  )
  .handler(async ({ data }): Promise<TeamRosterResult | null> => {
    const db = getDb()

    // Get registration with related data
    const registration = await db.query.competitionRegistrationsTable.findFirst(
      {
        where: eq(competitionRegistrationsTable.id, data.registrationId),
        with: {
          competition: {
            columns: {
              id: true,
              name: true,
              slug: true,
            },
          },
          division: {
            columns: {
              id: true,
              label: true,
            },
          },
        },
      },
    )

    if (!registration) {
      return null
    }

    // Parse related data
    const competition = registration.competition
      ? Array.isArray(registration.competition)
        ? registration.competition[0]
        : registration.competition
      : null

    const division = registration.division
      ? Array.isArray(registration.division)
        ? registration.division[0]
        : registration.division
      : null

    // If no athleteTeamId, this is an individual registration
    if (!registration.athleteTeamId) {
      return {
        registration: {
          id: registration.id,
          status: registration.status,
          teamName: registration.teamName,
          captainUserId: registration.captainUserId,
          userId: registration.userId,
          metadata: registration.metadata,
          pendingTeammates: registration.pendingTeammates,
          athleteTeamId: registration.athleteTeamId,
          competition,
          division,
        },
        members: [],
        pending: [],
        isTeamRegistration: false,
      }
    }

    // Get confirmed team members from teamMembershipTable
    type MembershipWithUser = {
      id: string
      userId: string
      roleId: string
      user: {
        id: string
        firstName: string | null
        lastName: string | null
        email: string | null
        avatar: string | null
      } | null
    }

    const memberships = (await db.query.teamMembershipTable.findMany({
      where: and(
        eq(teamMembershipTable.teamId, registration.athleteTeamId),
        eq(teamMembershipTable.isActive, true),
      ),
      with: {
        user: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    })) as unknown as MembershipWithUser[]

    // Get pending invitations (exclude cancelled)
    const { INVITATION_STATUS } = await import("@/db/schema")
    const invitations = await db.query.teamInvitationTable.findMany({
      where: and(
        eq(teamInvitationTable.teamId, registration.athleteTeamId),
        isNull(teamInvitationTable.acceptedAt),
        eq(teamInvitationTable.status, INVITATION_STATUS.PENDING),
      ),
    })

    const members: TeamMemberData[] = memberships.map((m) => {
      const user = m.user
      return {
        id: m.id,
        userId: m.userId,
        roleId: m.roleId,
        isCaptain: m.roleId === "captain",
        user: user
          ? {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              avatar: user.avatar,
            }
          : null,
      }
    })

    const pending: PendingInviteData[] = invitations.map((i) => ({
      id: i.id,
      email: i.email,
      token: i.token,
      invitedAt: i.createdAt ? new Date(i.createdAt) : null,
      expiresAt: i.expiresAt ? new Date(i.expiresAt) : null,
    }))

    return {
      registration: {
        id: registration.id,
        status: registration.status,
        teamName: registration.teamName,
        captainUserId: registration.captainUserId,
        userId: registration.userId,
        metadata: registration.metadata,
        pendingTeammates: registration.pendingTeammates,
        athleteTeamId: registration.athleteTeamId,
        competition,
        division,
      },
      members,
      pending,
      isTeamRegistration: true,
    }
  })

// ============================================================================
// Get Registration Details (with payment and competition info)
// ============================================================================

export interface RegistrationDetails {
  registrationId: string
  registeredAt: Date
  status: string
  teamName: string | null
  paymentStatus: string | null
  paidAt: Date | null
  // Competition info
  competition: {
    id: string
    name: string
    slug: string
    startDate: Date
    endDate: Date
    profileImageUrl: string | null
  } | null
  // Division info
  division: {
    id: string
    label: string
    teamSize: number
    description: string | null
    feeCents: number | null
  } | null
  // Purchase/Payment info
  purchase: {
    id: string
    totalCents: number
    status: string
    completedAt: Date | null
    stripePaymentIntentId: string | null
    couponCode: string | null
    couponDiscountCents: number | null
  } | null
  // Whether the current user is the original purchaser (controls invoice visibility)
  isOriginalPurchaser: boolean
  // Name of the original purchaser (shown when current user is not the payer)
  purchaserName: string | null
}

/**
 * Get detailed registration information including payment and competition details
 */
export const getRegistrationDetailsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ registrationId: z.string() }).parse(data),
  )
  .handler(async ({ data }): Promise<RegistrationDetails | null> => {
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    const db = getDb()
    const { competitionDivisionsTable } = await import("@/db/schema")

    // Get registration with all related data
    const registration = await db.query.competitionRegistrationsTable.findFirst(
      {
        where: eq(competitionRegistrationsTable.id, data.registrationId),
        with: {
          competition: {
            columns: {
              id: true,
              name: true,
              slug: true,
              startDate: true,
              endDate: true,
              profileImageUrl: true,
            },
          },
          division: {
            columns: {
              id: true,
              label: true,
              teamSize: true,
            },
          },
        },
      },
    )

    if (!registration) {
      return null
    }

    // Verify user is authorized to view this registration
    const isRegisteredUser = registration.userId === session.user.id
    let isTeamMember = false
    if (registration.athleteTeamId) {
      const membership = await db.query.teamMembershipTable.findFirst({
        where: and(
          eq(teamMembershipTable.teamId, registration.athleteTeamId),
          eq(teamMembershipTable.userId, session.user.id),
        ),
      })
      isTeamMember = !!membership
    }
    if (!isRegisteredUser && !isTeamMember) {
      // Return null instead of throwing to allow route to show 404
      return null
    }

    // Parse related data (handle array vs single object)
    const competition = registration.competition
      ? Array.isArray(registration.competition)
        ? registration.competition[0]
        : registration.competition
      : null

    const division = registration.division
      ? Array.isArray(registration.division)
        ? registration.division[0]
        : registration.division
      : null

    // Get division description and fee from competition_divisions table
    let divisionDescription: string | null = null
    let divisionFeeCents: number | null = null

    if (competition?.id && division?.id) {
      const divisionConfig = await db.query.competitionDivisionsTable.findFirst(
        {
          where: and(
            eq(competitionDivisionsTable.competitionId, competition.id),
            eq(competitionDivisionsTable.divisionId, division.id),
          ),
        },
      )
      if (divisionConfig) {
        divisionDescription = divisionConfig.description
        divisionFeeCents = divisionConfig.feeCents
      }
    }

    // Get purchase details if exists
    let purchase: RegistrationDetails["purchase"] = null
    let isOriginalPurchaser = false
    let purchaserName: string | null = null

    if (registration.commercePurchaseId) {
      const purchaseRecord = await db.query.commercePurchaseTable.findFirst({
        where: eq(commercePurchaseTable.id, registration.commercePurchaseId),
      })
      if (purchaseRecord) {
        let couponCode: string | null = null
        let couponDiscountCents: number | null = null
        if (purchaseRecord.metadata) {
          try {
            const meta = JSON.parse(purchaseRecord.metadata)
            couponCode = meta.couponCode ?? null
            couponDiscountCents = meta.couponDiscountCents ?? null
          } catch {
            // ignore invalid metadata
          }
        }
        purchase = {
          id: purchaseRecord.id,
          totalCents: purchaseRecord.totalCents,
          status: purchaseRecord.status,
          completedAt: purchaseRecord.completedAt,
          stripePaymentIntentId: purchaseRecord.stripePaymentIntentId,
          couponCode,
          couponDiscountCents,
        }
        isOriginalPurchaser = purchaseRecord.userId === session.user.id
        if (!isOriginalPurchaser) {
          const payer = await db.query.userTable.findFirst({
            where: eq(userTable.id, purchaseRecord.userId),
            columns: { firstName: true, lastName: true },
          })
          if (payer) {
            purchaserName =
              [payer.firstName, payer.lastName].filter(Boolean).join(" ") ||
              null
          }
        }
      }
    }

    return {
      registrationId: registration.id,
      registeredAt: registration.registeredAt,
      status: registration.status,
      teamName: registration.teamName,
      paymentStatus: registration.paymentStatus,
      paidAt: registration.paidAt,
      competition: competition
        ? {
            id: competition.id,
            name: competition.name,
            slug: competition.slug,
            startDate: competition.startDate,
            endDate: competition.endDate,
            profileImageUrl: competition.profileImageUrl,
          }
        : null,
      division: division
        ? {
            id: division.id,
            label: division.label,
            teamSize: division.teamSize,
            description: divisionDescription,
            feeCents: divisionFeeCents,
          }
        : null,
      purchase,
      isOriginalPurchaser,
      purchaserName,
    }
  })

/**
 * Cancel any pending purchases for a user/competition
 * Used when user explicitly cancels from Stripe checkout
 * This releases the reservation immediately instead of waiting for timeout
 */
export const cancelPendingPurchaseFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().min(1, "User ID is required"),
        competitionId: z.string().min(1, "Competition ID is required"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    // Authenticate user
    const session = await requireVerifiedEmail()
    if (!session) throw new Error("Unauthorized")

    // Update request context
    updateRequestContext({ userId: session.user.id })
    addRequestContextAttribute("competitionId", data.competitionId)
    getEvlog()?.set({
      action: "cancel_registration",
      registration: { competitionId: data.competitionId },
    })

    // Ensure user can only cancel their own pending purchases
    if (data.userId !== session.user.id) {
      logWarning({
        message: "[Registration] Cancel purchase denied - wrong user",
        attributes: {
          requestedUserId: data.userId,
          competitionId: data.competitionId,
        },
      })
      throw new Error("You can only cancel your own pending purchases")
    }

    const db = getDb()

    // Cancel any PENDING purchases for this user/competition
    await db
      .update(commercePurchaseTable)
      .set({ status: COMMERCE_PURCHASE_STATUS.CANCELLED })
      .where(
        and(
          eq(commercePurchaseTable.userId, data.userId),
          eq(commercePurchaseTable.competitionId, data.competitionId),
          eq(commercePurchaseTable.status, COMMERCE_PURCHASE_STATUS.PENDING),
        ),
      )

    logInfo({
      message: "[Registration] Pending purchase cancelled",
      attributes: {
        competitionId: data.competitionId,
      },
    })

    return { success: true }
  })

// ============================================================================
// Remove Registration (Organizer Soft Delete)
// ============================================================================

const removeRegistrationInputSchema = z.object({
  registrationId: z.string().min(1, "Registration ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
})

/**
 * Remove a registration (soft delete) by an organizer.
 *
 * Sets the registration status to REMOVED and deactivates associated
 * team memberships, heat assignments, and pending invitations.
 * Requires MANAGE_COMPETITIONS permission on the organizing team.
 */
// @lat: [[registration#Registration Removal]]
export const removeRegistrationFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => removeRegistrationInputSchema.parse(data))
  .handler(async ({ data: input }) => {
    const session = await requireVerifiedEmail()

    const db = getDb()

    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("competitionId", input.competitionId)
    addRequestContextAttribute("registrationId", input.registrationId)
    getEvlog()?.set({
      action: "remove_registration",
      registration: {
        id: input.registrationId,
        competitionId: input.competitionId,
      },
    })

    // 1. Get competition to verify ownership and get organizing team
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, input.competitionId),
      columns: { id: true, organizingTeamId: true },
    })

    if (!competition) throw new Error("Competition not found")

    // 2. Require organizer permission (site admins bypass)
    if (session.user?.role !== ROLES_ENUM.ADMIN) {
      const team = session.teams?.find(
        (t) => t.id === competition.organizingTeamId,
      )
      if (!team?.permissions.includes(TEAM_PERMISSIONS.MANAGE_COMPETITIONS)) {
        throw new Error("Missing required permission: manage_competitions")
      }
    }

    // 3. Get the registration and verify it belongs to this competition
    const registration = await db.query.competitionRegistrationsTable.findFirst(
      {
        where: and(
          eq(competitionRegistrationsTable.id, input.registrationId),
          eq(competitionRegistrationsTable.eventId, input.competitionId),
        ),
      },
    )

    if (!registration) throw new Error("Registration not found")

    if (registration.status === REGISTRATION_STATUS.REMOVED) {
      throw new Error("Registration is already removed")
    }

    logInfo({
      message: "[Registration] Removing registration",
      attributes: {
        registrationId: input.registrationId,
        competitionId: input.competitionId,
        userId: registration.userId,
        athleteTeamId: registration.athleteTeamId ?? "none",
      },
    })

    // 4. Set registration status to REMOVED
    await db
      .update(competitionRegistrationsTable)
      .set({
        status: REGISTRATION_STATUS.REMOVED,
        updatedAt: new Date(),
      })
      .where(eq(competitionRegistrationsTable.id, input.registrationId))

    // 5. Deactivate the captain's team membership in the competition_event team
    await db
      .update(teamMembershipTable)
      .set({ isActive: false })
      .where(eq(teamMembershipTable.id, registration.teamMemberId))

    // 6. For team registrations, deactivate all athlete team memberships and cancel invitations
    if (registration.athleteTeamId) {
      // Deactivate all memberships on the athlete team
      await db
        .update(teamMembershipTable)
        .set({ isActive: false })
        .where(
          and(
            eq(teamMembershipTable.teamId, registration.athleteTeamId),
            eq(teamMembershipTable.isActive, true),
          ),
        )

      // Cancel pending invitations for the athlete team
      const { INVITATION_STATUS } = await import("@/db/schema")
      await db
        .update(teamInvitationTable)
        .set({ status: INVITATION_STATUS.CANCELLED })
        .where(
          and(
            eq(teamInvitationTable.teamId, registration.athleteTeamId),
            eq(teamInvitationTable.status, INVITATION_STATUS.PENDING),
          ),
        )
    }

    // 7. Delete heat assignments for this registration
    await db
      .delete(competitionHeatAssignmentsTable)
      .where(
        eq(
          competitionHeatAssignmentsTable.registrationId,
          input.registrationId,
        ),
      )

    // 8. Delete scores for the registered user(s) in this competition's events.
    // `scores.competition_event_id` actually stores a `track_workouts.id`
    // (column is misleadingly named), so key the delete by trackWorkoutId, not
    // competition_events.id — comparing the two would silently match nothing.
    const competitionEvents = await db
      .select({ trackWorkoutId: competitionEventsTable.trackWorkoutId })
      .from(competitionEventsTable)
      .where(eq(competitionEventsTable.competitionId, input.competitionId))

    if (competitionEvents.length > 0) {
      const eventIds = competitionEvents.map((e) => e.trackWorkoutId)

      // Collect all user IDs to clean up scores for
      const userIds = [registration.userId]

      // For team registrations, also get teammate user IDs
      if (registration.athleteTeamId) {
        const teammates = await db
          .select({ userId: teamMembershipTable.userId })
          .from(teamMembershipTable)
          .where(eq(teamMembershipTable.teamId, registration.athleteTeamId))

        for (const tm of teammates) {
          if (tm.userId && !userIds.includes(tm.userId)) {
            userIds.push(tm.userId)
          }
        }
      }

      // Delete scores for these users in this competition's events. Always
      // scope by this registration's division (or explicit null) so removing
      // one registration never nukes the athlete's score in a sibling
      // division when the same workout is shared across divisions.
      const deleteScoresConditions = [
        inArray(scoresTable.competitionEventId, eventIds),
        inArray(scoresTable.userId, userIds),
        registration.divisionId
          ? eq(scoresTable.scalingLevelId, registration.divisionId)
          : isNull(scoresTable.scalingLevelId),
      ]
      await db.delete(scoresTable).where(and(...deleteScoresConditions))
    }

    logInfo({
      message: "[Registration] Registration removed successfully",
      attributes: {
        registrationId: input.registrationId,
        competitionId: input.competitionId,
        userId: registration.userId,
      },
    })

    return { success: true }
  })

// ============================================================================
// Transfer Registration Division
// ============================================================================

const transferRegistrationDivisionInputSchema = z.object({
  registrationId: z.string().min(1, "Registration ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  targetDivisionId: z.string().min(1, "Target division ID is required"),
})

/**
 * Transfer an athlete's registration to a different division.
 *
 * - Validates team size compatibility (individual ↔ team blocked)
 * - Removes heat assignments (division-specific)
 * - Updates commerce purchase divisionId for bookkeeping
 * - Does NOT block on capacity (organizer decision)
 */
// @lat: [[registration#Division Transfer]]
export const transferRegistrationDivisionFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    transferRegistrationDivisionInputSchema.parse(data),
  )
  .handler(async ({ data: input }) => {
    const session = await requireVerifiedEmail()
    const db = getDb()

    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("competitionId", input.competitionId)
    addRequestContextAttribute("registrationId", input.registrationId)
    addRequestContextAttribute("targetDivisionId", input.targetDivisionId)

    // 1. Get competition to verify ownership
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, input.competitionId),
      columns: { id: true, organizingTeamId: true },
    })

    if (!competition) throw new Error("Competition not found")

    // 2. Require organizer permission (site admins bypass)
    if (session.user?.role !== ROLES_ENUM.ADMIN) {
      const team = session.teams?.find(
        (t) => t.id === competition.organizingTeamId,
      )
      if (!team?.permissions.includes(TEAM_PERMISSIONS.MANAGE_COMPETITIONS)) {
        throw new Error("Missing required permission: manage_competitions")
      }
    }

    // 3. Get the registration
    const registration = await db.query.competitionRegistrationsTable.findFirst(
      {
        where: and(
          eq(competitionRegistrationsTable.id, input.registrationId),
          eq(competitionRegistrationsTable.eventId, input.competitionId),
        ),
      },
    )

    if (!registration) throw new Error("Registration not found")

    if (registration.status === REGISTRATION_STATUS.REMOVED) {
      throw new Error("Cannot transfer a removed registration")
    }

    // 4. Same-division check
    if (registration.divisionId === input.targetDivisionId) {
      throw new Error("Registration is already in this division")
    }

    // 5. Fetch source + target divisions, compare teamSize
    const sourceDivision = registration.divisionId
      ? await db.query.scalingLevelsTable.findFirst({
          where: eq(scalingLevelsTable.id, registration.divisionId),
          columns: { id: true, teamSize: true },
        })
      : null

    const targetDivision = await db.query.scalingLevelsTable.findFirst({
      where: eq(scalingLevelsTable.id, input.targetDivisionId),
      columns: { id: true, teamSize: true },
    })

    if (!targetDivision) throw new Error("Target division not found")

    const sourceTeamSize = sourceDivision?.teamSize ?? 1
    const targetTeamSize = targetDivision.teamSize

    if (sourceTeamSize !== targetTeamSize) {
      throw new Error(
        `Cannot transfer between divisions with different team sizes (${sourceTeamSize} → ${targetTeamSize})`,
      )
    }

    // 6. Unique constraint check: no existing registration in target division
    const existingRegistration =
      await db.query.competitionRegistrationsTable.findFirst({
        where: and(
          eq(competitionRegistrationsTable.eventId, input.competitionId),
          eq(competitionRegistrationsTable.userId, registration.userId),
          eq(competitionRegistrationsTable.divisionId, input.targetDivisionId),
          ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
        ),
        columns: { id: true },
      })

    if (existingRegistration) {
      throw new Error(
        "Athlete already has a registration in the target division",
      )
    }

    logInfo({
      message: "[Registration] Transferring registration to new division",
      attributes: {
        registrationId: input.registrationId,
        competitionId: input.competitionId,
        fromDivisionId: registration.divisionId ?? "none",
        toDivisionId: input.targetDivisionId,
        userId: registration.userId,
      },
    })

    // 7. Perform all writes in a transaction
    let removedHeatAssignments = 0

    await db.transaction(async (tx) => {
      // Update registration divisionId
      await tx
        .update(competitionRegistrationsTable)
        .set({
          divisionId: input.targetDivisionId,
          updatedAt: new Date(),
        })
        .where(eq(competitionRegistrationsTable.id, input.registrationId))

      // Delete heat assignments (division-specific)
      const deletedHeatAssignments = await tx
        .delete(competitionHeatAssignmentsTable)
        .where(
          eq(
            competitionHeatAssignmentsTable.registrationId,
            input.registrationId,
          ),
        )

      removedHeatAssignments = deletedHeatAssignments[0]?.affectedRows ?? 0

      // Update commerce purchase divisionId if exists
      if (registration.commercePurchaseId) {
        await tx
          .update(commercePurchaseTable)
          .set({ divisionId: input.targetDivisionId })
          .where(eq(commercePurchaseTable.id, registration.commercePurchaseId))
      }
    })

    logInfo({
      message: "[Registration] Division transfer completed",
      attributes: {
        registrationId: input.registrationId,
        competitionId: input.competitionId,
        toDivisionId: input.targetDivisionId,
        removedHeatAssignments: String(removedHeatAssignments),
      },
    })

    return { success: true, removedHeatAssignments }
  })

// ============================================================================
// Manual Registration (Organizer)
// ============================================================================

const createManualRegistrationInputSchema = z.object({
  competitionId: z.string().min(1),
  athleteEmail: z.string().email(),
  athleteFirstName: z.string().max(255).optional(),
  athleteLastName: z.string().max(255).optional(),
  divisionId: z.string().min(1),
  paymentStatus: z.enum(["COMP", "PAID_OFFLINE"]),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        answer: z.string().max(5000),
      }),
    )
    .optional(),
  // Team fields (for team divisions)
  teamName: z.string().max(255).optional(),
  teammates: z
    .array(
      z.object({
        email: z.string().email(),
        firstName: z.string().max(255).optional(),
        lastName: z.string().max(255).optional(),
      }),
    )
    .optional(),
})

/**
 * Create a manual registration from the organizer dashboard.
 *
 * Looks up or creates a placeholder user, calls registerForCompetition()
 * with isOrganizerOverride to bypass registration window checks, sets
 * the appropriate payment status, stores answers, and sends confirmation.
 */
// @lat: [[registration#Registration Flow#Organizer Manual Registration]]
export const createManualRegistrationFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    createManualRegistrationInputSchema.parse(data),
  )
  .handler(async ({ data: input }) => {
    const session = await requireVerifiedEmail()

    const db = getDb()

    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("competitionId", input.competitionId)
    getEvlog()?.set({
      action: "manual_register",
      registration: { competitionId: input.competitionId },
    })

    // 1. Get competition to verify ownership and get organizing team
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, input.competitionId),
      columns: { id: true, organizingTeamId: true },
    })

    if (!competition) throw new Error("Competition not found")

    // 2. Require organizer permission (site admins bypass)
    if (session.user?.role !== ROLES_ENUM.ADMIN) {
      const team = session.teams?.find(
        (t) => t.id === competition.organizingTeamId,
      )
      if (!team?.permissions.includes(TEAM_PERMISSIONS.MANAGE_COMPETITIONS)) {
        throw new Error("Missing required permission: manage_competitions")
      }
    }

    // 3. Look up or create athlete user
    const athleteEmail = input.athleteEmail.toLowerCase()
    let athleteUser = await db.query.userTable.findFirst({
      where: eq(userTable.email, athleteEmail),
    })

    let isNewAthlete = false

    if (!athleteUser) {
      // Create placeholder user
      isNewAthlete = true
      const userId = createUserId()
      await db.insert(userTable).values({
        id: userId,
        email: athleteEmail,
        firstName: input.athleteFirstName ?? null,
        lastName: input.athleteLastName ?? null,
        passwordHash: null,
        emailVerified: null,
      })

      athleteUser = await db.query.userTable.findFirst({
        where: eq(userTable.id, userId),
      })

      if (!athleteUser) {
        throw new Error("Failed to create placeholder user")
      }

      // Create personal team + team membership (required for getUserPersonalTeamId)
      const personalTeamId = createTeamId()
      const personalTeamName = `${input.athleteFirstName || "Personal"}'s Team (personal)`
      const personalTeamSlug = `${
        input.athleteFirstName?.toLowerCase() || "personal"
      }-${userId.slice(-6)}`

      await db.insert(teamTable).values({
        id: personalTeamId,
        name: personalTeamName,
        slug: personalTeamSlug,
        description:
          "Personal team for individual programming track subscriptions",
        isPersonalTeam: true,
        personalTeamOwnerId: userId,
      })

      await db.insert(teamMembershipTable).values({
        id: createTeamMembershipId(),
        teamId: personalTeamId,
        userId,
        roleId: "owner",
        isSystemRole: true,
        joinedAt: new Date(),
        isActive: true,
      })

      logEntityCreated({
        entity: "user",
        id: userId,
        attributes: {
          email: athleteEmail,
          isPlaceholder: true,
          createdByManualRegistration: true,
        },
      })
    }

    // 4. Determine final payment status
    const divisionFeeCents = await getRegistrationFee(
      input.competitionId,
      input.divisionId,
    )

    const finalPaymentStatus =
      divisionFeeCents === 0
        ? COMMERCE_PAYMENT_STATUS.FREE
        : input.paymentStatus

    // 5. Register for competition (bypasses registration window)
    const result = await registerForCompetition({
      competitionId: input.competitionId,
      userId: athleteUser.id,
      divisionId: input.divisionId,
      teamName: input.teamName,
      teammates: input.teammates,
      isOrganizerOverride: true,
    })

    // 6. Set payment status on registration
    await db
      .update(competitionRegistrationsTable)
      .set({
        paymentStatus: finalPaymentStatus,
        paidAt: finalPaymentStatus === "PAID_OFFLINE" ? new Date() : null,
      })
      .where(eq(competitionRegistrationsTable.id, result.registrationId))

    // 7. Store registration answers
    await storeRegistrationAnswers(
      result.registrationId,
      athleteUser.id,
      input.answers,
    )

    const { env } = await import("cloudflare:workers")

    // 8. Generate claim token for placeholder users
    let claimToken: string | undefined
    if (isNewAthlete) {
      claimToken = createToken()
      const claimExpiresAt = new Date(
        Date.now() + CLAIM_TOKEN_EXPIRATION_SECONDS * 1000,
      )
      await env.KV_SESSION.put(
        getClaimTokenKey(claimToken),
        JSON.stringify({
          userId: athleteUser.id,
          expiresAt: claimExpiresAt.toISOString(),
        }),
        { expirationTtl: CLAIM_TOKEN_EXPIRATION_SECONDS },
      )
    }

    // 9. Send confirmation email via workflow (with waiver info)
    const workflowParams = {
      userId: athleteUser.id,
      registrationId: result.registrationId,
      competitionId: input.competitionId,
      isPaid: finalPaymentStatus === "PAID_OFFLINE",
      amountPaidCents:
        finalPaymentStatus === "PAID_OFFLINE" ? divisionFeeCents : undefined,
      isPlaceholderUser: isNewAthlete,
      claimToken,
    }
    const workflow =
      "MANUAL_REGISTRATION_WORKFLOW" in env
        ? (env.MANUAL_REGISTRATION_WORKFLOW as
            | Workflow<typeof workflowParams>
            | undefined)
        : undefined

    if (workflow && typeof workflow.create === "function") {
      await workflow.create({
        id: result.registrationId,
        params: workflowParams,
      })
    } else {
      const { processManualRegistrationInline } = await import(
        "@/workflows/manual-registration-workflow"
      )
      await processManualRegistrationInline(workflowParams)
    }

    // 9. Log the manual registration
    logEntityCreated({
      entity: "registration",
      id: result.registrationId,
      parentEntity: "competition",
      parentId: input.competitionId,
      attributes: {
        manualRegistration: true,
        paymentStatus: finalPaymentStatus,
        registeredByUserId: session.userId,
        divisionId: input.divisionId,
        divisionFeeCents: String(divisionFeeCents),
        isNewAthlete: String(isNewAthlete),
      },
    })

    logInfo({
      message: "[Registration] Manual registration created by organizer",
      attributes: {
        registrationId: result.registrationId,
        competitionId: input.competitionId,
        athleteEmail,
        divisionId: input.divisionId,
        paymentStatus: finalPaymentStatus,
        isNewAthlete: String(isNewAthlete),
      },
    })

    return {
      registrationId: result.registrationId,
      success: true,
      divisionFeeCents,
      isNewAthlete,
    }
  })

// ============================================================================
// Refresh Competition Team Invite
// ============================================================================

const refreshInviteSchema = z.object({
  invitationId: z.string().min(1),
  registrationId: z.string().min(1),
})

/**
 * Regenerate a competition team invite token and resend the email.
 * Only the team captain (registration owner) can refresh invites.
 */
export const refreshCompetitionTeamInviteFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) => refreshInviteSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await requireVerifiedEmail()
    const db = getDb()

    // Verify the registration exists and the caller is the captain
    const registration = await db.query.competitionRegistrationsTable.findFirst(
      {
        where: eq(competitionRegistrationsTable.id, data.registrationId),
        with: {
          competition: {
            columns: { id: true, name: true, slug: true },
          },
          division: {
            columns: { id: true, label: true },
          },
        },
      },
    )

    if (!registration) {
      throw new Error("Registration not found")
    }

    if (registration.userId !== session.userId) {
      throw new Error("Only the team captain can refresh invites")
    }

    // Get the invitation (only pending invites can be refreshed)
    const { INVITATION_STATUS } = await import("@/db/schema")
    const invitation = await db.query.teamInvitationTable.findFirst({
      where: and(
        eq(teamInvitationTable.id, data.invitationId),
        eq(teamInvitationTable.teamId, registration.athleteTeamId ?? ""),
        eq(teamInvitationTable.status, INVITATION_STATUS.PENDING),
      ),
    })

    if (!invitation) {
      throw new Error("Invitation not found")
    }

    if (invitation.acceptedAt) {
      throw new Error("Invitation has already been accepted")
    }

    // Only allow refreshing expired invitations
    if (!invitation.expiresAt || new Date(invitation.expiresAt) >= new Date()) {
      throw new Error("Only expired invitations can be refreshed")
    }

    // Generate new token and extend expiry to 30 days
    const newToken = createId()
    const newExpiresAt = new Date()
    newExpiresAt.setDate(newExpiresAt.getDate() + 30)

    await db
      .update(teamInvitationTable)
      .set({
        token: newToken,
        expiresAt: newExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(teamInvitationTable.id, invitation.id))

    // Resend the invite email
    const competition = Array.isArray(registration.competition)
      ? registration.competition[0]
      : registration.competition
    const division = Array.isArray(registration.division)
      ? registration.division[0]
      : registration.division

    const inviter = await db.query.userTable.findFirst({
      where: eq(userTable.id, session.userId),
      columns: { firstName: true, lastName: true },
    })
    const inviterName = inviter
      ? `${inviter.firstName || ""} ${inviter.lastName || ""}`.trim() ||
        "Your team captain"
      : "Your team captain"

    const { sendCompetitionTeamInviteEmail } = await import("@/utils/email")
    await sendCompetitionTeamInviteEmail({
      email: invitation.email,
      invitationToken: newToken,
      teamName: registration.teamName ?? "Team",
      competitionName: competition?.name ?? "the competition",
      divisionName: division?.label ?? "Division",
      inviterName,
    })

    return { success: true, newToken }
  })
