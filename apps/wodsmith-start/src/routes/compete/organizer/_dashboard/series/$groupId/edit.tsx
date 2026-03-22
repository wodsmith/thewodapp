import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { OrganizerSeriesForm } from "@/components/organizer-series-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getCompetitionGroupByIdFn } from "@/server-fns/competition-fns"
import { getActiveTeamIdFn, getOrganizerTeamsFn } from "@/server-fns/team-fns"

export const Route = createFileRoute(
  "/compete/organizer/_dashboard/series/$groupId/edit",
)({
  component: EditSeriesPage,
  loader: async ({ params, context }) => {
    const { groupId } = params
    const { teams: organizingTeams } = await getOrganizerTeamsFn()
    const isSiteAdmin = context.session?.user?.role === "admin"

    // Fetch group details (needed for both admin and normal flow)
    const groupResult = await getCompetitionGroupByIdFn({ data: { groupId } })

    if (!groupResult.group) {
      return {
        group: null,
        teamId: null,
      }
    }

    if (organizingTeams.length === 0 && !isSiteAdmin) {
      return {
        group: null,
        teamId: null,
      }
    }

    // Use the group's organizing team if user has access
    const groupTeamId = groupResult.group.organizingTeamId
    let teamId: string
    if (isSiteAdmin || organizingTeams.some((t) => t.id === groupTeamId)) {
      teamId = groupTeamId
    } else {
      const activeTeamId = await getActiveTeamIdFn()
      teamId =
        organizingTeams.find((t) => t.id === activeTeamId)?.id ??
        organizingTeams[0].id
    }

    return {
      group: groupResult.group,
      teamId,
    }
  },
})

function EditSeriesPage() {
  const { group, teamId } = Route.useLoaderData()
  const { groupId } = Route.useParams()
  const navigate = useNavigate()

  if (!teamId || !group) {
    return null
  }

  const handleSuccess = () => {
    navigate({ to: "/compete/organizer/series/$groupId", params: { groupId } })
  }

  const handleCancel = () => {
    navigate({ to: "/compete/organizer/series/$groupId", params: { groupId } })
  }

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Series Details</CardTitle>
          <CardDescription>
            Update the information for this competition series
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizerSeriesForm
            organizingTeamId={teamId}
            series={group}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </CardContent>
      </Card>
    </div>
  )
}
