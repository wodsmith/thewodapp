import { createServerFn } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"
import type Stripe from "stripe"
import { z } from "zod"
import { getDb } from "~/db/index.server"
import {
	commercePurchaseTable,
	commerceProductTable,
	competitionsTable,
	competitionDivisionsTable,
	competitionRegistrationsTable,
	scalingLevelsTable,
	teamTable,
	COMMERCE_PURCHASE_STATUS,
	COMMERCE_PRODUCT_TYPE,
	COMMERCE_PAYMENT_STATUS,
	TEAM_PERMISSIONS,
} from "~/db/schema.server"
import {
	calculateCompetitionFees,
	getRegistrationFee,
	buildFeeConfig,
	type FeeBreakdown,
} from "~/server/commerce/index.server"
import { getStripe } from "~/lib/stripe"
import { requireVerifiedEmail } from "~/utils/auth.server"
import { RATE_LIMITS, withRateLimit } from "~/utils/with-rate-limit"

/**
 * Input type for initiating a registration payment
 */
interface InitiateRegistrationPaymentInput {
	competitionId: string
	divisionId: string
	teamName?: string
	affiliateName?: string
	teammates?: Array<{
		email: string
		firstName?: string
		lastName?: string
		affiliateName?: string
	}>
}

/**
 * Initiate payment for competition registration
 *
 * For FREE competitions ($0), creates registration directly.
 * For PAID competitions, creates pending purchase + Stripe Checkout Session.
 */
export const initiateRegistrationPaymentFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			competitionId: z.string(),
			divisionId: z.string(),
			teamName: z.string().optional(),
			affiliateName: z.string().optional(),
			teammates: z
				.array(
					z.object({
						email: z.string(),
						firstName: z.string().optional(),
						lastName: z.string().optional(),
						affiliateName: z.string().optional(),
					}),
				)
				.optional(),
		}),
	)
	.handler(async ({ data: input }) => {
		return withRateLimit(async () => {
			const session = await requireVerifiedEmail()
			if (!session) throw new Error("Unauthorized")

			const db = getDb()
			const userId = session.user.id

			// 1. Get competition and validate
			const competition = await db.query.competitionsTable.findFirst({
				where: eq(competitionsTable.id, input.competitionId),
			})
			if (!competition) throw new Error("Competition not found")

			// 2. Validate registration window
			const now = new Date()
			if (
				competition.registrationOpensAt &&
				new Date(competition.registrationOpensAt) > now
			) {
				throw new Error("Registration has not opened yet")
			}
			if (
				competition.registrationClosesAt &&
				new Date(competition.registrationClosesAt) < now
			) {
				throw new Error("Registration has closed")
			}

			// 3. Check not already registered
			const existingRegistration =
				await db.query.competitionRegistrationsTable.findFirst({
					where: and(
						eq(competitionRegistrationsTable.eventId, input.competitionId),
						eq(competitionRegistrationsTable.userId, userId),
					),
				})
			if (existingRegistration) {
				throw new Error("You are already registered for this competition")
			}

			// 4. Check for existing pending purchase (resume payment flow)
			const existingPurchase = await db.query.commercePurchaseTable.findFirst({
				where: and(
					eq(commercePurchaseTable.userId, userId),
					eq(commercePurchaseTable.competitionId, input.competitionId),
					eq(commercePurchaseTable.status, COMMERCE_PURCHASE_STATUS.PENDING),
				),
			})

			if (existingPurchase?.stripeCheckoutSessionId) {
				try {
					const checkoutSession = await getStripe().checkout.sessions.retrieve(
						existingPurchase.stripeCheckoutSessionId,
					)
					if (checkoutSession.status === "open" && checkoutSession.url) {
						return {
							purchaseId: existingPurchase.id,
							checkoutUrl: checkoutSession.url,
							totalCents: existingPurchase.totalCents,
							isFree: false,
						}
					}
				} catch {
					// Session expired or invalid - continue to create new one
				}
			}

			// 5. Get registration fee for this division
			const registrationFeeCents = await getRegistrationFee(
				input.competitionId,
				input.divisionId,
			)

			// 5.5. For paid competitions, verify organizer has Stripe connected
			if (registrationFeeCents > 0) {
				const organizingTeam = await db.query.teamTable.findFirst({
					where: eq(teamTable.id, competition.organizingTeamId),
					columns: { stripeAccountStatus: true },
				})

				if (organizingTeam?.stripeAccountStatus !== "VERIFIED") {
					throw new Error(
						"This competition is temporarily unable to accept paid registrations. " +
							"Please contact the organizer.",
					)
				}
			}

			// 6. FREE DIVISION - create registration directly
			if (registrationFeeCents === 0) {
				const { registerForCompetition } = await import("~/server/competitions")
				const result = await registerForCompetition({
					competitionId: input.competitionId,
					userId,
					divisionId: input.divisionId,
					teamName: input.teamName,
					affiliateName: input.affiliateName,
					teammates: input.teammates,
				})

				await db
					.update(competitionRegistrationsTable)
					.set({ paymentStatus: COMMERCE_PAYMENT_STATUS.FREE })
					.where(eq(competitionRegistrationsTable.id, result.registrationId))

				return {
					purchaseId: null,
					checkoutUrl: null,
					totalCents: 0,
					isFree: true,
					registrationId: result.registrationId,
				}
			}

			// 7. PAID COMPETITION - calculate fees
			const feeConfig = buildFeeConfig(competition)
			const feeBreakdown = calculateCompetitionFees(
				registrationFeeCents,
				feeConfig,
			)

			// 8. Find or create product (idempotent)
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
				const [newProduct] = await db
					.insert(commerceProductTable)
					.values({
						name: `Competition Registration - ${competition.name}`,
						type: COMMERCE_PRODUCT_TYPE.COMPETITION_REGISTRATION,
						resourceId: input.competitionId,
						priceCents: registrationFeeCents,
					})
					.returning()
				product = newProduct
			}

			if (!product) {
				throw new Error("Failed to get or create product")
			}

			// 9. Create purchase record
			const purchaseResult = await db
				.insert(commercePurchaseTable)
				.values({
					userId,
					productId: product.id,
					status: COMMERCE_PURCHASE_STATUS.PENDING,
					competitionId: input.competitionId,
					divisionId: input.divisionId,
					totalCents: feeBreakdown.totalChargeCents,
					platformFeeCents: feeBreakdown.platformFeeCents,
					stripeFeeCents: feeBreakdown.stripeFeeCents,
					organizerNetCents: feeBreakdown.organizerNetCents,
					metadata: JSON.stringify({
						teamName: input.teamName,
						affiliateName: input.affiliateName,
						teammates: input.teammates,
					}),
				})
				.returning()

			const purchase = purchaseResult[0]
			if (!purchase) {
				throw new Error("Failed to create purchase record")
			}

			// 10. Get division label for checkout display
			const division = await db.query.scalingLevelsTable.findFirst({
				where: eq(scalingLevelsTable.id, input.divisionId),
			})

			// 10.5. Get organizing team's Stripe connection for payouts
			const organizingTeam = await db.query.teamTable.findFirst({
				where: eq(teamTable.id, competition.organizingTeamId),
				columns: {
					stripeConnectedAccountId: true,
					stripeAccountStatus: true,
				},
			})

			// 11. Create Stripe Checkout Session
			const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
			const sessionParams: Stripe.Checkout.SessionCreateParams = {
				mode: "payment",
				payment_method_types: ["card"],
				line_items: [
					{
						price_data: {
							currency: "usd",
							unit_amount: feeBreakdown.totalChargeCents,
							product_data: {
								name: `${competition.name} - ${division?.label ?? "Registration"}`,
								description: "Competition Registration",
							},
						},
						quantity: 1,
					},
				],
				metadata: {
					purchaseId: purchase.id,
					userId,
					competitionId: input.competitionId,
					divisionId: input.divisionId,
					type: COMMERCE_PRODUCT_TYPE.COMPETITION_REGISTRATION,
				},
				success_url: `${appUrl}/compete/${competition.slug}/register/success?session_id={CHECKOUT_SESSION_ID}`,
				cancel_url: `${appUrl}/compete/${competition.slug}/register?canceled=true`,
				expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
				customer_email: session.user.email ?? undefined,
			}

			if (
				organizingTeam?.stripeConnectedAccountId &&
				organizingTeam.stripeAccountStatus === "VERIFIED"
			) {
				const stripeRate = 0.029
				const stripeFixedCents = 30
				const connectedAccountReceives = Math.ceil(
					(feeBreakdown.organizerNetCents + stripeFixedCents) /
						(1 - stripeRate),
				)
				const applicationFeeAmount = Math.max(
					0,
					feeBreakdown.totalChargeCents - connectedAccountReceives,
				)

				sessionParams.payment_intent_data = {
					application_fee_amount: applicationFeeAmount,
					transfer_data: {
						destination: organizingTeam.stripeConnectedAccountId,
					},
				}
			}

			const checkoutSession =
				await getStripe().checkout.sessions.create(sessionParams)

			// 12. Update purchase with Checkout Session ID
			await db
				.update(commercePurchaseTable)
				.set({ stripeCheckoutSessionId: checkoutSession.id })
				.where(eq(commercePurchaseTable.id, purchase.id))

			return {
				purchaseId: purchase.id,
				checkoutUrl: checkoutSession.url,
				totalCents: feeBreakdown.totalChargeCents,
				isFree: false,
			}
		}, RATE_LIMITS.PURCHASE)
	})

/**
 * Get fee breakdown for a specific division (for display before payment)
 */
export const getRegistrationFeeBreakdownFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			competitionId: z.string(),
			divisionId: z.string(),
		}),
	)
	.handler(async ({ data: input }) => {
		try {
			const db = getDb()

			const competition = await db.query.competitionsTable.findFirst({
				where: eq(competitionsTable.id, input.competitionId),
			})
			if (!competition) throw new Error("Competition not found")

			const registrationFeeCents = await getRegistrationFee(
				input.competitionId,
				input.divisionId,
			)

			if (registrationFeeCents === 0) {
				return { isFree: true, totalCents: 0, registrationFeeCents: 0 }
			}

			const feeConfig = buildFeeConfig(competition)
			const breakdown = calculateCompetitionFees(
				registrationFeeCents,
				feeConfig,
			)

			return {
				isFree: false,
				registrationFeeCents,
				...breakdown,
			}
		} catch (error) {
			if (error instanceof Error) throw error
			throw new Error("Failed to get fee breakdown")
		}
	})

