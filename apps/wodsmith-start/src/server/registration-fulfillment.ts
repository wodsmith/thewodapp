import "server-only"

import { and, eq } from "drizzle-orm"
import { getDb } from "@/db"
import {
  COMMERCE_PRODUCT_TYPE,
  COMMERCE_PURCHASE_STATUS,
  type CompetitionProductDelivery,
  commerceProductTable,
  commercePurchaseTable,
  competitionProductsTable,
  competitionProductVariantsTable,
} from "@/db/schema"
import {
  type DownloadableProduct,
  getUserDownloadableProducts,
} from "@/server/downloadable-products"

export interface RegistrationAddonPurchase {
  id: string
  productId: string
  name: string
  description: string | null
  delivery: CompetitionProductDelivery
  quantity: number
  variantLabel: string | null
}

export interface RegistrationFulfillment {
  purchases: RegistrationAddonPurchase[]
  downloads: DownloadableProduct[]
}

export async function getUserCompetitionFulfillment(
  userId: string,
  competitionId: string,
): Promise<RegistrationFulfillment> {
  const db = getDb()
  const [downloads, purchases] = await Promise.all([
    getUserDownloadableProducts(userId).then((products) =>
      products.filter((product) => product.competition.id === competitionId),
    ),
    db
      .select({
        id: commercePurchaseTable.id,
        productId: competitionProductsTable.id,
        name: competitionProductsTable.name,
        description: competitionProductsTable.description,
        delivery: competitionProductsTable.delivery,
        quantity: commercePurchaseTable.quantity,
        variantLabel: competitionProductVariantsTable.label,
      })
      .from(commercePurchaseTable)
      .innerJoin(
        commerceProductTable,
        eq(commercePurchaseTable.productId, commerceProductTable.id),
      )
      .innerJoin(
        competitionProductsTable,
        eq(commerceProductTable.resourceId, competitionProductsTable.id),
      )
      .leftJoin(
        competitionProductVariantsTable,
        eq(commercePurchaseTable.variantId, competitionProductVariantsTable.id),
      )
      .where(
        and(
          eq(commercePurchaseTable.userId, userId),
          eq(commercePurchaseTable.competitionId, competitionId),
          eq(commercePurchaseTable.status, COMMERCE_PURCHASE_STATUS.COMPLETED),
          eq(commerceProductTable.type, COMMERCE_PRODUCT_TYPE.ADDON),
        ),
      ),
  ])

  return { purchases, downloads }
}
