import { createFileRoute, Link } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { OrganizerSeriesList } from "~/components/compete/organizer/organizer-series-list"
import { Button } from "~/components/ui/button"
import {
	getCompetitionGroupsFn,
	getUserOrganizingTeamsFn,
} from "~/server-functions/competitions"
import { getSessionFromCookie } from "~/utils/auth.server"

export const Route = createFileRoute("/_compete/compete/organizer/series")({
	beforeLoad: async () => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("Unauthorized")
		}
	},
	loader: async () => {
		const teams = await getUserOrganizingTeamsFn()
		if (!teams.data || teams.data.length === 0) {
			return {
				organizingTeams: [],
				activeTeamId: null,
				groups: [],
			}
		}

		const activeTeamId = teams.data[0].id
		const groupsResult = await getCompetitionGroupsFn({
			organizingTeamId: activeTeamId,
		})

		return {
			organizingTeams: teams.data,
			activeTeamId,
			groups: groupsResult.data || [],
		}
	},
	component: SeriesComponent,
})

function SeriesComponent() {
	const { organizingTeams, activeTeamId, groups } = Route.useLoaderData()

	const handleRefresh = async () => {
		await Route.instance.invalidate()
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				<div>
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
						<div>
							<h1 className="text-3xl font-bold">Competition Series</h1>
							<p className="text-muted-foreground mt-1">
								Organize competitions into series for recurring events
							</p>
						</div>
						<Link to="/compete/organizer/series/new">
							<Button className="w-full sm:w-auto">
								<Plus className="h-4 w-4 mr-2" />
								Create Series
							</Button>
						</Link>
					</div>
				</div>

				{activeTeamId && (
					<OrganizerSeriesList
						groups={groups}
						teamId={activeTeamId}
						onDelete={handleRefresh}
					/>
				)}
			</div>
		</div>
	)
}
