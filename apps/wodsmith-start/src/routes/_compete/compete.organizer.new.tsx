import { createFileRoute } from "@tanstack/react-router"
import { OrganizerCompetitionForm } from "~/components/compete/organizer/organizer-competition-form"
import { getSessionFromCookie } from "~/utils/auth.server"
import { getUserOrganizingTeamsFn } from "~/server-functions/competitions"
import { getCompetitionGroupsFn } from "~/server-functions/competitions"
import { getScalingGroupsFn } from "~/server-functions/scaling"

export const Route = createFileRoute("/_compete/compete/organizer/new")({
	beforeLoad: async () => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("Unauthorized")
		}
	},
	loader: async () => {
		try {
			// Get organizing teams for current user
			const teamsResult = await getUserOrganizingTeamsFn()
			const teams = teamsResult.data ?? []

			// Select the first team as default
			const activeTeamId = teams.length > 0 ? teams[0]?.id : null

			// Fetch groups and scaling groups for the selected team
			let groups = []
			let scalingGroups = []

			if (activeTeamId) {
				const groupsResult = await getCompetitionGroupsFn({
					data: { organizingTeamId: activeTeamId },
				})
				groups = groupsResult.data ?? []

				const scalingGroupsResult = await getScalingGroupsFn({
					data: { teamId: activeTeamId },
				})
				scalingGroups = scalingGroupsResult.data ?? []
			}

			return {
				organizingTeams: teams,
				groups,
				scalingGroups,
				activeTeamId,
			}
		} catch (error) {
			console.error("Failed to load competition creation data:", error)
			return {
				organizingTeams: [],
				groups: [],
				scalingGroups: [],
				activeTeamId: null,
			}
		}
	},
	component: NewCompetitionComponent,
})

function NewCompetitionComponent() {
	const { organizingTeams, groups, scalingGroups, activeTeamId } =
		Route.useLoaderData()

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-2xl mx-auto">
				<h1 className="text-3xl font-bold">Create Competition</h1>
				<p className="text-muted-foreground mt-1">
					Set up a new competition for your athletes
				</p>

				<div className="mt-8">
					<OrganizerCompetitionForm
						teams={organizingTeams}
						selectedTeamId={activeTeamId ?? ""}
						groups={groups}
						scalingGroups={scalingGroups}
					/>
				</div>
			</div>
		</div>
	)
}
