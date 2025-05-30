'use server'

import { createServerAction, ZSAError } from "zsa";
import { z } from "zod";
import { getSessionFromCookie } from "@/utils/auth";
import { withRateLimit, RATE_LIMITS } from "@/utils/with-rate-limit";
import { hasEnoughCredits, consumeCredits } from "@/utils/credits";
import { getDB } from "@/db";
import { purchasedItemsTable, PURCHASABLE_ITEM_TYPE } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { COMPONENTS } from "@/app/(dashboard)/dashboard/marketplace/components-catalog";

const purchaseSchema = z.object({
  itemId: z.string(),
  itemType: z.enum([PURCHASABLE_ITEM_TYPE.COMPONENT]), // Add more types as they become available
});

export const purchaseAction = createServerAction()
  .input(purchaseSchema)
  .handler(async ({ input }) => {
    return withRateLimit(
      async () => {
        const session = await getSessionFromCookie();

        if (!session) {
          throw new ZSAError(
            "NOT_AUTHORIZED",
            "You must be logged in to make purchases"
          );
        }

        // Get item details based on type
        let itemDetails: { name: string; credits: number } | undefined;
        switch (input.itemType) {
          case PURCHASABLE_ITEM_TYPE.COMPONENT:
            itemDetails = COMPONENTS.find(c => c.id === input.itemId);
            break;
          // Add more cases as new item types are added
        }

        if (!itemDetails) {
          throw new ZSAError(
            "NOT_FOUND",
            "Item not found"
          );
        }

        // Check if user has enough credits
        const hasCredits = await hasEnoughCredits({
          userId: session.userId,
          requiredCredits: itemDetails.credits,
        });

        if (!hasCredits) {
          throw new ZSAError(
            "INSUFFICIENT_CREDITS",
            "You don't have enough credits to purchase this item"
          );
        }

        const db = getDB();

        // Check if user already owns the item
        const existingPurchase = await db.query.purchasedItemsTable.findFirst({
          where: and(
            eq(purchasedItemsTable.userId, session.userId),
            eq(purchasedItemsTable.itemType, input.itemType),
            eq(purchasedItemsTable.itemId, input.itemId)
          ),
        });

        if (existingPurchase) {
          throw new ZSAError(
            "CONFLICT",
            "You already own this item"
          );
        }

        // Use credits first
        await consumeCredits({
          userId: session.userId,
          amount: itemDetails.credits,
          description: `Purchased ${input.itemType.toLowerCase()}: ${itemDetails.name}`,
        });

        // Then add item to user's purchased items
        await db.insert(purchasedItemsTable).values({
          userId: session.userId,
          itemType: input.itemType,
          itemId: input.itemId,
        });

        return { success: true };
      },
      RATE_LIMITS.PURCHASE
    );
  });
