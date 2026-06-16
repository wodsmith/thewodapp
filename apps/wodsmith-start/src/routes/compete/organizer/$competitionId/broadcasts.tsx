import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/broadcasts",
)({
  loader: ({ params }) => {
    throw redirect({
      to: "/compete/organizer/$competitionId/announcements",
      params: { competitionId: params.competitionId },
    })
  },
})
