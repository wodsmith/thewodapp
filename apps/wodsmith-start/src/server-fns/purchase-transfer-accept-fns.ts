/**
 * Purchase Transfer Accept Server Functions
 * Public-facing functions for the /transfer/$transferId accept page.
 *
 * getPendingTransferFn — loads transfer details for display (no auth required)
 * acceptPurchaseTransferFn — accepts the transfer (auth required)
 * getTransferSessionFn — returns minimal session info for the accept page
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	commercePurchaseTable,
	competitionRegistrationsTable,
	competitionsTable,
	PURCHASE_TRANSFER_STATUS,
	purchaseTransfersTable,
	scalingLevelsTable,
	teamInvitationTable,
	teamMembershipTable,
	teamTable,
	userTable,
} from "@/db/schema"
import {
	addRequestContextAttribute,
	logInfo,
	updateRequestContext,
} from "@/lib/logging"
import { getSessionFromCookie, requireVerifiedEmail } from "@/utils/auth"
import { handleCompetitionRegistrationTransfer } from "@/server/commerce/transfer-handlers"

// ============================================================================
// Types
// ============================================================================

export interface PendingTransfer {
	id: string
	transferState: string
	expiresAt: Date
	targetEmail: string
	notes: string | null
	sourceUser: {
		firstName: string | null
		lastName: string | null
		email: string | null
	}
	competition: {
		id: string
		name: string
		slug: string
	}
	division: {
		id: string
		label: string
	} | null
	team: {
		id: string
		name: string
	} | null
	teammates: Array<{
		name: string
		email: string | null
		status: "confirmed" | "pending"
	}>
}

// ============================================================================
// Input Schemas
// ============================================================================

const getPendingTransferInputSchema = z.object({
	transferId: z.string().min(1, "Transfer ID is required"),
})

const acceptPurchaseTransferInputSchema = z.object({
	transferId: z.string().min(1, "Transfer ID is required"),
	answers: z
		.array(
			z.object({
				questionId: z.string(),
				answer: z.string(),
			}),
		)
		.optional(),
	waiverSignatures: z
		.array(
			z.object({
				waiverId: z.string(),
			}),
		)
		.optional(),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get pending transfer details for the accept page.
 * No auth required — the link itself is the authorization.
 */
export const getPendingTransferFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getPendingTransferInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Load the transfer record
		const transfer = await db.query.purchaseTransfersTable.findFirst({
			where: eq(purchaseTransfersTable.id, data.transferId),
		})

		if (!transfer) {
			return null
		}

		// Load the source user
		const [sourceUser] = await db
			.select({
				firstName: userTable.firstName,
				lastName: userTable.lastName,
				email: userTable.email,
			})
			.from(userTable)
			.where(eq(userTable.id, transfer.sourceUserId))

		// Load the purchase to get competition/division context
		const [purchase] = await db
			.select()
			.from(commercePurchaseTable)
			.where(eq(commercePurchaseTable.id, transfer.purchaseId))

		if (!purchase || !purchase.competitionId) {
			return {
				id: transfer.id,
				transferState: transfer.transferState,
				expiresAt: transfer.expiresAt,
				targetEmail: transfer.targetEmail,
				notes: transfer.notes,
				sourceUser: sourceUser ?? {
					firstName: null,
					lastName: null,
					email: null,
				},
				competition: null,
				division: null,
				team: null,
				teammates: [],
			}
		}

		// Load competition
		const [competition] = await db
			.select({
				id: competitionsTable.id,
				name: competitionsTable.name,
				slug: competitionsTable.slug,
			})
			.from(competitionsTable)
			.where(eq(competitionsTable.id, purchase.competitionId))

		// Load division (scaling level)
		let division: { id: string; label: string } | null = null
		if (purchase.divisionId) {
			const [div] = await db
				.select({
					id: scalingLevelsTable.id,
					label: scalingLevelsTable.label,
				})
				.from(scalingLevelsTable)
				.where(eq(scalingLevelsTable.id, purchase.divisionId))
			if (div) division = div
		}

		// Find the registration linked to this purchase
		const [registration] = await db
			.select()
			.from(competitionRegistrationsTable)
			.where(
				eq(
					competitionRegistrationsTable.commercePurchaseId,
					transfer.purchaseId,
				),
			)

		// Load team + teammates if team registration
		let team: { id: string; name: string } | null = null
		let teammates: PendingTransfer["teammates"] = []

		if (registration?.athleteTeamId) {
			const [teamRow] = await db
				.select({ id: teamTable.id, name: teamTable.name })
				.from(teamTable)
				.where(eq(teamTable.id, registration.athleteTeamId))
			if (teamRow) team = teamRow

			// Load confirmed team members (excluding source user)
			const memberships = await db
				.select({
					userId: teamMembershipTable.userId,
					firstName: userTable.firstName,
					lastName: userTable.lastName,
					email: userTable.email,
				})
				.from(teamMembershipTable)
				.innerJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
				.where(
					and(
						eq(teamMembershipTable.teamId, registration.athleteTeamId),
						eq(teamMembershipTable.isActive, true),
					),
				)

			// Exclude the source user (they're being transferred away)
			const confirmedTeammates = memberships
				.filter((m) => m.userId !== transfer.sourceUserId)
				.map((m) => ({
					name: [m.firstName, m.lastName].filter(Boolean).join(" "),
					email: m.email,
					status: "confirmed" as const,
				}))

			// Load pending invitations for this team
			const pendingInvites = await db
				.select({
					email: teamInvitationTable.email,
				})
				.from(teamInvitationTable)
				.where(
					and(
						eq(teamInvitationTable.teamId, registration.athleteTeamId),
						isNull(teamInvitationTable.acceptedAt),
					),
				)

			const pendingTeammates = pendingInvites.map((inv) => ({
				name: inv.email,
				email: inv.email,
				status: "pending" as const,
			}))

			teammates = [...confirmedTeammates, ...pendingTeammates]
		}

		return {
			id: transfer.id,
			transferState: transfer.transferState,
			expiresAt: transfer.expiresAt,
			targetEmail: transfer.targetEmail,
			notes: transfer.notes,
			sourceUser: sourceUser ?? {
				firstName: null,
				lastName: null,
				email: null,
			},
			competition: competition ?? null,
			division,
			team,
			teammates,
		} satisfies PendingTransfer
	})

