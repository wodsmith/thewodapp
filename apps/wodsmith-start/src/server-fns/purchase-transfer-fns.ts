/**
 * Purchase Transfer Server Functions for TanStack Start
 *
 * Handles two-phase transfer of a purchase (and associated registration)
 * from one athlete to another. Organizer initiates, target accepts via email.
 *
 * OBSERVABILITY:
 * - All transfer operations are logged with request context
 * - Purchase IDs, competition IDs, and transfer states are tracked
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, ne } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  COMMERCE_PRODUCT_TYPE,
  COMMERCE_PURCHASE_STATUS,
  commerceProductTable,
  commercePurchaseTable,
  competitionRegistrationsTable,
  competitionsTable,
  createPurchaseTransferId,
  PURCHASE_TRANSFER_STATUS,
  purchaseTransfersTable,
  REGISTRATION_STATUS,
  ROLES_ENUM,
  scalingLevelsTable,
  TEAM_PERMISSIONS,
  userTable,
} from "@/db/schema"
import {
  addRequestContextAttribute,
  logInfo,
  logWarning,
  updateRequestContext,
} from "@/lib/logging"
import { requireVerifiedEmail } from "@/utils/auth"

// ============================================================================
// Initiate Purchase Transfer
// ============================================================================

const initiatePurchaseTransferInputSchema = z.object({
  purchaseId: z.string().min(1),
  targetEmail: z.string().email(),
  notes: z.string().optional(),
})

/**
 * Initiate a purchase transfer to another athlete by email.
 *
 * - Verifies the purchase is COMPLETED
 * - Checks no active transfer already exists
 * - For COMPETITION_REGISTRATION: validates linked registration is active
 *   and target email has no existing registration in the same division
 * - Creates a transfer record and sends the transfer email
 * Requires MANAGE_COMPETITIONS permission on the organizing team.
 */
