import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireVerifiedEmail } from "@/utils/auth"

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

	if (process.env.LOG_LEVEL === "info") {
		console.log(
			`INFO: [TeamsPage] Page loaded successfully for user: ${session.user.id}`,
		)
	}

	return (
		<div>
			<div className="mb-6 flex flex-col items-center justify-between sm:flex-row">
				<h1 className="mb-4">TEAMS</h1>
			</div>

			<div className="space-y-6">
				<div className="card p-6">
					<h2 className="mb-4 font-semibold text-xl">Scheduled Workouts</h2>
					<p className="text-muted-foreground">
						View scheduled workouts for teams you have access to.
					</p>
				</div>
			</div>
		</div>
	)
}
