import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { z } from "zod"
import { SeriesLeaderboardPageContent } from "@/components/series-leaderboard-page-content"
import { usePostHog } from "@/lib/posthog"

const searchSchema = z.object({
  division: z.string().optional(),
})

export const Route = createFileRoute(
  "/compete/organizer/series/$groupId/leaderboard",
)({
  validateSearch: searchSchema,
  component: OrganizerSeriesLeaderboardPage,
})

function OrganizerSeriesLeaderboardPage() {
  const { groupId } = Route.useParams()
  const { posthog } = usePostHog()
  const navigate = useNavigate()
  const [flagEnabled, setFlagEnabled] = useState(() =>
    posthog.isFeatureEnabled("competition-global-leaderboard"),
  )

  useEffect(() => {
    const unsubscribe = posthog.onFeatureFlags(() => {
      setFlagEnabled(posthog.isFeatureEnabled("competition-global-leaderboard"))
    })
    return unsubscribe
  }, [posthog])

  useEffect(() => {
    if (flagEnabled === false) {
      navigate({
        to: "/compete/organizer/series/$groupId",
        replace: true,
        params: { groupId },
      })
    }
  }, [flagEnabled, groupId, navigate])

  if (flagEnabled === false) return null

  return <SeriesLeaderboardPageContent groupId={groupId} />
}
