import { createFileRoute, notFound, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/scoring",
)({
  staleTime: 10_000,
  loader: async ({ parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const loaderData = parentMatch.loaderData
    if (!loaderData) {
      throw notFound()
    }

    return {
      competition: loaderData.competition,
    }
  },
  component: Outlet,
})
