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

import { WorkflowEntrypoint } from "cloudflare:workers"
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers"
import { and, count, eq, sql } from "drizzle-orm"
import { getDb } from "@/db"
import {
	COMMERCE_PAYMENT_STATUS,
	COMMERCE_PURCHASE_STATUS,
	commercePurchaseTable,
	competitionDivisionsTable,
	competitionRegistrationAnswersTable,
	competitionRegistrationsTable,
	competitionsTable,
	userTable,
} from "@/db/schema"
import {
	logError,
	logInfo,
	logWarning,
} from "@/lib/logging/posthog-otel-logger"
import { notifyCompetitionRegistration } from "@/lib/slack"
import { getStripe } from "@/lib/stripe"
import {
	notifyRegistrationConfirmed,
	registerForCompetition,
} from "@/server/registration"
import { calculateDivisionCapacity } from "@/utils/division-capacity"

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
	const existingRegistration =
		await db.query.competitionRegistrationsTable.findFirst({
			where: eq(competitionRegistrationsTable.commercePurchaseId, purchaseId),
		})

	if (existingRegistration) {
		logInfo({
			message:
				"[Workflow] Registration already exists for purchase, ensuring purchase completed",
			attributes: {
				purchaseId,
				registrationId: existingRegistration.id,
			},
		})
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
		with: {
			division: true,
		},
	})

	const [registrations, pendingPurchases] = await Promise.all([
		db
			.select({ count: count() })
			.from(competitionRegistrationsTable)
			.where(
				and(
					eq(competitionRegistrationsTable.divisionId, divisionId),
					eq(competitionRegistrationsTable.eventId, competitionId),
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
				await stripe.refunds.create({
					payment_intent: session.payment_intent,
					reason: "requested_by_customer",
				})
				logInfo({
					message: "[Workflow] Refund issued for division-full scenario",
					attributes: {
						purchaseId,
						paymentIntentId: session.payment_intent,
					},
				})
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

	// Create the registration
	try {
		const result = await registerForCompetition({
			competitionId,
			userId,
			divisionId,
			teamName: registrationData.teamName,
			affiliateName: registrationData.affiliateName,
			teammates: registrationData.teammates,
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
			divisionName: divisionConfig?.division?.label ?? null,
			teamName: registrationData.teamName ?? null,
			registrationDivisionId: divisionId,
			registrationTeamName: registrationData.teamName ?? null,
			registrationPendingTeammates: null,
			competitionSlug: competition.slug,
			competitionStartDate: competition.startDate,
			userEmail: user?.email ?? null,
			userFirstName: user?.firstName ?? null,
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

export class StripeCheckoutWorkflow extends WorkflowEntrypoint<
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

		// Step 2: Send confirmation email (non-critical, retries independently)
		await step.do(
			"send-confirmation-email",
			{
				retries: { limit: 3, delay: "2 seconds", backoff: "exponential" },
			},
			async () => {
				await sendConfirmationEmail(registrationResult)
			},
		)

		// Step 3: Send Slack notification (non-critical, retries independently)
		await step.do(
			"send-slack-notification",
			{
				retries: { limit: 2, delay: "1 second", backoff: "linear" },
			},
			async () => {
				await sendSlackNotification(registrationResult, session)
			},
		)
	}
}

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
		await sendConfirmationEmail(registrationResult)
	} catch (err) {
		logWarning({
			message:
				"[Inline Checkout] Email notification failed, continuing",
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
			message:
				"[Inline Checkout] Slack notification failed, continuing",
			error: err,
			attributes: {
				purchaseId: registrationResult.purchaseId,
				competitionId: registrationResult.competitionId,
			},
		})
	}
}
