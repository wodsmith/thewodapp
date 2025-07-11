import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { requireVerifiedEmail } from "@/utils/auth"
import { hasTeamMembership } from "@/utils/team-auth"
import { getTeamScheduledWorkoutsAction } from "../_actions/team-scheduled-workouts.action"
import { TeamPageClient } from "./_components/team-page-client"

export const metadata: Metadata = {
	metadataBase: new URL("https://spicywod.com"),
	title: "Team Scheduled Workouts",
	description: "View scheduled workouts for this team.",
	openGraph: {
		title: "Team Scheduled Workouts",
		description: "View scheduled workouts for this team.",
		images: [
			{
				url: `/api/og?title=${encodeURIComponent("Team Scheduled Workouts")}`,
				width: 1200,
				height: 630,
				alt: "Team Scheduled Workouts",
			},
		],
	},
}

interface TeamPageProps {
	params: Promise<{ id: string }>
}

export default async function TeamPage({ params }: TeamPageProps) {
	const { id: teamId } = await params
	const session = await requireVerifiedEmail()

	if (!session || !session?.user?.id) {
		if (process.env.LOG_LEVEL === "info") {
			console.log("INFO: [TeamPage] No user found, redirecting to sign-in")
		}
		redirect("/sign-in")
	}

	// Check if user has access to this team
	const { hasAccess } = await hasTeamMembership(teamId)

	if (!hasAccess) {
		if (process.env.LOG_LEVEL === "info") {
			console.log(
				`INFO: [TeamPage] User ${session.user.id} does not have access to team ${teamId}`,
			)
		}
		notFound()
	}

	// Get team name from session
	const team = session.teams?.find((t) => t.id === teamId)
	const teamName = team?.name || "Team"

	// Fetch scheduled workouts for this specific team
	const [result, error] = await getTeamScheduledWorkoutsAction({ teamId })

	if (error) {
		if (process.env.LOG_LEVEL === "info") {
			console.log(
				`INFO: [TeamPage] Error fetching scheduled workouts for team ${teamId}:`,
				error,
			)
		}
		// Handle error gracefully - still use client component for consistency
		return <TeamPageClient scheduledWorkouts={[]} teamName={teamName} />
	}

	if (process.env.LOG_LEVEL === "info") {
		console.log(
			`INFO: [TeamPage] Navigation successful, displaying scheduled workouts for team: ${teamId}`,
		)
	}

	return (
		<TeamPageClient
			scheduledWorkouts={result?.scheduledWorkouts || []}
			teamName={teamName}
		/>
	)
}
