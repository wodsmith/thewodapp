import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/event-divisions",
)({
  loader: ({ params }) => {
    throw redirect({
      to: "/compete/organizer/$competitionId/events",
      params: { competitionId: params.competitionId },
      search: { tab: "advanced-settings" },
    })
  },
})