/**
 * Get all division fees for a competition (for admin/display)
 */
export const getCompetitionDivisionFeesFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			competitionId: z.string(),
		}),
	)
	.handler(async ({ data: input }) => {
		try {
			const db = getDb()

			const fees = await db.query.competitionDivisionsTable.findMany({
				where: eq(competitionDivisionsTable.competitionId, input.competitionId),
				with: {
					division: true,
				},
			})

			const competition = await db.query.competitionsTable.findFirst({
				where: eq(competitionsTable.id, input.competitionId),
			})

			return {
				defaultFeeCents: competition?.defaultRegistrationFeeCents ?? 0,
				divisionFees: fees.map((f) => ({
					divisionId: f.divisionId,
					divisionLabel: f.division?.label,
					feeCents: f.feeCents,
				})),
			}
		} catch (error) {
			if (error instanceof Error) throw error
			throw new Error("Failed to get division fees")
		}
	})

/**
 * Update competition-level fee configuration
 */
export const updateCompetitionFeeConfigFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			competitionId: z.string(),
			defaultRegistrationFeeCents: z.number().optional(),
			platformFeePercentage: z.number().nullable().optional(),
			platformFeeFixed: z.number().nullable().optional(),
			passStripeFeesToCustomer: z.boolean().optional(),
			passPlatformFeesToCustomer: z.boolean().optional(),
		}),
	)
	.handler(async ({ data: input }) => {
		return withRateLimit(async () => {
			const session = await requireVerifiedEmail()
			if (!session) throw new Error("Unauthorized")

			const db = getDb()

			const competition = await db.query.competitionsTable.findFirst({
				where: eq(competitionsTable.id, input.competitionId),
			})
			if (!competition) throw new Error("Competition not found")

			const { requireTeamPermission } = await import("~/utils/team-auth.server")
			await requireTeamPermission(
				competition.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			await db
				.update(competitionsTable)
				.set({
					defaultRegistrationFeeCents: input.defaultRegistrationFeeCents,
					platformFeePercentage: input.platformFeePercentage,
					platformFeeFixed: input.platformFeeFixed,
					passStripeFeesToCustomer: input.passStripeFeesToCustomer,
					passPlatformFeesToCustomer: input.passPlatformFeesToCustomer,
					updatedAt: new Date(),
				})
				.where(eq(competitionsTable.id, input.competitionId))

			return { success: true }
		}, RATE_LIMITS.SETTINGS)
	})

/**
 * Update or remove a division-specific fee
 */
export const updateDivisionFeeFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			competitionId: z.string(),
			divisionId: z.string(),
			feeCents: z.number().nullable(),
		}),
	)
	.handler(async ({ data: input }) => {
		return withRateLimit(async () => {
			const session = await requireVerifiedEmail()
			if (!session) throw new Error("Unauthorized")

			const db = getDb()

			const competition = await db.query.competitionsTable.findFirst({
				where: eq(competitionsTable.id, input.competitionId),
			})
			if (!competition) throw new Error("Competition not found")

			const { requireTeamPermission } = await import("~/utils/team-auth.server")
			await requireTeamPermission(
				competition.organizingTeamId,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			)

			if (input.feeCents === null) {
				await db
					.delete(competitionDivisionsTable)
					.where(
						and(
							eq(competitionDivisionsTable.competitionId, input.competitionId),
							eq(competitionDivisionsTable.divisionId, input.divisionId),
						),
					)
			} else {
				const existing = await db.query.competitionDivisionsTable.findFirst({
					where: and(
						eq(competitionDivisionsTable.competitionId, input.competitionId),
						eq(competitionDivisionsTable.divisionId, input.divisionId),
					),
				})

				if (existing) {
					await db
						.update(competitionDivisionsTable)
						.set({ feeCents: input.feeCents, updatedAt: new Date() })
						.where(eq(competitionDivisionsTable.id, existing.id))
				} else {
					await db.insert(competitionDivisionsTable).values({
						competitionId: input.competitionId,
						divisionId: input.divisionId,
						feeCents: input.feeCents,
					})
				}
			}

			return { success: true }
		}, RATE_LIMITS.SETTINGS)
	})

/**
 * Get revenue stats for a competition
 */
export const getCompetitionRevenueStatsFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			competitionId: z.string(),
		}),
	)
	.handler(async ({ data: input }) => {
		try {
			const { getCompetitionRevenueStats } = await import(
				"~/server/commerce/index.server"
			)
			const stats = await getCompetitionRevenueStats(input.competitionId)
			return stats
		} catch (error) {
			if (error instanceof Error) throw error
			throw new Error("Failed to get revenue stats")
		}
	})
