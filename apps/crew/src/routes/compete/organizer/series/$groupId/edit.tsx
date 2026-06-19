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
import { getOrganizerTeamsFn } from "@/server-fns/team-fns"

export const Route = createFileRoute(
  "/compete/organizer/series/$groupId/edit",
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

    // Verify user can manage this series
    const groupTeamId = groupResult.group.organizingTeamId
    if (
      !isSiteAdmin &&
      !organizingTeams.some((t) => t.id === groupTeamId)
    ) {
      return {
        group: null,
        teamId: null,
      }
    }

    const teamId = groupTeamId

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
