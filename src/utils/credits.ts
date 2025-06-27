import "server-only"
import { and, asc, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm"
import { CREDIT_PACKAGES, FREE_MONTHLY_CREDITS } from "@/constants"
import { getDB } from "@/db"
import {
	CREDIT_TRANSACTION_TYPE,
	creditTransactionTable,
	purchasedItemsTable,
	userTable,
} from "@/db/schema"
import { type KVSession, updateAllSessionsOfUser } from "./kv-session"

export type CreditPackage = (typeof CREDIT_PACKAGES)[number]

export function getCreditPackage(packageId: string): CreditPackage | undefined {
	return CREDIT_PACKAGES.find((pkg) => pkg.id === packageId)
}

function shouldRefreshCredits(session: KVSession, currentTime: Date): boolean {
	// Check if it's been at least a month since last refresh
	if (!session.user.lastCreditRefreshAt) {
		return true
	}

	// Calculate the date exactly one month after the last refresh
	const oneMonthAfterLastRefresh = new Date(session.user.lastCreditRefreshAt)
	oneMonthAfterLastRefresh.setMonth(oneMonthAfterLastRefresh.getMonth() + 1)

	// Only refresh if we've passed the one month mark
	return currentTime >= oneMonthAfterLastRefresh
}

async function processExpiredCredits(userId: string, currentTime: Date) {
	const db = getDB()
	// Find all expired transactions that haven't been processed and have remaining credits
	// Order by type to process MONTHLY_REFRESH first, then by creation date
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
			// First, mark the transaction as processed to prevent double processing
			await db
				.update(creditTransactionTable)
				.set({
					expirationDateProcessedAt: currentTime,
					remainingAmount: 0, // All remaining credits are expired
				})
				.where(eq(creditTransactionTable.id, transaction.id))

			// Then deduct the expired credits from user's balance
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

export async function updateUserCredits(userId: string, creditsToAdd: number) {
	const db = getDB()
	await db
		.update(userTable)
		.set({
			currentCredits: sql`${userTable.currentCredits} + ${creditsToAdd}`,
		})
		.where(eq(userTable.id, userId))

	// Update all KV sessions to reflect the new credit balance
	await updateAllSessionsOfUser(userId)
}

async function updateLastRefreshDate(userId: string, date: Date) {
	const db = getDB()
	await db
		.update(userTable)
		.set({
			lastCreditRefreshAt: date,
		})
		.where(eq(userTable.id, userId))
}

export async function logTransaction({
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
	const db = getDB()
	await db.insert(creditTransactionTable).values({
		userId,
		amount,
		remainingAmount: amount, // Initialize remaining amount to be the same as amount
		type,
		description,
		expirationDate,
		paymentIntentId,
	})
}

export async function addFreeMonthlyCreditsIfNeeded(
	session: KVSession,
): Promise<number> {
	const currentTime = new Date()

	// Check if it's been at least a month since last refresh
	if (shouldRefreshCredits(session, currentTime)) {
		// Double check the last refresh date from the database to prevent race conditions
		const db = getDB()
		const user = await db.query.userTable.findFirst({
			where: eq(userTable.id, session.userId),
			columns: {
				lastCreditRefreshAt: true,
				currentCredits: true,
			},
		})

		// This should prevent race conditions between multiple sessions
		if (
			!shouldRefreshCredits(
				{
					...session,
					user: {
						...session.user,
						lastCreditRefreshAt: user?.lastCreditRefreshAt ?? null,
					},
				},
				currentTime,
			)
		) {
			return user?.currentCredits ?? 0
		}

		// Process any expired credits first
		await processExpiredCredits(session.userId, currentTime)

		// Add free monthly credits with 1 month expiration
		const expirationDate = new Date(currentTime)
		expirationDate.setMonth(expirationDate.getMonth() + 1)

		await updateUserCredits(session.userId, FREE_MONTHLY_CREDITS)
		await logTransaction({
			userId: session.userId,
			amount: FREE_MONTHLY_CREDITS,
			description: "Free monthly credits",
			type: CREDIT_TRANSACTION_TYPE.MONTHLY_REFRESH,
			expirationDate,
		})

		// Update last refresh date
		await updateLastRefreshDate(session.userId, currentTime)

		// Get the updated credit balance from the database
		const updatedUser = await db.query.userTable.findFirst({
			where: eq(userTable.id, session.userId),
			columns: {
				currentCredits: true,
			},
		})

		return updatedUser?.currentCredits ?? 0
	}

	return session.user.currentCredits
}

export async function hasEnoughCredits({
	userId,
	requiredCredits,
}: {
	userId: string
	requiredCredits: number
}) {
	const user = await getDB().query.userTable.findFirst({
		where: eq(userTable.id, userId),
		columns: {
			currentCredits: true,
		},
	})
	if (!user) return false

	return user.currentCredits >= requiredCredits
}

export async function consumeCredits({
	userId,
	amount,
	description,
}: {
	userId: string
	amount: number
	description: string
}) {
	const db = getDB()

	// First check if user has enough credits
	const user = await db.query.userTable.findFirst({
		where: eq(userTable.id, userId),
		columns: {
			currentCredits: true,
		},
	})

	if (!user || user.currentCredits < amount) {
		throw new Error("Insufficient credits")
	}

	// Get all non-expired transactions with remaining credits, ordered by creation date
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

	let remainingToDeduct = amount

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
			currentCredits: sql`${userTable.currentCredits} - ${amount}`,
		})
		.where(eq(userTable.id, userId))

	// Log the usage transaction
	await db.insert(creditTransactionTable).values({
		userId,
		amount: -amount,
		remainingAmount: 0, // Usage transactions don't have remaining amount
		type: CREDIT_TRANSACTION_TYPE.USAGE,
		description,
		createdAt: new Date(),
		updatedAt: new Date(),
	})

	// Get updated credit balance
	const updatedUser = await db.query.userTable.findFirst({
		where: eq(userTable.id, userId),
		columns: {
			currentCredits: true,
		},
	})

	// Update all KV sessions to reflect the new credit balance
	await updateAllSessionsOfUser(userId)

	return updatedUser?.currentCredits ?? 0
}

export async function getCreditTransactions({
	userId,
	page = 1,
	limit = 10,
}: {
	userId: string
	page?: number
	limit?: number
}) {
	const db = getDB()
	const transactions = await db.query.creditTransactionTable.findMany({
		where: eq(creditTransactionTable.userId, userId),
		orderBy: [desc(creditTransactionTable.createdAt)],
		limit,
		offset: (page - 1) * limit,
		columns: {
			expirationDateProcessedAt: false,
			remainingAmount: false,
			userId: false,
		},
	})

	const total = await db
		.select({ count: sql<number>`count(*)` })
		.from(creditTransactionTable)
		.where(eq(creditTransactionTable.userId, userId))
		.then((result) => result[0].count)

	return {
		transactions,
		pagination: {
			total,
			pages: Math.ceil(total / limit),
			current: page,
		},
	}
}

export async function getUserPurchasedItems(userId: string) {
	const db = getDB()
	const purchasedItems = await db.query.purchasedItemsTable.findMany({
		where: eq(purchasedItemsTable.userId, userId),
	})

	// Create a map of purchased items for easy lookup
	return new Set(
		purchasedItems.map((item) => `${item.itemType}:${item.itemId}`),
	)
}
