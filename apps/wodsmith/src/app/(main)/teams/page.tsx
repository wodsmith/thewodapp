import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getActiveOrPersonalTeamId, getSessionFromCookie } from "@/utils/auth"
import { TeamPageClient } from "./_components/team-page-client"

export const metadata: Metadata = {
	title: "Team",
	description: "View your team's programming and schedule.",
	openGraph: {
		type: "website",
		title: "Team",
		description: "View your team's programming and schedule.",
		images: [
			{
				url: `/api/og?title=${encodeURIComponent("Team")}`,
				width: 1200,
				height: 630,
				alt: "Team",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Team",
		description: "View your team's programming and schedule.",
		images: [`/api/og?title=${encodeURIComponent("Team")}`],
	},
}

export default async function TeamsPage() {
	// Require authentication
	const session = await getSessionFromCookie()
	if (!session) {
		redirect("/sign-in")
	}

	// Get user's active team ID (or fallback to personal team)
	const activeTeamId = await getActiveOrPersonalTeamId(session.userId)

	// Get active team info from session
	const teams = session.teams || []
	const activeTeam = teams.find((team) => team.id === activeTeamId)

	if (!activeTeam) {
		return (
			<div className="container mx-auto py-8">
				<h1 className="text-3xl font-bold mb-6">Team</h1>
				<p className="text-muted-foreground">
					Active team not found. Please switch to a valid team.
				</p>
			</div>
		)
	}

	return <TeamPageClient team={activeTeam} userId={session.userId} />
}
