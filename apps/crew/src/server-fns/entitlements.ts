/**
 * Server functions for entitlement checks
 * These can be called from client components via useServerFn
 */
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { FEATURES } from "@/config/features"
import { hasFeature } from "@/server/entitlements"
import { getSessionFromCookie } from "@/utils/auth"
import { getActiveTeamId } from "@/utils/team-auth"

/**
 * Check if the active team has access to workout tracking
 * Returns false if no session or no active team
 */
export const checkWorkoutTrackingAccess = createServerFn({
  method: "GET",
}).handler(async (): Promise<boolean> => {
  const session = await getSessionFromCookie()
  if (!session?.user) {
    return false
  }

  const activeTeamId = await getActiveTeamId()
  if (!activeTeamId) {
    return false
  }

  return hasFeature(activeTeamId, FEATURES.WORKOUT_TRACKING)
})

/**
 * Check if a specific team has access to a given feature.
 * Used by route loaders that already know the team ID.
 */
export const checkTeamHasFeatureFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        teamId: z.string().min(1),
        featureKey: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    return hasFeature(data.teamId, data.featureKey)
  })
