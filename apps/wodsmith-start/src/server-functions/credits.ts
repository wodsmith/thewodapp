import "server-only"
import { createServerFn } from "@tanstack/react-start"
import { and, asc, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm"
import ms from "ms"
import { z } from "zod"
import {
	CREDITS_EXPIRATION_YEARS,
	CREDIT_PACKAGES,
	MAX_TRANSACTIONS_PER_PAGE,
} from "~/constants"
import { getDb } from "~/db/index.server"
import {
	creditTransactionTable,
	userTable,
	CREDIT_TRANSACTION_TYPE,
} from "~/db/schema.server"
import { getStripe } from "~/lib/stripe"
import { requireVerifiedEmail } from "~/utils/auth.server"
import { RATE_LIMITS, withRateLimit } from "~/utils/with-rate-limit"

/**
 * Get credit package by ID
 */
function getCreditPackage(packageId: string) {
	return CREDIT_PACKAGES.find((pkg) => pkg.id === packageId)
}

/**
 * Check if credits should be refreshed (1 month passed since last refresh)
 */
function shouldRefreshCredits(
	lastCreditRefreshAt: Date | null,
	currentTime: Date,
): boolean {
	if (!lastCreditRefreshAt) {
		return true
	}

	const oneMonthAfterLastRefresh = new Date(lastCreditRefreshAt)
	oneMonthAfterLastRefresh.setMonth(oneMonthAfterLastRefresh.getMonth() + 1)

	return currentTime >= oneMonthAfterLastRefresh
}

/**
 * Process expired credits for a user
 */
async function processExpiredCredits(userId: string, currentTime: Date) {
	const db = getDb()

	// Find all expired transactions that haven't been processed and have remaining credits
	const expiredTransactions = await db.query.creditTransactionTable.findMany({
		where: and(
			eq(creditTransactionTable.userId, userId),
			lt(creditTransactionTable.expirationDate, currentTime),
			isNull(creditTransactionTable.expirationDateProcessedAt),
			gt(creditTransactionTable.remainingAmount, 0),
		),
		orderBy: [
			// Process MONTHLY_REFRESH transactions first
			desc(
				sql`CASE WHEN ${creditTransactionTable.type} = ${CREDIT_TRANSACTION_TYPE.MONTHLY_REFRESH} THEN 1 ELSE 0 END`,
			),
			// Then process by creation date (oldest first)
			asc(creditTransactionTable.createdAt),
		],
	})

	// Process each expired transaction
	for (const transaction of expiredTransactions) {
		try {
			// Mark the transaction as processed and zero out remaining amount
			await db
				.update(creditTransactionTable)
				.set({
					expirationDateProcessedAt: currentTime,
					remainingAmount: 0,
				})
				.where(eq(creditTransactionTable.id, transaction.id))

			// Deduct the expired credits from user's balance
			await db
				.update(userTable)
				.set({
					currentCredits: sql`${userTable.currentCredits} - ${transaction.remainingAmount}`,
				})
				.where(eq(userTable.id, userId))
		} catch (error) {
			console.error(
				`Failed to process expired credits for transaction ${transaction.id}:`,
				error,
			)
		}
	}
}

/**
 * Update user's credit balance
 */
async function updateUserCredits(userId: string, creditsToAdd: number) {
	const db = getDb()
	await db
		.update(userTable)
		.set({
			currentCredits: sql`${userTable.currentCredits} + ${creditsToAdd}`,
		})
		.where(eq(userTable.id, userId))
}

/**
 * Update the last credit refresh date
 */
async function updateLastRefreshDate(userId: string, date: Date) {
	const db = getDb()
	await db
		.update(userTable)
		.set({
			lastCreditRefreshAt: date,
		})
		.where(eq(userTable.id, userId))
}

/**
 * Log a credit transaction
 */
async function logTransaction({
	userId,
	amount,
	description,
	type,
	expirationDate,
	paymentIntentId,
}: {
	userId: string
	amount: number
	description: string
	type: keyof typeof CREDIT_TRANSACTION_TYPE
	expirationDate?: Date
	paymentIntentId?: string
}) {
	const db = getDb()
	await db.insert(creditTransactionTable).values({
		userId,
		amount,
		remainingAmount: amount,
		type,
		description,
		expirationDate,
		paymentIntentId,
	})
}

/**
 * Get team credit balance
 */
export const getTeamCreditsFn = createServerFn({ method: "POST" }).handler(
	async () => {
		const session = await requireVerifiedEmail()
		if (!session?.user?.id) {
			throw new Error("Unauthorized")
		}

		const db = getDb()
		const user = await db.query.userTable.findFirst({
			where: eq(userTable.id, session.user.id),
			columns: {
				currentCredits: true,
				lastCreditRefreshAt: true,
			},
		})

		if (!user) {
			throw new Error("User not found")
		}

		return {
			currentCredits: user.currentCredits,
			lastCreditRefreshAt: user.lastCreditRefreshAt,
		}
	},
)

/**
 * Deduct credits for usage (competition registration, etc.)
 */
export const deductCreditsFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			amount: z.number().positive(),
			description: z.string(),
		}),
	)
	.handler(async ({ data: input }) => {
		return withRateLimit(async () => {
			const session = await requireVerifiedEmail()
			if (!session?.user?.id) {
				throw new Error("Unauthorized")
			}

			const db = getDb()
			const userId = session.user.id

			// Check if user has enough credits
			const user = await db.query.userTable.findFirst({
				where: eq(userTable.id, userId),
				columns: {
					currentCredits: true,
				},
			})

			if (!user || user.currentCredits < input.amount) {
				throw new Error("Insufficient credits")
			}

			// Get all non-expired transactions with remaining credits
			const activeTransactionsWithBalance =
				await db.query.creditTransactionTable.findMany({
					where: and(
						eq(creditTransactionTable.userId, userId),
						gt(creditTransactionTable.remainingAmount, 0),
						isNull(creditTransactionTable.expirationDateProcessedAt),
						or(
							isNull(creditTransactionTable.expirationDate),
							gt(creditTransactionTable.expirationDate, new Date()),
						),
					),
					orderBy: [asc(creditTransactionTable.createdAt)],
				})

			let remainingToDeduct = input.amount

			// Deduct from each transaction until we've deducted the full amount
			for (const transaction of activeTransactionsWithBalance) {
				if (remainingToDeduct <= 0) break

				const deductFromThis = Math.min(
					transaction.remainingAmount,
					remainingToDeduct,
				)

				await db
					.update(creditTransactionTable)
					.set({
						remainingAmount: transaction.remainingAmount - deductFromThis,
					})
					.where(eq(creditTransactionTable.id, transaction.id))

				remainingToDeduct -= deductFromThis
			}

			// Update total credits
			await db
				.update(userTable)
				.set({
					currentCredits: sql`${userTable.currentCredits} - ${input.amount}`,
				})
				.where(eq(userTable.id, userId))

			// Log the usage transaction
			await db.insert(creditTransactionTable).values({
				userId,
				amount: -input.amount,
				remainingAmount: 0,
				type: CREDIT_TRANSACTION_TYPE.USAGE,
				description: input.description,
			})

			const updatedUser = await db.query.userTable.findFirst({
				where: eq(userTable.id, userId),
				columns: {
					currentCredits: true,
				},
			})

			return {
				newBalance: updatedUser?.currentCredits ?? 0,
			}
		}, RATE_LIMITS.PURCHASE)
	})

