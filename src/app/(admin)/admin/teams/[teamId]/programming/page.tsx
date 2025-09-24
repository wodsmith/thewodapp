import { eq, or } from "drizzle-orm"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { PageHeader } from "@/components/page-header"
import { getDd } from "@/db"
import {
	TEAM_PERMISSIONS,
	teamTable,
	scalingGroupsTable,
	type ScalingGroup,
} from "@/db/schema"
import { getTeamTracks } from "@/server/programming-tracks"
import { requireTeamPermission } from "@/utils/team-auth"
import { ProgrammingTrackDashboard } from "./_components/programming-track-dashboard"

interface ProgrammingTrackPageProps {
	params: Promise<{
		teamId: string
	}>
}

export async function generateMetadata({
	params,
}: ProgrammingTrackPageProps): Promise<Metadata> {
	const { teamId } = await params
	const db = getDd()

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
	})

	if (!team) {
		return {
			title: "Team Not Found",
		}
	}

	return {
		title: `${team.name} - Programming Tracks`,
		description: `Manage programming tracks for ${team.name}`,
	}
}

export default async function ProgrammingTrackPage({
	params,
}: ProgrammingTrackPageProps) {
	const { teamId } = await params
	const db = getDd()

	console.log(
		`DEBUG: [Programming] Loading programming tracks for team: ${teamId}`,
	)

	// Get team by ID
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
	})

	console.log(`DEBUG: [Programming] Team found: ${team ? team : "not found"}`)

	if (!team) {
		notFound()
	}

	// Check if user has permission to manage programming tracks
	try {
		console.log(
			`DEBUG: [Programming] About to check permission '${TEAM_PERMISSIONS.MANAGE_PROGRAMMING}' for teamId '${team.id}'`,
		)
		await requireTeamPermission(team.id, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)
		console.log(
			`INFO: [TeamAuth] User authorized for programming track management on teamId '${team.id}'`,
		)
	} catch (error) {
		console.error(
			`ERROR: [TeamAuth] Unauthorized access attempt for programming track management on teamId '${team.id}'`,
			error,
		)
		notFound()
	}

	// Get team tracks
	const tracks = await getTeamTracks(team.id)

	console.log(
		`DEBUG: [Programming] Retrieved ${tracks.length} tracks for team ${team.name} (ID: ${team.id}):`,
		tracks.map((t) => ({
			id: t.id,
			name: t.name,
			type: t.type,
			ownerTeamId: t.ownerTeamId,
			scalingGroupId: t.scalingGroupId,
		})),
	)

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

	return (
		<>
			<PageHeader
				items={[
					{ href: "/admin", label: "Admin" },
					{ href: "/admin/teams", label: "Teams" },
					{ href: `/admin/teams/${teamId}`, label: team.name },
					{
						href: `/admin/teams/${teamId}/programming`,
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

				<div className="bg-card border-4 border-primary rounded-none p-4 sm:p-6">
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
			</div>
		</>
	)
}
