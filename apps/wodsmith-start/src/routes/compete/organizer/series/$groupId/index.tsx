import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft, Pencil, Plus } from "lucide-react"
import { OrganizerCompetitionsList } from "@/components/organizer-competitions-list"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	getCompetitionGroupByIdFn,
	getOrganizerCompetitionsFn,
} from "@/server-fns/competition-fns"

export const Route = createFileRoute("/compete/organizer/series/$groupId/")({
	component: SeriesDetailPage,
	loader: async ({ params, context }) => {
		const { groupId } = params
		const session = context.session
		const teamId = session?.teams?.[0]?.id

		if (!teamId) {
			return {
				group: null,
				seriesCompetitions: [],
				allGroups: [],
				teamId: null,
			}
		}

		// Fetch group details
		const groupResult = await getCompetitionGroupByIdFn({ data: { groupId } })

		if (!groupResult.group) {
			return {
				group: null,
				seriesCompetitions: [],
				allGroups: [],
				teamId,
			}
		}

		// Fetch all competitions for this team
		const competitionsResult = await getOrganizerCompetitionsFn({
			data: { teamId },
		})

		// Filter competitions that belong to this series
		const seriesCompetitions = competitionsResult.competitions.filter(
			(c) => c.groupId === groupId,
		)

		return {
			group: groupResult.group,
			seriesCompetitions,
			allGroups: [
				{ ...groupResult.group, competitionCount: seriesCompetitions.length },
			],
			teamId,
		}
	},
})

function SeriesDetailPage() {
	const { group, seriesCompetitions, allGroups, teamId } = Route.useLoaderData()

	if (!teamId) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="text-center py-12">
					<h1 className="text-2xl font-bold mb-4">No Team Found</h1>
					<p className="text-muted-foreground mb-6">
						You need to be part of a team to view series details.
					</p>
				</div>
			</div>
		)
	}

	if (!group) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="text-center py-12">
					<h1 className="text-2xl font-bold mb-4">Series Not Found</h1>
					<p className="text-muted-foreground mb-6">
						The series you're looking for doesn't exist or you don't have
						permission to view it.
					</p>
					<Button variant="outline" asChild>
						<a href="/compete/organizer/series">
							<ArrowLeft className="h-4 w-4 mr-2" />
							Back to Series
						</a>
					</Button>
				</div>
			</div>
		)
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				{/* Header */}
				<div>
					<div className="mb-4">
						<Button variant="ghost" size="sm" asChild>
							<a href="/compete/organizer/series">
								<ArrowLeft className="h-4 w-4 mr-2" />
								Back to Series
							</a>
						</Button>
					</div>

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
							<Button variant="outline" asChild>
								<Link
									to="/compete/organizer/series/$groupId/edit"
									params={{ groupId: group.id }}
								>
									<Pencil className="h-4 w-4 mr-2" />
									Edit Series
								</Link>
							</Button>
							<Button asChild>
								<Link
									to="/compete/organizer/new"
									search={{ groupId: group.id }}
								>
									<Plus className="h-4 w-4 mr-2" />
									Add Competition
								</Link>
							</Button>
						</div>
					</div>
				</div>

				{/* Series Info Card */}
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

				{/* Competitions in Series */}
				<div>
					<h2 className="text-xl font-bold mb-4">Competitions in Series</h2>
					<OrganizerCompetitionsList
						competitions={seriesCompetitions}
						groups={allGroups}
						teamId={teamId}
						currentGroupId={group.id}
					/>
				</div>
			</div>
		</div>
	)
}
