import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export type {
  RegistrationAddonPurchase,
  RegistrationFulfillment,
} from "@/server/registration-fulfillment"
export type { DownloadableProduct } from "@/server/downloadable-products"

// @lat: [[commerce#Downloadable Competition Products#Athlete download library]]
export const getMyCompetitionFulfillmentFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ competitionId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const [{ getUserCompetitionFulfillment }, { requireVerifiedEmail }] =
      await Promise.all([
        import("@/server/registration-fulfillment"),
        import("@/utils/auth"),
      ])
    const session = await requireVerifiedEmail()
    return getUserCompetitionFulfillment(session.userId, data.competitionId)
  })
