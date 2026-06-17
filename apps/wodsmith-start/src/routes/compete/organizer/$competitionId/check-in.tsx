/**
 * Organizer check-in landing page.
 *
 * Explains how day-of check-in works and opens the athlete-facing kiosk in a
 * new tab so the organizer keeps their dashboard. The kiosk itself lives on
 * the public route so volunteers can run it from their own accounts.
 */
// @lat: [[organizer-dashboard#Check-In Kiosk]]

import { createFileRoute, getRouteApi, redirect } from "@tanstack/react-router"
import { ClipboardCheck, ExternalLink } from "lucide-react"
import { OrganizerEmptyState } from "@/components/organizer/empty-state"

const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute("/compete/organizer/$competitionId/check-in")(
  {
    loader: async ({ params, parentMatchPromise }) => {
      const parentMatch = await parentMatchPromise
      const competition = parentMatch.loaderData?.competition

      // Check-in only exists for in-person competitions
      if (!competition || competition.competitionType === "online") {
        throw redirect({
          to: "/compete/organizer/$competitionId",
          params: { competitionId: params.competitionId },
        })
      }
    },
    component: CheckInLandingPage,
  },
)

function CheckInLandingPage() {
  const { competition } = parentRoute.useLoaderData()

  return (
    <OrganizerEmptyState
      icon={ClipboardCheck}
      title="Day-of check-in"
      description="Run check-in from a shared device at the door. Search for an athlete and tap check in to mark their whole team as arrived. Athletes can sign any missing waivers right on the device. Volunteers on this competition can also run the kiosk from their volunteer dashboard."
      actionLabel="Open check-in kiosk"
      actionIcon={<ExternalLink className="h-4 w-4" />}
      onAction={() =>
        window.open(
          `/compete/${competition.slug}/check-in`,
          "_blank",
          "noopener,noreferrer",
        )
      }
    />
  )
}
