import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "~/db/index.server"
import { teamTable } from "~/db/schema.server"
import { PageHeader } from "~/components/page-header"
import { Suspense } from "react"
import { ProgrammingTrackDashboard } from "./-components/programming-track-dashboard"

// TODO: Implement full data fetching with permissions and track subscriptions
// Need to create: programming-tracks.server, programming-multi-team.server

const getProgrammingPageData = createServerFn({ method: "GET" }).handler(
	async ({ data: teamId }: { data: string }) => {
		const db = getDb()

		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, teamId),
		})

		if (!team) {
			throw new Error("Team not found")
		}

		// Placeholder data
		return {
			team,
			tracks: [],
			scalingGroupsRecord: {},
			allTracks: [],
		}
	}
)

export const Route = createFileRoute("/_admin/admin/teams/$teamId/programming")(
	{
		loader: async ({ params }) => {
			return getProgrammingPageData({ data: params.teamId })
		},
		component: ProgrammingTrackPage,
	}
)

function ProgrammingTrackPage() {
	const { team, tracks, scalingGroupsRecord } = Route.useLoaderData()

	return (
		<>
			<PageHeader
				items={[
					{ href: "/admin", label: "Admin" },
					{ href: "/admin/teams", label: "Teams" },
					{ href: `/admin/teams/${team.id}`, label: team.name },
					{
						href: `/admin/teams/${team.id}/programming`,
						label: "Programming",
					},
				]}
			/>
			<div className="px-4 sm:px-5 pb-12">
				<div className="flex justify-between items-start mb-8">
					<div className="min-w-0 flex-1">
						<h1 className="text-2xl sm:text-3xl font-bold mb-2 font-mono tracking-tight">
							Programming Track Management
						</h1>
						<p className="text-muted-foreground font-mono text-sm sm:text-base">
							Manage programming tracks for {team.name}
						</p>
					</div>
				</div>

				<div className="bg-card border-4 border-primary rounded-none p-4 sm:p-6 mb-12">
					<Suspense
						fallback={
							<div className="font-mono">Loading programming tracks...</div>
						}
					>
						<ProgrammingTrackDashboard
							teamId={team.id}
							initialTracks={tracks}
							scalingGroups={scalingGroupsRecord}
						/>
					</Suspense>
				</div>

				{/* Explore Programming Section - simplified for now */}
				<div className="bg-card border-4 border-primary rounded-none p-4 sm:p-6">
					<h2 className="text-2xl font-bold mb-2 font-mono tracking-tight">
						Explore Programming
					</h2>
					<p className="text-muted-foreground font-mono text-sm sm:text-base mb-6">
						Subscribe to public programming tracks created by other teams
					</p>
					<p className="text-muted-foreground font-mono text-sm">
						TODO: Implement ProgrammingTracksClient component
					</p>
				</div>
			</div>
		</>
	)
}
