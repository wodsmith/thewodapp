/**
 * Competition Invites — organizer route shell
 *
 * Phase 1 of ADR-0011. Tabs:
 *   - Roster (placeholder until 1.7)
 *   - Sources (live)
 *   - Round History / Email Templates / Series Global (placeholders)
 *
 * Loader enforces MANAGE_COMPETITIONS on the championship's organizing
 * team via `listInviteSourcesFn`, which performs the same check
 * server-side. A redirect fires on auth failure; a thrown error bubbles
 * to the parent error boundary on permission failure.
 */
// @lat: [[competition-invites#Organizer route shell]]

import {
  createFileRoute,
  getRouteApi,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { ChampionshipRosterTable } from "@/components/organizer/invites/championship-roster-table"
import { InviteSourcesList } from "@/components/organizer/invites/invite-sources-list"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePostHog } from "@/lib/posthog"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import {
  getChampionshipRosterFn,
  listInviteSourcesFn,
} from "@/server-fns/competition-invite-fns"

const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/invites/",
)({
  staleTime: 10_000,
  component: InvitesPage,
  loader: async ({ params, context, parentMatchPromise }) => {
    const session = context.session
    if (!session?.user?.id) {
      throw redirect({
        to: "/sign-in",
        search: {
          redirect: `/compete/organizer/${params.competitionId}/invites`,
        },
      })
    }

    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    // listInviteSourcesFn enforces MANAGE_COMPETITIONS on the championship
    // team; it throws on missing permission, which the parent route's
    // error boundary handles consistently with the rest of the dashboard.
    const [sourcesResult, divisionsResult] = await Promise.all([
      listInviteSourcesFn({
        data: { championshipCompetitionId: params.competitionId },
      }),
      getCompetitionDivisionsWithCountsFn({
        data: {
          competitionId: params.competitionId,
          teamId: competition.organizingTeamId,
        },
      }),
    ])
    const {
      sources,
      competitionNamesById,
      seriesNamesById,
      seriesCompCountsById,
    } = sourcesResult

    const divisions = (divisionsResult.divisions ?? []).map(
      (d: { id: string; label: string }) => ({ id: d.id, label: d.label }),
    )

    // Load roster for the first division only; the UI can switch divisions
    // client-side in later phases.
    const firstDivisionId = divisions[0]?.id
    const roster = firstDivisionId
      ? await getChampionshipRosterFn({
          data: {
            championshipCompetitionId: params.competitionId,
            divisionId: firstDivisionId,
          },
        })
      : { rows: [] }

    return {
      sources,
      competitionNamesById,
      seriesNamesById,
      seriesCompCountsById,
      divisions,
      roster,
      activeDivisionId: firstDivisionId,
    }
  },
})

function InvitesPage() {
  const {
    sources,
    competitionNamesById,
    seriesNamesById,
    seriesCompCountsById,
    roster,
  } = Route.useLoaderData()
  const { competition } = parentRoute.useLoaderData()
  const { competitionId } = Route.useParams()
  const { posthog } = usePostHog()
  const navigate = useNavigate()
  const [flagEnabled, setFlagEnabled] = useState(() =>
    posthog.isFeatureEnabled("competition-invites"),
  )
  useEffect(() => {
    const unsubscribe = posthog.onFeatureFlags(() => {
      setFlagEnabled(posthog.isFeatureEnabled("competition-invites"))
    })
    return unsubscribe
  }, [posthog])
  useEffect(() => {
    if (flagEnabled === false) {
      navigate({
        to: "/compete/organizer/$competitionId",
        replace: true,
        params: { competitionId },
      })
    }
  }, [flagEnabled, competitionId, navigate])
  const [tab, setTab] = useState("roster")

  if (flagEnabled === false) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invites</h1>
        <p className="text-muted-foreground">
          Define qualification sources and invite athletes to {competition.name}
          .
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="rounds" disabled>
            Round History
          </TabsTrigger>
          <TabsTrigger value="templates" disabled>
            Email Templates
          </TabsTrigger>
          <TabsTrigger value="series-global" disabled>
            Series Global
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roster" className="mt-4">
          <ChampionshipRosterTable rows={roster.rows} />
        </TabsContent>

        <TabsContent value="sources" className="mt-4">
          <InviteSourcesList
            sources={sources}
            competitionNamesById={competitionNamesById}
            seriesNamesById={seriesNamesById}
            seriesCompCountsById={seriesCompCountsById}
          />
        </TabsContent>

        <TabsContent value="rounds" className="mt-4">
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Round history arrives in Phase 3.
          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Email templates arrive in Phase 4.
          </div>
        </TabsContent>

        <TabsContent value="series-global" className="mt-4">
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Series global integration arrives in Phase 5.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