/**
 * Get credit transaction history
 */
export const getCreditHistoryFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			page: z.number().int().positive().default(1),
			limit: z.number().int().positive().max(MAX_TRANSACTIONS_PER_PAGE).default(MAX_TRANSACTIONS_PER_PAGE),
		}),
	)
	.handler(async ({ data: input }) => {
		return withRateLimit(async () => {
			const session = await requireVerifiedEmail()
			if (!session?.user?.id) {
				throw new Error("Unauthorized")
			}

			const db = getDb()
			const userId = session.user.id

			const transactions = await db.query.creditTransactionTable.findMany({
				where: eq(creditTransactionTable.userId, userId),
				orderBy: [desc(creditTransactionTable.createdAt)],
				limit: input.limit,
				offset: (input.page - 1) * input.limit,
				columns: {
					id: true,
					amount: true,
					type: true,
					description: true,
					expirationDate: true,
					createdAt: true,
				},
			})

			const total = await db
				.select({ count: sql<number>`count(*)` })
				.from(creditTransactionTable)
				.where(eq(creditTransactionTable.userId, userId))
				.then((result) => result[0]?.count ?? 0)

			return {
				transactions,
				pagination: {
					total,
					pages: Math.ceil(total / input.limit),
					current: input.page,
				},
			}
		}, RATE_LIMITS.PURCHASE)
	})

/**
 * Create Stripe payment intent for credits
 */