export const initiatePurchaseTransferFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    initiatePurchaseTransferInputSchema.parse(data),
  )
  .handler(async ({ data: input }) => {
    const session = await requireVerifiedEmail()
    const db = getDb()

    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("purchaseId", input.purchaseId)

    // 1. Load the purchase — must exist and be COMPLETED
    const purchase = await db.query.commercePurchaseTable.findFirst({
      where: eq(commercePurchaseTable.id, input.purchaseId),
    })

    if (!purchase) throw new Error("Purchase not found")
    if (purchase.status !== COMMERCE_PURCHASE_STATUS.COMPLETED) {
      throw new Error("Only completed purchases can be transferred")
    }

    // 2. Load the product to get type
    const product = await db.query.commerceProductTable.findFirst({
      where: eq(commerceProductTable.id, purchase.productId),
      columns: { id: true, type: true },
    })

    if (!product) throw new Error("Product not found")

    // 3. Authorization — for COMPETITION_REGISTRATION, check MANAGE_COMPETITIONS
    let competition:
      | { id: string; organizingTeamId: string; name: string }
      | undefined
    let registration:
      | { id: string; status: string; divisionId: string | null }
      | undefined
    let divisionLabel: string | null = null

    if (product.type === COMMERCE_PRODUCT_TYPE.COMPETITION_REGISTRATION) {
      if (!purchase.competitionId) {
        throw new Error("Purchase is missing competitionId")
      }

      addRequestContextAttribute("competitionId", purchase.competitionId)

      competition = await db.query.competitionsTable.findFirst({
        where: eq(competitionsTable.id, purchase.competitionId),
        columns: { id: true, organizingTeamId: true, name: true },
      })

      if (!competition) throw new Error("Competition not found")

      if (session.user?.role !== ROLES_ENUM.ADMIN) {
        const team = session.teams?.find(
          (t) => t.id === competition!.organizingTeamId,
        )
        if (!team?.permissions.includes(TEAM_PERMISSIONS.MANAGE_COMPETITIONS)) {
          throw new Error("Missing required permission: manage_competitions")
        }
      }
    }

    // 4. Check no active (INITIATED) transfer exists for this purchase
    const existingTransfer = await db.query.purchaseTransfersTable.findFirst({
      where: and(
        eq(purchaseTransfersTable.purchaseId, input.purchaseId),
        eq(
          purchaseTransfersTable.transferState,
          PURCHASE_TRANSFER_STATUS.INITIATED,
        ),
      ),
      columns: { id: true },
    })

    if (existingTransfer) {
      throw new Error(
        "A pending transfer already exists for this purchase. Cancel it before initiating a new one.",
      )
    }

    // 5. Validate target email is not the source user's email
    const sourceUser = await db.query.userTable.findFirst({
      where: eq(userTable.id, purchase.userId),
      columns: { id: true, email: true, firstName: true, lastName: true },
    })

    if (!sourceUser) throw new Error("Source user not found")

    if (
      sourceUser.email &&
      sourceUser.email.toLowerCase() === input.targetEmail.toLowerCase()
    ) {
      throw new Error("Cannot transfer a purchase to the current owner")
    }

    // 6. For COMPETITION_REGISTRATION: verify linked registration is active
    //    and no existing active registration for target email in the same division
    if (
      product.type === COMMERCE_PRODUCT_TYPE.COMPETITION_REGISTRATION &&
      competition &&
      purchase.competitionId
    ) {
      registration = await db.query.competitionRegistrationsTable.findFirst({
        where: and(
          eq(competitionRegistrationsTable.eventId, purchase.competitionId),
          eq(competitionRegistrationsTable.userId, purchase.userId),
          ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
        ),
        columns: { id: true, status: true, divisionId: true },
      })

      if (!registration) {
        throw new Error(
          "No active registration found for this purchase. The registration may have been removed.",
        )
      }

      // Get division label for the email
      if (registration.divisionId) {
        const division = await db.query.scalingLevelsTable.findFirst({
          where: eq(scalingLevelsTable.id, registration.divisionId),
          columns: { label: true },
        })
        divisionLabel = division?.label ?? null
      }

      // Check if any user with that email already has an active registration
      // in the same division for this competition
      if (registration.divisionId) {
        const targetUser = await db.query.userTable.findFirst({
          where: eq(userTable.email, input.targetEmail),
          columns: { id: true },
        })

        if (targetUser) {
          const conflictingRegistration =
            await db.query.competitionRegistrationsTable.findFirst({
              where: and(
                eq(
                  competitionRegistrationsTable.eventId,
                  purchase.competitionId,
                ),
                eq(competitionRegistrationsTable.userId, targetUser.id),
                eq(
                  competitionRegistrationsTable.divisionId,
                  registration.divisionId,
                ),
                ne(
                  competitionRegistrationsTable.status,
                  REGISTRATION_STATUS.REMOVED,
                ),
              ),
              columns: { id: true },
            })

          if (conflictingRegistration) {
            throw new Error(
              "The target athlete already has an active registration in this division",
            )
          }
        }
      }
    }

    logInfo({
      message: "[PurchaseTransfer] Initiating purchase transfer",
      attributes: {
        purchaseId: input.purchaseId,
        sourceUserId: purchase.userId,
        targetEmail: input.targetEmail,
        competitionId: purchase.competitionId ?? "none",
      },
    })

    // 7. Create the transfer record
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const transferId = createPurchaseTransferId()

    await db.insert(purchaseTransfersTable).values({
      id: transferId,
      purchaseId: input.purchaseId,
      sourceUserId: purchase.userId,
      targetEmail: input.targetEmail,
      transferState: PURCHASE_TRANSFER_STATUS.INITIATED,
      initiatedBy: session.userId,
      expiresAt,
      notes: input.notes ?? null,
    })

    // 8. Send the transfer email
    if (competition) {
      const { sendPurchaseTransferEmail } = await import("@/utils/email")
      await sendPurchaseTransferEmail({
        email: input.targetEmail,
        transferId,
        competitionName: competition.name,
        divisionName: divisionLabel,
        sourceAthleteName:
          [sourceUser.firstName, sourceUser.lastName]
            .filter(Boolean)
            .join(" ") ||
          sourceUser.email ||
          "Unknown",
        expiresAt,
      })
    }

    logInfo({
      message: "[PurchaseTransfer] Purchase transfer initiated successfully",
      attributes: {
        transferId,
        purchaseId: input.purchaseId,
        targetEmail: input.targetEmail,
      },
    })

    return { success: true, transferId }
  })

// ============================================================================
// Cancel Purchase Transfer
// ============================================================================

const cancelPurchaseTransferInputSchema = z.object({
  transferId: z.string().min(1),
})

/**
 * Cancel an INITIATED purchase transfer.
 *
 * - Only INITIATED transfers can be cancelled
 * - For COMPETITION_REGISTRATION: requires MANAGE_COMPETITIONS permission
 */
