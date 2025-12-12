import { createFileRoute, notFound } from "@tanstack/react-router"
import { OrganizerCompetitionEditForm } from "~/components/compete/organizer/organizer-competition-edit-form"
import { getCompetitionFn, getCompetitionGroupsFn } from "~/server-functions/competitions"
import { getScalingGroupsFn } from "~/server-functions/scaling"
import { getSessionFromCookie } from "~/utils/auth.server"

export const Route = createFileRoute(
	"/_compete/compete/organizer/$competitionId/edit",
)({
	beforeLoad: async () => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("Unauthorized")
		}
	},
	loader: async ({ params }) => {
		const competitionResult = await getCompetitionFn({
			data: { idOrSlug: params.competitionId },
		})

		if (!competitionResult.success || !competitionResult.data) {
			throw notFound()
		}

		const competition = competitionResult.data

		// Fetch groups and scaling groups for the organizing team
		const groupsResult = await getCompetitionGroupsFn({
			data: { organizingTeamId: competition.organizingTeamId },
		})

		const scalingGroupsResult = await getScalingGroupsFn({
			data: { teamId: competition.organizingTeamId },
		})

		return {
			competition,
			groups: groupsResult.data ?? [],
			scalingGroups: scalingGroupsResult.data ?? [],
		}
	},
	component: EditCompetitionComponent,
})

function EditCompetitionComponent() {
	const { competition, groups, scalingGroups } = Route.useLoaderData()

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-2xl mx-auto">
				<h1 className="text-3xl font-bold">Edit Competition</h1>
				<p className="text-muted-foreground mt-1">
					Update competition details for {competition.name}
				</p>

				<div className="mt-8">
					<OrganizerCompetitionEditForm
						competition={competition}
						groups={groups}
						scalingGroups={scalingGroups}
					/>
				</div>
			</div>
		</div>
	)
}
