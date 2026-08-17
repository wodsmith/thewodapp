import { COMPETITION_PRODUCT_ACCESS } from "@/db/schema"

export function hasDownloadEntitlement(
  product: { id: string; competitionId: string; access: string },
  entitlements: {
    registeredCompetitionIds: ReadonlySet<string>
    purchasedProductIds: ReadonlySet<string>
  },
): boolean {
  if (
    product.access === COMPETITION_PRODUCT_ACCESS.INCLUDED_WITH_REGISTRATION
  ) {
    return entitlements.registeredCompetitionIds.has(product.competitionId)
  }
  if (product.access === COMPETITION_PRODUCT_ACCESS.OPTIONAL_PURCHASE) {
    return entitlements.purchasedProductIds.has(product.id)
  }
  return false
}
