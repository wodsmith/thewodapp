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

import { createServerFn } from "@tanstack/react-start"
import { and, eq, isNull } from "drizzle-orm"
import type Stripe from "stripe"
import { z } from "zod"
import { getDb } from "@/db"
import {
	COMMERCE_PAYMENT_STATUS,
	COMMERCE_PRODUCT_TYPE,
	COMMERCE_PURCHASE_STATUS,
	commerceProductTable,
	commercePurchaseTable,
	competitionRegistrationAnswersTable,
	competitionRegistrationQuestionsTable,
	competitionRegistrationsTable,
	competitionsTable,
	scalingGroupsTable,
	scalingLevelsTable,
	teamInvitationTable,
	teamMembershipTable,
	teamTable,
	userTable,
	createCommerceProductId,
	createCommercePurchaseId,
} from "@/db/schema"
import {
	buildFeeConfig,
	calculateCompetitionFees,
	type FeeBreakdown,
	getRegistrationFee,
	type TeamFeeOverrides,
} from "@/lib/commerce-stubs"
import { getAppUrl } from "@/lib/env"
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
import { requireVerifiedEmail } from "@/utils/auth"
import {
	DEFAULT_TIMEZONE,
	hasDateStartedInTimezone,
	isDeadlinePassedInTimezone,
} from "@/utils/timezone-utils"
import { getDivisionSpotsAvailableFn } from "./competition-divisions-fns"

// ============================================================================
// Input Schemas
// ============================================================================

const initiateRegistrationPaymentInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	divisionId: z.string().min(1, "Division ID is required"),
	// Team registration data (stored for webhook to use)
	teamName: z.string().optional(),
	affiliateName: z.string().max(255).optional(),
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
	// Registration question answers
	answers: z
		.array(
			z.object({
				questionId: z.string().min(1),
				answer: z.string().max(5000),
			}),
		)
		.optional(),
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

	// Get all required questions for this competition
	const requiredQuestions = await db
		.select()
		.from(competitionRegistrationQuestionsTable)
		.where(
			and(
				eq(competitionRegistrationQuestionsTable.competitionId, competitionId),
				eq(competitionRegistrationQuestionsTable.required, true),
			),
		)

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
 * Initiate payment for competition registration
 *
 * For FREE competitions ($0), creates registration directly.
 * For PAID competitions, creates pending purchase + Stripe Checkout Session.
 * Registration is completed by webhook after payment succeeds.
 */
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
		addRequestContextAttribute("divisionId", input.divisionId)

		logInfo({
			message: "[Registration] Payment initiation started",
			attributes: {
				competitionId: input.competitionId,
				divisionId: input.divisionId,
				hasTeammates: !!input.teammates?.length,
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

		// 2. Validate registration window (using competition's timezone)
		const competitionTimezone = competition.timezone || DEFAULT_TIMEZONE
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

		// 3.5. Check division capacity
		const capacityCheck = await getDivisionSpotsAvailableFn({
			data: {
				competitionId: input.competitionId,
				divisionId: input.divisionId,
			},
		})
		if (capacityCheck.isFull) {
			throw new Error(
				"This division is full. Please select a different division.",
			)
		}

		// 3.6. Validate required questions have answers
		await validateRequiredQuestions(input.competitionId, input.answers)

		// 4. Check for existing pending purchase (resume payment flow)
		const existingPurchase = await db.query.commercePurchaseTable.findFirst({
			where: and(
				eq(commercePurchaseTable.userId, userId),
				eq(commercePurchaseTable.competitionId, input.competitionId),
				eq(commercePurchaseTable.status, COMMERCE_PURCHASE_STATUS.PENDING),
			),
		})

		if (existingPurchase?.stripeCheckoutSessionId) {
			// Check if existing checkout session is still valid
			try {
				const checkoutSession = await getStripe().checkout.sessions.retrieve(
					existingPurchase.stripeCheckoutSessionId,
				)
				// Return existing if not expired and not completed
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

		// 5.5. For paid competitions, verify organizer has Stripe connected and get fee overrides
		let teamFeeOverrides: TeamFeeOverrides | undefined
		if (registrationFeeCents > 0) {
			const organizingTeam = await db.query.teamTable.findFirst({
				where: eq(teamTable.id, competition.organizingTeamId),
				columns: {
					stripeAccountStatus: true,
					organizerFeePercentage: true,
					organizerFeeFixed: true,
				},
			})

			if (organizingTeam?.stripeAccountStatus !== "VERIFIED") {
				throw new Error(
					"This competition is temporarily unable to accept paid registrations. " +
						"Please contact the organizer.",
				)
			}

			// Extract team fee overrides for founding organizers
			teamFeeOverrides = {
				organizerFeePercentage: organizingTeam.organizerFeePercentage,
				organizerFeeFixed: organizingTeam.organizerFeeFixed,
			}
		}

		// 6. FREE DIVISION - create registration directly
		if (registrationFeeCents === 0) {
			const result = await registerForCompetition({
				competitionId: input.competitionId,
				userId,
				divisionId: input.divisionId,
				teamName: input.teamName,
				affiliateName: input.affiliateName,
				teammates: input.teammates,
			})

			// Mark as free registration
			await db
				.update(competitionRegistrationsTable)
				.set({ paymentStatus: COMMERCE_PAYMENT_STATUS.FREE })
				.where(eq(competitionRegistrationsTable.id, result.registrationId))

			// Store registration answers
			await storeRegistrationAnswers(
				result.registrationId,
				userId,
				input.answers,
			)

			// Send registration confirmation email for free registration
			await notifyRegistrationConfirmed({
				userId,
				registrationId: result.registrationId,
				competitionId: input.competitionId,
				isPaid: false,
			})

			// Track created registration
			addRequestContextAttribute("registrationId", result.registrationId)
			logEntityCreated({
				entity: "registration",
				id: result.registrationId,
				parentEntity: "competition",
				parentId: input.competitionId,
				attributes: {
					paymentStatus: "FREE",
					divisionId: input.divisionId,
				},
			})

			logInfo({
				message: "[Registration] Free registration completed",
				attributes: {
					registrationId: result.registrationId,
					competitionId: input.competitionId,
					divisionId: input.divisionId,
				},
			})

			return {
				purchaseId: null,
				checkoutUrl: null,
				totalCents: 0,
				isFree: true,
				registrationId: result.registrationId,
			}
		}

		// 7. PAID COMPETITION - calculate fees (with team-level overrides for founding organizers)
		const feeConfig = buildFeeConfig(competition, teamFeeOverrides)
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
			const productId = createCommerceProductId()
			await db.insert(commerceProductTable).values({
				id: productId,
				name: `Competition Registration - ${competition.name}`,
				type: COMMERCE_PRODUCT_TYPE.COMPETITION_REGISTRATION,
				resourceId: input.competitionId,
				priceCents: registrationFeeCents,
			})
			product = await db.query.commerceProductTable.findFirst({
				where: eq(commerceProductTable.id, productId),
			})
		}

		if (!product) {
			throw new Error("Failed to get or create product")
		}

		// 9. Create purchase record
		const purchaseId = createCommercePurchaseId()
		await db.insert(commercePurchaseTable).values({
			id: purchaseId,
			userId,
			productId: product.id,
			status: COMMERCE_PURCHASE_STATUS.PENDING,
			competitionId: input.competitionId,
			divisionId: input.divisionId,
			totalCents: feeBreakdown.totalChargeCents,
			platformFeeCents: feeBreakdown.platformFeeCents,
			stripeFeeCents: feeBreakdown.stripeFeeCents,
			organizerNetCents: feeBreakdown.organizerNetCents,
			// Store team data and answers for webhook to use when creating registration
			metadata: JSON.stringify({
				teamName: input.teamName,
				affiliateName: input.affiliateName,
				teammates: input.teammates,
				answers: input.answers,
			}),
		})

		const purchase = await db.query.commercePurchaseTable.findFirst({
			where: eq(commercePurchaseTable.id, purchaseId),
		})
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
		const appUrl = getAppUrl()
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
			success_url: `${appUrl}/compete/${competition.slug}/registered?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${appUrl}/compete/${competition.slug}/register?canceled=true`,
			expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes (Stripe minimum)
			customer_email: session.user.email ?? undefined, // Pre-fill email
		}

		// Add transfer_data if organizer has verified Stripe connection
		if (
			organizingTeam?.stripeConnectedAccountId &&
			organizingTeam.stripeAccountStatus === "VERIFIED"
		) {
			// With destination charges, Stripe fees are charged to the PLATFORM account,
			// not the connected account. The connected account receives
			// (totalCharge - applicationFee) with no additional Stripe fee deduction.
			//
			// So: applicationFee = totalCharge - organizerNet
			// Platform net after Stripe fee = applicationFee - stripeFee = platformFee
			const applicationFeeAmount = Math.max(
				0,
				feeBreakdown.totalChargeCents - feeBreakdown.organizerNetCents,
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

		// Track created purchase
		addRequestContextAttribute("purchaseId", purchase.id)
		addRequestContextAttribute("checkoutSessionId", checkoutSession.id)

		logEntityCreated({
			entity: "purchase",
			id: purchase.id,
			parentEntity: "competition",
			parentId: input.competitionId,
			attributes: {
				status: "PENDING",
				totalCents: feeBreakdown.totalChargeCents,
				divisionId: input.divisionId,
			},
		})

		logInfo({
			message: "[Registration] Checkout session created",
			attributes: {
				purchaseId: purchase.id,
				competitionId: input.competitionId,
				divisionId: input.divisionId,
				totalCents: feeBreakdown.totalChargeCents,
				platformFeeCents: feeBreakdown.platformFeeCents,
				organizerNetCents: feeBreakdown.organizerNetCents,
				hasConnectedAccount: !!organizingTeam?.stripeConnectedAccountId,
			},
		})

		return {
			purchaseId: purchase.id,
			checkoutUrl: checkoutSession.url,
			totalCents: feeBreakdown.totalChargeCents,
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
}

export interface TeamRosterResult {
	registration: {
		id: string
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

		// Save updated metadata
		await db
			.update(competitionRegistrationsTable)
			.set({
				metadata:
					Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
				updatedAt: new Date(),
			})
			.where(eq(competitionRegistrationsTable.id, input.registrationId))

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
			where: eq(teamMembershipTable.teamId, registration.athleteTeamId),
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

		// Get pending invitations
		const invitations = await db.query.teamInvitationTable.findMany({
			where: and(
				eq(teamInvitationTable.teamId, registration.athleteTeamId),
				isNull(teamInvitationTable.acceptedAt),
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
		}))

		return {
			registration: {
				id: registration.id,
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
	} | null
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

		if (registration.commercePurchaseId) {
			const purchaseRecord = await db.query.commercePurchaseTable.findFirst({
				where: eq(commercePurchaseTable.id, registration.commercePurchaseId),
			})
			if (purchaseRecord) {
				purchase = {
					id: purchaseRecord.id,
					totalCents: purchaseRecord.totalCents,
					status: purchaseRecord.status,
					completedAt: purchaseRecord.completedAt,
					stripePaymentIntentId: purchaseRecord.stripePaymentIntentId,
				}
			}
		}

		return {
			registrationId: registration.id,
			registeredAt: registration.registeredAt,
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
