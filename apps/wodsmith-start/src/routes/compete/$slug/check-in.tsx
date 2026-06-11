/**
 * Volunteer / organizer day-of check-in kiosk.
 *
 * Iterates teams registered for the competition, allows searching, marking
 * a team as checked in, and signing missing waivers on behalf of an athlete
 * (handed the iPad).
 */

import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCompetitionWaiversFn } from "@/server-fns/waiver-fns"
import { CheckInKiosk } from "./check-in/-components/check-in-kiosk"

export const Route = createFileRoute("/compete/$slug/check-in")({
  loader: async ({ parentMatchPromise, params }) => {
    const parentMatch = await parentMatchPromise
    const competition = parentMatch.loaderData?.competition
    const session = parentMatch.loaderData?.session ?? null
    const canManage = parentMatch.loaderData?.canManage ?? false
    const isVolunteer = parentMatch.loaderData?.isVolunteer ?? false

    if (!competition) {
      throw new Error("Competition not found")
    }

    if (competition.competitionType === "online") {
      throw redirect({
        to: "/compete/$slug",
        params: { slug: params.slug },
      })
    }

    if (!session) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: `/compete/${params.slug}/check-in` },
      })
    }

    const hasAccess = canManage || isVolunteer
    if (!hasAccess) {
      throw new Error(
        "You don't have access to check-in for this competition. Check-in is available to organizers and to volunteers on the competition team. If you're volunteering, ask the organizer to add you as a volunteer, then sign in and reload this page.",
      )
    }

    const { waivers } = await getCompetitionWaiversFn({
      data: { competitionId: competition.id },
    })

    return {
      competition,
      waivers,
    }
  },
  component: CheckInPage,
  errorComponent: CheckInError,
  head: ({ loaderData }) => {
    const competition = loaderData?.competition
    if (!competition) {
      return { meta: [{ title: "Check-In" }] }
    }
    return {
      meta: [{ title: `Check-In - ${competition.name}` }],
    }
  },
})

function CheckInPage() {
  const { competition, waivers } = Route.useLoaderData()
  const { slug } = Route.useParams()

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/compete/$slug" params={{ slug }}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Competition
            </Link>
          </Button>
          <div className="text-right">
            <h1 className="text-xl font-bold">Check-In</h1>
            <p className="text-sm text-muted-foreground">{competition.name}</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <CheckInKiosk competitionId={competition.id} waivers={waivers} />
      </div>
    </div>
  )
}

function CheckInError({ error }: { error: Error }) {
  const { slug } = Route.useParams()

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-xl font-bold">Check-in unavailable</h1>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/compete/$slug" params={{ slug }}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Competition
          </Link>
        </Button>
      </div>
    </div>
  )
}
