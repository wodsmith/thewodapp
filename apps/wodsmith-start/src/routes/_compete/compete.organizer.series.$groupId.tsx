import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { OrganizerSeriesActions } from "~/components/compete/organizer/organizer-series-actions"
import { Button } from "~/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card"
import { getCompetitionGroupFn } from "~/server-functions/competitions"
import { getSessionFromCookie } from "~/utils/auth.server"

export const Route = createFileRoute("/_compete/compete/organizer/series/$groupId")({
	beforeLoad: async () => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("Unauthorized")
		}
	},
	loader: async ({ params }) => {
		if (!params.groupId) {
			throw notFound()
		}

		const groupResult = await getCompetitionGroupFn({ groupId: params.groupId })

		if (!groupResult.data) {
			throw notFound()
		}

		return {
			group: groupResult.data,
			seriesCompetitions: [], // TODO: Implement getCompetitionsForOrganizerFn to filter by series
		}
	},
	component: SeriesDetailComponent,
})

function SeriesDetailComponent() {
	const { group, seriesCompetitions } = Route.useLoaderData()

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				<div>
					<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
						<div>
							<h1 className="text-3xl font-bold">{group.name}</h1>
							{group.description && (
								<p className="text-muted-foreground mt-1">
									{group.description}
								</p>
							)}
						</div>
						<div className="flex items-center gap-2">
							<Link
								to="/compete/organizer/new"
								search={{ groupId: group.id }}
							>
								<Button>
									<Plus className="h-4 w-4 mr-2" />
									Add Competition
								</Button>
							</Link>
							<OrganizerSeriesActions
								groupId={group.id}
								organizingTeamId={group.organizingTeamId}
								competitionCount={seriesCompetitions.length}
							/>
						</div>
					</div>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Series Details</CardTitle>
						<CardDescription>Information about this series</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-4 md:grid-cols-2">
							<div>
								<div className="text-sm font-medium text-muted-foreground">
									Slug
								</div>
								<div className="text-sm font-mono mt-1">{group.slug}</div>
							</div>
							<div>
								<div className="text-sm font-medium text-muted-foreground">
									Competitions
								</div>
								<div className="text-sm mt-1">
									{seriesCompetitions.length} competition
									{seriesCompetitions.length !== 1 ? "s" : ""}
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* TODO: Render OrganizerCompetitionsList with series competitions */}
			</div>
		</div>
	)
}
