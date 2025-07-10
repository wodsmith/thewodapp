import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getTeamsWithScheduledWorkoutsAction } from "@/actions/team-scheduled-workouts.action"
import { requireVerifiedEmail } from "@/utils/auth"
import { TeamScheduledWorkouts } from "./_components/team-scheduled-workouts"

export const metadata: Metadata = {
	metadataBase: new URL("https://spicywod.com"),
	title: "Teams | Scheduled Workouts",
	description: "View scheduled workouts for your teams.",
	openGraph: {
		title: "Teams | Scheduled Workouts",
		description: "View scheduled workouts for your teams.",
		images: [
			{
				url: `/api/og?title=${encodeURIComponent(
					"Teams | Scheduled Workouts",
				)}`,
				width: 1200,
				height: 630,
				alt: "Teams | Scheduled Workouts",
			},
		],
	},
}

export default async function TeamsPage() {
	const session = await requireVerifiedEmail()

	if (!session || !session?.user?.id) {
		if (process.env.LOG_LEVEL === "info") {
			console.log("INFO: [TeamsPage] No user found, redirecting to sign-in")
		}
		redirect("/sign-in")
	}

	// Fetch teams with scheduled workouts
	const [result, error] = await getTeamsWithScheduledWorkoutsAction({})

	if (error) {
		if (process.env.LOG_LEVEL === "info") {
			console.log(
				`INFO: [TeamsPage] Error fetching teams for user: ${session.user.id}`,
				error,
			)
		}
		// Handle error gracefully
		return (
			<div>
				<div className="mb-6 flex flex-col items-center justify-between sm:flex-row">
					<h1 className="mb-4">TEAMS</h1>
				</div>
				<div className="space-y-6">
					<div className="card p-6">
						<h2 className="mb-4 font-semibold text-xl">Error Loading Teams</h2>
						<p className="text-muted-foreground">
							There was an error loading your teams. Please try again later.
						</p>
					</div>
				</div>
			</div>
		)
	}

	if (process.env.LOG_LEVEL === "info") {
		console.log(
			`INFO: [TeamsPage] Navigation successful, displaying teams interface for user: ${session.user.id}`,
		)
	}

	return (
		<div>
			<div className="mb-6 flex flex-col items-center justify-between sm:flex-row">
				<h1 className="mb-4">TEAMS</h1>
			</div>

			<div className="space-y-6">
				<TeamScheduledWorkouts teams={result?.teams || []} />
			</div>
		</div>
	)
}