export const cancelPurchaseTransferFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cancelPurchaseTransferInputSchema.parse(data),
  )
  .handler(async ({ data: input }) => {
    const session = await requireVerifiedEmail()
    const db = getDb()

    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("transferId", input.transferId)

    // 1. Load the transfer — must be INITIATED
    const transfer = await db.query.purchaseTransfersTable.findFirst({
      where: eq(purchaseTransfersTable.id, input.transferId),
    })

    if (!transfer) throw new Error("Transfer not found")
    if (transfer.transferState !== PURCHASE_TRANSFER_STATUS.INITIATED) {
      throw new Error(
        `Transfer cannot be cancelled — current state: ${transfer.transferState}`,
      )
    }

    // Check if expired
    if (transfer.expiresAt < new Date()) {
      logWarning({
        message: "[PurchaseTransfer] Attempting to cancel an expired transfer",
        attributes: { transferId: input.transferId },
      })
    }

    // 2. Load purchase to get product context
    const purchase = await db.query.commercePurchaseTable.findFirst({
      where: eq(commercePurchaseTable.id, transfer.purchaseId),
      columns: { id: true, productId: true, competitionId: true },
    })

    if (!purchase) throw new Error("Purchase not found")

    // 3. Load product to check type
    const product = await db.query.commerceProductTable.findFirst({
      where: eq(commerceProductTable.id, purchase.productId),
      columns: { id: true, type: true },
    })

    if (!product) throw new Error("Product not found")

    // 4. For COMPETITION_REGISTRATION: require MANAGE_COMPETITIONS permission
    if (
      product.type === COMMERCE_PRODUCT_TYPE.COMPETITION_REGISTRATION &&
      purchase.competitionId
    ) {
      addRequestContextAttribute("competitionId", purchase.competitionId)

      const competition = await db.query.competitionsTable.findFirst({
        where: eq(competitionsTable.id, purchase.competitionId),
        columns: { id: true, organizingTeamId: true },
      })

      if (!competition) throw new Error("Competition not found")

      if (session.user?.role !== ROLES_ENUM.ADMIN) {
        const team = session.teams?.find(
          (t) => t.id === competition.organizingTeamId,
        )
        if (!team?.permissions.includes(TEAM_PERMISSIONS.MANAGE_COMPETITIONS)) {
          throw new Error("Missing required permission: manage_competitions")
        }
      }
    }

    logInfo({
      message: "[PurchaseTransfer] Cancelling purchase transfer",
      attributes: {
        transferId: input.transferId,
        purchaseId: transfer.purchaseId,
        targetEmail: transfer.targetEmail,
      },
    })

    // 5. Update the transfer state to CANCELLED (include state check to prevent
    //    race condition with concurrent accept)
    const result = await db
      .update(purchaseTransfersTable)
      .set({
        transferState: PURCHASE_TRANSFER_STATUS.CANCELLED,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(purchaseTransfersTable.id, input.transferId),
          eq(
            purchaseTransfersTable.transferState,
            PURCHASE_TRANSFER_STATUS.INITIATED,
          ),
        ),
      )

    if ((result[0]?.affectedRows ?? 0) === 0) {
      throw new Error(
        "Transfer state changed before cancel could complete — it may have been accepted or already cancelled",
      )
    }

    logInfo({
      message: "[PurchaseTransfer] Purchase transfer cancelled successfully",
      attributes: { transferId: input.transferId },
    })

    return { success: true }
  })

// ============================================================================
// Get Pending Transfers for Competition
// ============================================================================

const getPendingTransfersInputSchema = z.object({
  competitionId: z.string().min(1),
})

/**
 * Get all INITIATED (pending) transfers for a competition.
 * Used by the athletes page to show pending transfer badges.
 */
export const getPendingTransfersForCompetitionFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) => getPendingTransfersInputSchema.parse(data))
  .handler(async ({ data: input }) => {
    const session = await requireVerifiedEmail()
    const db = getDb()

    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("competitionId", input.competitionId)

    // Authorization: require MANAGE_COMPETITIONS on the organizing team
    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, input.competitionId),
      columns: { id: true, organizingTeamId: true },
    })

    if (!competition) throw new Error("Competition not found")

    if (session.user?.role !== ROLES_ENUM.ADMIN) {
      const team = session.teams?.find(
        (t) => t.id === competition.organizingTeamId,
      )
      if (!team?.permissions.includes(TEAM_PERMISSIONS.MANAGE_COMPETITIONS)) {
        throw new Error("Missing required permission: manage_competitions")
      }
    }

    // Get all INITIATED transfers for purchases in this competition
    const transfers = await db
      .select({
        id: purchaseTransfersTable.id,
        purchaseId: purchaseTransfersTable.purchaseId,
        targetEmail: purchaseTransfersTable.targetEmail,
        transferState: purchaseTransfersTable.transferState,
        expiresAt: purchaseTransfersTable.expiresAt,
      })
      .from(purchaseTransfersTable)
      .innerJoin(
        commercePurchaseTable,
        eq(purchaseTransfersTable.purchaseId, commercePurchaseTable.id),
      )
      .where(
        and(
          eq(commercePurchaseTable.competitionId, input.competitionId),
          eq(
            purchaseTransfersTable.transferState,
            PURCHASE_TRANSFER_STATUS.INITIATED,
          ),
        ),
      )

    return transfers
  })
