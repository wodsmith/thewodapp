import { DebugSessionInfo } from "@/components/debug-session-info"
import { PageHeader } from "@/components/page-header"
import { getDB } from "@/db"
import { TEAM_PERMISSIONS, teamTable } from "@/db/schema"
import { getTeamTracks } from "@/server/programming-tracks"
import { requireTeamPermission } from "@/utils/team-auth"
import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { ProgrammingTrackDashboard } from "./_components/programming-track-dashboard"

interface ProgrammingTrackPageProps {
	params: Promise<{
		teamSlug: string
	}>
}

export async function generateMetadata({
	params,
}: ProgrammingTrackPageProps): Promise<Metadata> {
	const { teamSlug } = await params
	const db = getDB()

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.slug, teamSlug),
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
	const { teamSlug } = await params
	const db = getDB()

	console.log(
		`DEBUG: [Programming] Loading programming tracks for team: ${teamSlug}`,
	)

	// Get team by slug
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.slug, teamSlug),
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
		})),
	)

	return (
		<>
			<PageHeader
				items={[
					{ href: "/admin", label: "Admin" },
					{ href: "/admin/teams", label: "Teams" },
					{ href: `/admin/teams/${teamSlug}`, label: team.name },
					{
						href: `/admin/teams/${teamSlug}/programming`,
						label: "Programming",
					},
				]}
			/>
			<div className="container mx-auto px-5 pb-12">
				<div className="flex justify-between items-start mb-8">
					<div>
						<h1 className="text-3xl font-bold mb-2 font-mono tracking-tight">
							Programming Track Management
						</h1>
						<p className="text-muted-foreground font-mono">
							Manage programming tracks for {team.name}
						</p>
					</div>
				</div>

				<div className="bg-card border-4 border-primary shadow-[8px_8px_0px_0px] shadow-primary rounded-none p-6">
					<Suspense
						fallback={
							<div className="font-mono">Loading programming tracks...</div>
						}
					>
						<ProgrammingTrackDashboard
							teamId={team.id}
							initialTracks={tracks}
						/>
					</Suspense>
				</div>
			</div>
		</>
	)
}
