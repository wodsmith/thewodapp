import { ChevronLeft } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { requireVerifiedEmail } from "@/utils/auth"
import { hasTeamMembership } from "@/utils/team-auth"
import { getTeamScheduledWorkoutsAction } from "../_actions/team-scheduled-workouts.action"
import { SingleTeamScheduledWorkouts } from "../_components/single-team-scheduled-workouts"

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
		// Handle error gracefully
		return (
			<div>
				<div className="mb-6 flex items-center gap-4">
					<Button variant="ghost" size="sm" asChild>
						<Link href="/teams">
							<ChevronLeft className="h-4 w-4 mr-2" />
							Back to Teams
						</Link>
					</Button>
					<h1 className="mb-4">{teamName.toUpperCase()}</h1>
				</div>
				<div className="space-y-6">
					<div className="card p-6">
						<h2 className="mb-4 font-semibold text-xl">
							Error Loading Workouts
						</h2>
						<p className="text-muted-foreground">
							There was an error loading scheduled workouts for this team.
							Please try again later.
						</p>
					</div>
				</div>
			</div>
		)
	}

	if (process.env.LOG_LEVEL === "info") {
		console.log(
			`INFO: [TeamPage] Navigation successful, displaying scheduled workouts for team: ${teamId}`,
		)
	}

	return (
		<div>
			<div className="mb-6 flex items-center gap-4">
				<Button variant="ghost" size="sm" asChild>
					<Link href="/teams">
						<ChevronLeft className="h-4 w-4 mr-2" />
						Back to Teams
					</Link>
				</Button>
				<h1 className="mb-4">{teamName.toUpperCase()}</h1>
			</div>

			<div className="space-y-6">
				<SingleTeamScheduledWorkouts
					scheduledWorkouts={result?.scheduledWorkouts || []}
					teamName={teamName}
				/>
			</div>
		</div>
	)
}
