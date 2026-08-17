import { createServerFn } from "@tanstack/react-start"

export type { DownloadableProduct } from "@/server/downloadable-products"
export { hasDownloadEntitlement } from "@/utils/download-entitlement"

// @lat: [[commerce#Downloadable Competition Products#Athlete download library]]
export const getMyDownloadsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const [{ getUserDownloadableProducts }, { requireVerifiedEmail }] =
      await Promise.all([
        import("@/server/downloadable-products"),
        import("@/utils/auth"),
      ])
    const session = await requireVerifiedEmail()
    return { products: await getUserDownloadableProducts(session.userId) }
  },
)