/**
 * Get minimal session info for the accept page.
 * Returns null if not logged in.
 */
export const getTransferSessionFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await getSessionFromCookie()
		if (!session) return null
		return {
			userId: session.userId,
			email: session.user?.email ?? null,
		}
	},
)

/**
 * Accept a purchase transfer.
 * Requires auth — target user must be logged in.
 */
export const acceptPurchaseTransferFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		acceptPurchaseTransferInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		// 1. Auth required
		const session = await requireVerifiedEmail()

		updateRequestContext({ userId: session.userId })
		addRequestContextAttribute("transferId", data.transferId)

		const db = getDb()

		// 2. Load transfer — must be INITIATED and not expired
		const transfer = await db.query.purchaseTransfersTable.findFirst({
			where: eq(purchaseTransfersTable.id, data.transferId),
			with: {
				purchase: {
					with: {
						product: true,
					},
				},
			},
		})

		if (!transfer) {
			throw new Error("Transfer not found")
		}

		if (transfer.transferState !== PURCHASE_TRANSFER_STATUS.INITIATED) {
			if (transfer.transferState === PURCHASE_TRANSFER_STATUS.COMPLETED) {
				throw new Error("This transfer has already been accepted")
			}
			if (transfer.transferState === PURCHASE_TRANSFER_STATUS.CANCELLED) {
				throw new Error("This transfer was cancelled by the organizer")
			}
			if (transfer.transferState === PURCHASE_TRANSFER_STATUS.EXPIRED) {
				throw new Error("This transfer has expired")
			}
			throw new Error("This transfer is no longer available")
		}

		if (new Date(transfer.expiresAt) < new Date()) {
			throw new Error("This transfer has expired")
		}

		// 3. Set target user from session
		const targetUserId = session.userId
		const acceptedEmail = session.user.email

		addRequestContextAttribute("targetUserId", targetUserId)
		addRequestContextAttribute("sourceUserId", transfer.sourceUserId)

		// 4. Execute product-type handler (handles registration, memberships,
		//    heat assignments, answers, waivers, scores, and team swaps)
		if (transfer.purchase.product.type === "COMPETITION_REGISTRATION") {
			const competitionId = transfer.purchase.competitionId
			if (!competitionId) {
				throw new Error(
					"Competition ID missing from purchase for COMPETITION_REGISTRATION transfer",
				)
			}

			await handleCompetitionRegistrationTransfer({
				purchaseId: transfer.purchaseId,
				sourceUserId: transfer.sourceUserId,
				targetUserId,
				competitionId,
				answers: data.answers,
				waiverSignatures: data.waiverSignatures,
			})
		} else {
			throw new Error(
				`Unsupported product type for transfer: ${transfer.purchase.product.type}`,
			)
		}

		// 5. Purchase stays with original payer (invoice belongs to them).
		//    The transfer record tracks the reassignment.

		// 6. Complete the transfer (include state check to prevent race with concurrent cancel)
		const updateResult = await db
			.update(purchaseTransfersTable)
			.set({
				transferState: PURCHASE_TRANSFER_STATUS.COMPLETED,
				targetUserId,
				acceptedEmail,
				completedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(purchaseTransfersTable.id, data.transferId),
					eq(
						purchaseTransfersTable.transferState,
						PURCHASE_TRANSFER_STATUS.INITIATED,
					),
				),
			)

		if ((updateResult[0]?.affectedRows ?? 0) === 0) {
			throw new Error(
				"Transfer state changed before accept could complete — it may have been cancelled",
			)
		}

		logInfo({
			message: "[PurchaseTransfer] Transfer accepted successfully",
			attributes: {
				transferId: data.transferId,
				sourceUserId: transfer.sourceUserId,
				targetUserId,
				purchaseId: transfer.purchaseId,
				productType: transfer.purchase.product.type,
			},
		})

		// Load competition slug for redirect
		let competitionSlug: string | null = null
		if (transfer.purchase.competitionId) {
			const competition = await db.query.competitionsTable.findFirst({
				where: eq(competitionsTable.id, transfer.purchase.competitionId),
				columns: { slug: true },
			})
			competitionSlug = competition?.slug ?? null
		}

		return { success: true, competitionSlug }
	})
