"use server"

import ms from "ms"
import {
	CREDITS_EXPIRATION_YEARS,
	MAX_TRANSACTIONS_PER_PAGE,
} from "@/constants"
import { CREDIT_TRANSACTION_TYPE } from "@/db/schema"
import { getStripe } from "@/lib/stripe"
import { requireVerifiedEmail } from "@/utils/auth"
import {
	getCreditPackage,
	getCreditTransactions,
	logTransaction,
	updateUserCredits,
} from "@/utils/credits"
import { RATE_LIMITS, withRateLimit } from "@/utils/with-rate-limit"

// Action types
type GetTransactionsInput = {
	page: number
	limit?: number
}

type CreatePaymentIntentInput = {
	packageId: string
}

type PurchaseCreditsInput = {
	packageId: string
	paymentIntentId: string
}

export async function getTransactions({
	page,
	limit = MAX_TRANSACTIONS_PER_PAGE,
}: GetTransactionsInput) {
	return withRateLimit(async () => {
		if (page < 1 || limit < 1) {
			throw new Error("Invalid page or limit")
		}

		if (limit > MAX_TRANSACTIONS_PER_PAGE) {
			throw new Error(
				`Limit cannot be greater than ${MAX_TRANSACTIONS_PER_PAGE}`,
			)
		}

		if (!limit) {
			limit = MAX_TRANSACTIONS_PER_PAGE
		}

		const session = await requireVerifiedEmail()

		if (!session?.user?.id) {
			throw new Error("Unauthorized")
		}

		const result = await getCreditTransactions({
			userId: session.user.id,
			page,
			limit,
		})

		return {
			transactions: result.transactions,
			pagination: {
				total: result.pagination.total,
				pages: result.pagination.pages,
				current: result.pagination.current,
			},
		}
	}, RATE_LIMITS.PURCHASE)
}

export async function createPaymentIntent({
	packageId,
}: CreatePaymentIntentInput) {
	return withRateLimit(async () => {
		const session = await requireVerifiedEmail()
		if (!session) {
			throw new Error("Unauthorized")
		}

		try {
			const creditPackage = getCreditPackage(packageId)
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
}

export async function confirmPayment({
	packageId,
	paymentIntentId,
}: PurchaseCreditsInput) {
	return withRateLimit(async () => {
		const session = await requireVerifiedEmail()
		if (!session) {
			throw new Error("Unauthorized")
		}

		try {
			const creditPackage = getCreditPackage(packageId)
			if (!creditPackage) {
				throw new Error("Invalid package")
			}

			// Verify the payment intent
			const paymentIntent =
				await getStripe().paymentIntents.retrieve(paymentIntentId)

			if (paymentIntent.status !== "succeeded") {
				throw new Error("Payment not completed")
			}

			// Verify the payment intent metadata matches
			if (
				paymentIntent.metadata.userId !== session.user.id ||
				paymentIntent.metadata.packageId !== packageId ||
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
				paymentIntentId: paymentIntent?.id,
			})

			return { success: true }
		} catch (error) {
			console.error("Purchase error:", error)
			throw new Error("Failed to process payment")
		}
	}, RATE_LIMITS.PURCHASE)
}
