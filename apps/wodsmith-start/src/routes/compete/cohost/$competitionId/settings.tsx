/**
 * Cohost Competition Settings Route
 *
 * Settings page for capacity, scoring, and rotation configuration.
 * Accessible if the cohost has any of: divisions, scoring, volunteers.
 * Reuses organizer -components/ forms.
 */

import { createFileRoute, getRouteApi, redirect } from "@tanstack/react-router"
import { CapacitySettingsForm } from "@/routes/compete/organizer/$competitionId/-components/capacity-settings-form"
import { RotationSettingsForm } from "@/routes/compete/organizer/$competitionId/-components/rotation-settings-form"
import { ScoringSettingsForm } from "@/routes/compete/organizer/$competitionId/-components/scoring-settings-form"

const parentRoute = getRouteApi("/compete/cohost/$competitionId")

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/settings",
)({
  staleTime: 10_000,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition, permissions } = parentMatch.loaderData!

    // Permission gate: any of the relevant setup permissions
    if (!permissions?.divisions && !permissions?.scoring && !permissions?.volunteers) {
      throw redirect({
        to: "/compete/cohost/$competitionId",
        params: { competitionId: params.competitionId },
      })
    }

    return { competition }
  },
  component: SettingsPage,
  head: ({ loaderData }) => {
    const competition = loaderData?.competition
    if (!competition) {
      return { meta: [{ title: "Competition Not Found" }] }
    }
    return {
      meta: [
        { title: `Settings - ${competition.name}` },
        {
          name: "description",
          content: `Configure settings for ${competition.name}`,
        },
      ],
    }
  },
})

function SettingsPage() {
  const { competition } = Route.useLoaderData()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Competition Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure default settings for your competition
        </p>
      </div>

      {/* Capacity Settings Section */}
      <section>
        <CapacitySettingsForm
          competition={{
            id: competition.id,
            organizingTeamId: competition.organizingTeamId,
            defaultMaxSpotsPerDivision: competition.defaultMaxSpotsPerDivision,
            maxTotalRegistrations: competition.maxTotalRegistrations,
          }}
        />
      </section>

      {/* Scoring Configuration Section */}
      <section>
        <ScoringSettingsForm
          competition={{
            id: competition.id,
            name: competition.name,
            settings: competition.settings,
          }}
        />
      </section>

      {/* Rotation Settings Section */}
      <section>
        <RotationSettingsForm
          competition={{
            id: competition.id,
            name: competition.name,
            defaultHeatsPerRotation: competition.defaultHeatsPerRotation ?? 4,
            defaultLaneShiftPattern:
              competition.defaultLaneShiftPattern ?? "stay",
          }}
        />
      </section>
    </div>
  )
}
