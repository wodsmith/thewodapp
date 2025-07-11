import { Building2, Calendar, Users } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requireVerifiedEmail } from "@/utils/auth"
import { getUserTeams } from "@/utils/team-auth"

export const metadata: Metadata = {
	metadataBase: new URL("https://spicywod.com"),
	title: "Teams",
	description: "View and manage your teams.",
	openGraph: {
		title: "Teams",
		description: "View and manage your teams.",
		images: [
			{
				url: `/api/og?title=${encodeURIComponent("Teams")}`,
				width: 1200,
				height: 630,
				alt: "Teams",
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

	// Get user's teams
	const userTeams = await getUserTeams()

	if (process.env.LOG_LEVEL === "info") {
		console.log(
			`INFO: [TeamsPage] Page loaded successfully for user: ${session.user.id}, found ${userTeams.length} teams`,
		)
	}

	return (
		<div>
			<div className="mb-6 flex flex-col items-center justify-between sm:flex-row">
				<h1 className="mb-4">TEAMS</h1>
			</div>

			<div className="space-y-6">
				{userTeams.length === 0 ? (
					<Card>
						<CardContent className="pt-6">
							<div className="text-center text-muted-foreground">
								<Users className="mx-auto h-12 w-12 mb-4" />
								<h3 className="font-semibold text-lg mb-2">No Teams Found</h3>
								<p>You don't have access to any teams yet.</p>
							</div>
						</CardContent>
					</Card>
				) : (
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{userTeams.map((team) => (
							<Card key={team.id} className="hover:shadow-md transition-shadow">
								<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
									<CardTitle className="text-lg font-medium">
										{team.name}
									</CardTitle>
									<Building2 className="h-5 w-5 text-muted-foreground" />
								</CardHeader>
								<CardContent>
									<div className="space-y-3">
										<div className="flex items-center justify-between">
											<span className="text-sm text-muted-foreground">
												Role
											</span>
											<Badge variant="secondary">{team.role.name}</Badge>
										</div>

										<div className="flex items-center gap-2 pt-2">
											<Button asChild className="flex-1">
												<Link href={`/teams/${team.id}` as any}>
													<Calendar className="h-4 w-4 mr-2" />
													View Workouts
												</Link>
											</Button>
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
