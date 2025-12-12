import { createFileRoute, notFound } from "@tanstack/react-router"
import { getCompetitionFn } from "~/server-functions/competitions"
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

		// TODO: Fetch groups and scaling groups for the organizing team
		const groupsResult = { success: true, data: [] }
		const scalingGroupsResult = { success: true, data: [] }

		return {
			competition,
			groups: groupsResult.success ? groupsResult.data : [],
			scalingGroups: scalingGroupsResult.success ? scalingGroupsResult.data : [],
		}
	},
	component: EditCompetitionComponent,
})

function EditCompetitionComponent() {
	const { competition } = Route.useLoaderData()

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-2xl mx-auto">
				<h1 className="text-3xl font-bold">Edit Competition</h1>
				<p className="text-muted-foreground mt-1">
					Update competition details for {competition.name}
				</p>

				{/* TODO: Render OrganizerCompetitionEditForm component */}
			</div>
		</div>
	)
}
