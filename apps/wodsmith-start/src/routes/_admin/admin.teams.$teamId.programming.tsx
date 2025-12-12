import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-router"
import { eq, or } from "drizzle-orm"
import { getDb } from "~/db/index.server"
import {
	teamTable,
	scalingGroupsTable,
	TEAM_PERMISSIONS,
	type ScalingGroup,
} from "~/db/schema.server"
import { requireTeamPermission } from "~/utils/team-auth.server"
import { getTeamTracks } from "~/server/programming-tracks.server"
import { getPublicTracksWithTeamSubscriptions } from "~/server/programming-multi-team.server"
import { PageHeader } from "~/components/page-header"
import { Suspense } from "react"
import { ProgrammingTrackDashboard } from "./_components/programming-track-dashboard"
import { ProgrammingTracksClient } from "~/components/programming/programming-tracks-client"

const getProgrammingPageData = createServerFn(
	{ method: "GET" },
	async (teamId: string) => {
		const db = getDb()

		// Get team by ID
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, teamId),
		})

		if (!team) {
			throw new Error("Team not found")
		}

		// Check if user has permission to manage programming tracks
		await requireTeamPermission(
			team.id,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING
		)

		// Get team tracks
		const tracks = await getTeamTracks(team.id)

		// Get all unique scaling groups used by tracks
		const scalingGroupIds = [
			...new Set(
				tracks
					.map((t) => t.scalingGroupId)
					.filter((id): id is string => id !== null)
			),
		]
		let scalingGroupsRecord: Record<string, ScalingGroup> = {}

		if (scalingGroupIds.length > 0) {
			const scalingGroups = await db.query.scalingGroupsTable.findMany({
				where: or(...scalingGroupIds.map((id) => eq(scalingGroupsTable.id, id))),
			})
			scalingGroupsRecord = Object.fromEntries(
				scalingGroups.map((sg) => [sg.id, sg])
			)
		}

		// Get all public tracks with subscription info for the current team only
		const allTracks = await getPublicTracksWithTeamSubscriptions([team.id])

		return {
			team,
			tracks,
			scalingGroupsRecord,
			allTracks,
		}
	}
)

export const Route = createFileRoute("/_admin/admin/teams/$teamId/programming")({
	loader: async ({ params }) => {
		return getProgrammingPageData(params.teamId)
	},
	component: ProgrammingTrackPage,
})

function ProgrammingTrackPage() {
	const { team, tracks, scalingGroupsRecord, allTracks } =
		Route.useLoaderData()

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

				{/* Explore Programming Section */}
				<div className="bg-card border-4 border-primary rounded-none p-4 sm:p-6">
					<h2 className="text-2xl font-bold mb-2 font-mono tracking-tight">
						Explore Programming
					</h2>
					<p className="text-muted-foreground font-mono text-sm sm:text-base mb-6">
						Subscribe to public programming tracks created by other teams
					</p>
					<Suspense
						fallback={
							<div className="font-mono">Loading available tracks...</div>
						}
					>
						<ProgrammingTracksClient
							allTracks={allTracks}
							teamId={team.id}
							teamName={team.name}
							hasManagePermission={true}
						/>
					</Suspense>
				</div>
			</div>
		</>
	)
}
