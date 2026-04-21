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

import { createFileRoute, getRouteApi, redirect } from "@tanstack/react-router"
import { useState } from "react"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { InviteSourcesList } from "@/components/organizer/invites/invite-sources-list"
import { listInviteSourcesFn } from "@/server-fns/competition-invite-fns"

const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/invites/",
)({
  staleTime: 10_000,
  component: InvitesPage,
  loader: async ({ params, context }) => {
    const session = context.session
    if (!session?.user?.id) {
      throw redirect({
        to: "/sign-in",
        search: {
          redirect: `/compete/organizer/${params.competitionId}/invites`,
        },
      })
    }

    // listInviteSourcesFn enforces MANAGE_COMPETITIONS on the championship
    // team; it throws on missing permission, which the parent route's
    // error boundary handles consistently with the rest of the dashboard.
    const { sources } = await listInviteSourcesFn({
      data: { championshipCompetitionId: params.competitionId },
    })

    return { sources }
  },
})

function InvitesPage() {
  const { sources } = Route.useLoaderData()
  const { competition } = parentRoute.useLoaderData()
  const [tab, setTab] = useState("roster")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invites</h1>
        <p className="text-muted-foreground">
          Define qualification sources and invite athletes to {competition.name}.
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
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Roster table arrives in the next commit.
          </div>
        </TabsContent>

        <TabsContent value="sources" className="mt-4">
          <InviteSourcesList
            sources={sources}
            competitionNamesById={{}}
            seriesNamesById={{}}
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
