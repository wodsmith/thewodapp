/**
 * Organizer check-in landing page.
 *
 * Explains how day-of check-in works and opens the athlete-facing kiosk in a
 * new tab so the organizer keeps their dashboard. The kiosk itself lives on
 * the public route so volunteers can run it from their own accounts.
 */
// @lat: [[organizer-dashboard#Check-In Kiosk]]

import { createFileRoute, getRouteApi, redirect } from "@tanstack/react-router"
import { canUseDayOfCheckIn } from "@/lib/competitions/scheduling-check-in-gates"
import { CheckInInstructions } from "./-components/check-in-instructions"

const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/check-in",
)({
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const competition = parentMatch.loaderData?.competition

    if (!competition || !canUseDayOfCheckIn(competition.competitionType)) {
      throw redirect({
        to: "/compete/organizer/$competitionId",
        params: { competitionId: params.competitionId },
      })
    }
  },
  component: CheckInLandingPage,
})

function CheckInLandingPage() {
  const { competition } = parentRoute.useLoaderData()

  return <CheckInInstructions competitionSlug={competition.slug} />
}
