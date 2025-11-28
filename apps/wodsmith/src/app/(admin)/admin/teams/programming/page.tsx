import "server-only"
import { eq, or } from "drizzle-orm"
import type { Metadata } from "next"
import { Suspense } from "react"
import { PageHeader } from "@/components/page-header"
import { ProgrammingTracksClient } from "@/components/programming/programming-tracks-client"
import { getDb } from "@/db"
import {
	type ScalingGroup,
	scalingGroupsTable,
	TEAM_PERMISSIONS,
} from "@/db/schema"
import { getPublicTracksWithTeamSubscriptions } from "@/server/programming-multi-team"
import { getTeamTracks } from "@/server/programming-tracks"
import { requireTeamPermission } from "@/utils/team-auth"
import { getAdminTeamContext } from "../_utils/get-team-context"
import { ProgrammingTrackDashboard } from "../[teamId]/programming/_components/programming-track-dashboard"

export async function generateMetadata(): Promise<Metadata> {
	const { team } = await getAdminTeamContext()

	return {
		title: `${team.name} - Programming Tracks`,
		description: `Manage programming tracks for ${team.name}`,
	}
}

export default async function ProgrammingTrackPage() {
	const { teamId: _teamId, team } = await getAdminTeamContext()
	const db = getDb()

	// Check if user has permission to manage programming tracks
	await requireTeamPermission(team.id, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

	// Get team tracks
	const tracks = await getTeamTracks(team.id)

	// Get all unique scaling groups used by tracks
	const scalingGroupIds = [
		...new Set(
			tracks
				.map((t) => t.scalingGroupId)
				.filter((id): id is string => id !== null),
		),
	]
	let scalingGroupsRecord: Record<string, ScalingGroup> = {}

	if (scalingGroupIds.length > 0) {
		const scalingGroups = await db.query.scalingGroupsTable.findMany({
			where: or(...scalingGroupIds.map((id) => eq(scalingGroupsTable.id, id))),
		})
		scalingGroupsRecord = Object.fromEntries(
			scalingGroups.map((sg) => [sg.id, sg]),
		)
	}

	// Get all public tracks with subscription info for the current team only
	const allTracks = await getPublicTracksWithTeamSubscriptions([team.id])

	return (
		<>
			<PageHeader
				items={[
					{ href: "/admin", label: "Admin" },
					{ href: "/admin/teams", label: team.name },
					{
						href: "/admin/teams/programming",
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