export const createPaymentIntentFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			packageId: z.string(),
		}),
	)
	.handler(async ({ data: input }) => {
		return withRateLimit(async () => {
			const session = await requireVerifiedEmail()
			if (!session) {
				throw new Error("Unauthorized")
			}

			try {
				const creditPackage = getCreditPackage(input.packageId)
				if (!creditPackage) {
					throw new Error("Invalid package")
				}

				const paymentIntent = await getStripe().paymentIntents.create({
					amount: creditPackage.price * 100,
					currency: "usd",
					automatic_payment_methods: {
						enabled: true,
						allow_redirects: "never",
					},
					metadata: {
						userId: session.user.id,
						packageId: creditPackage.id,
						credits: creditPackage.credits.toString(),
					},
				})

				return { clientSecret: paymentIntent.client_secret }
			} catch (error) {
				console.error("Payment intent creation error:", error)
				throw new Error("Failed to create payment intent")
			}
		}, RATE_LIMITS.PURCHASE)
	})

/**
 * Confirm credit purchase after Stripe payment succeeds
 */
export const confirmCreditPurchaseFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			packageId: z.string(),
			paymentIntentId: z.string(),
		}),
	)
	.handler(async ({ data: input }) => {
		return withRateLimit(async () => {
			const session = await requireVerifiedEmail()
			if (!session) {
				throw new Error("Unauthorized")
			}

			try {
				const creditPackage = getCreditPackage(input.packageId)
				if (!creditPackage) {
					throw new Error("Invalid package")
				}

				// Verify the payment intent
				const paymentIntent = await getStripe().paymentIntents.retrieve(
					input.paymentIntentId,
				)

				if (paymentIntent.status !== "succeeded") {
					throw new Error("Payment not completed")
				}

				// Verify the payment intent metadata matches
				if (
					paymentIntent.metadata.userId !== session.user.id ||
					paymentIntent.metadata.packageId !== input.packageId ||
					!paymentIntent.metadata.credits ||
					Number.parseInt(paymentIntent.metadata.credits) !==
						creditPackage.credits
				) {
					throw new Error("Invalid payment intent")
				}

				// Add credits and log transaction
				await updateUserCredits(session.user.id, creditPackage.credits)
				await logTransaction({
					userId: session.user.id,
					amount: creditPackage.credits,
					description: `Purchased ${creditPackage.credits} credits`,
					type: CREDIT_TRANSACTION_TYPE.PURCHASE,
					expirationDate: new Date(
						Date.now() + ms(`${CREDITS_EXPIRATION_YEARS} years`),
					),
					paymentIntentId: paymentIntent.id,
				})

				return { success: true }
			} catch (error) {
				console.error("Purchase error:", error)
				throw new Error("Failed to process payment")
			}
		}, RATE_LIMITS.PURCHASE)
	})

/**
 * Calculate registration fee (with entitlements integration)
 */
export const calculateRegistrationFeeFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			competitionId: z.string(),
			divisionId: z.string(),
		}),
	)
	.handler(async ({ data: input }) => {
		try {
			const { getRegistrationFee } = await import(
				"~/server/commerce/fee-calculator.server"
			)

			const feeCents = await getRegistrationFee(
				input.competitionId,
				input.divisionId,
			)

			return {
				feeCents,
				isFree: feeCents === 0,
			}
		} catch (error) {
			if (error instanceof Error) throw error
			throw new Error("Failed to calculate registration fee")
		}
	})

/**
 * Calculate platform fee
 */
export const calculatePlatformFeeFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			baseCents: z.number().nonnegative(),
			platformFeePercentage: z.number().default(2.5),
			platformFeeFixed: z.number().default(0),
		}),
	)
	.handler(async ({ data: input }) => {
		const platformFeePercentage = input.platformFeePercentage / 100
		const platformFeeFromPercentage = Math.ceil(
			input.baseCents * platformFeePercentage,
		)
		const totalFeeCents =
			platformFeeFromPercentage + input.platformFeeFixed

		return {
			percentageFeeCents: platformFeeFromPercentage,
			fixedFeeCents: input.platformFeeFixed,
			totalFeeCents,
		}
	})

/**
 * Calculate organizer payout
 */
export const calculateOrganizerPayoutFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			registrationFeeCents: z.number().nonnegative(),
			platformFeeCents: z.number().nonnegative(),
			stripeFeeCents: z.number().nonnegative(),
			passStripeFeesToCustomer: z.boolean().default(true),
			passPlatformFeesToCustomer: z.boolean().default(true),
		}),
	)
	.handler(async ({ data: input }) => {
		let organizerNet = input.registrationFeeCents

		// Apply platform fee if organizer pays
		if (!input.passPlatformFeesToCustomer) {
			organizerNet -= input.platformFeeCents
		}

		// Apply Stripe fee if organizer pays
		if (!input.passStripeFeesToCustomer) {
			organizerNet -= input.stripeFeeCents
		}

		return {
			organizerNetCents: Math.max(0, organizerNet),
			totalFeeCents:
				input.platformFeeCents + (input.passStripeFeesToCustomer ? input.stripeFeeCents : 0),
		}
	})
