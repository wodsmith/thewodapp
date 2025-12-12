import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "~/db/index.server"
import { teamTable, TEAM_PERMISSIONS } from "~/db/schema.server"
import { requireTeamPermission } from "~/utils/team-auth.server"
import { PageHeader } from "~/components/page-header"
import { Button } from "~/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card"
import Link from "~/components/link"

const getTeamDashboard = createServerFn({ method: "GET" }, async (teamId: string) => {
	const db = getDb()

	// Get team by ID
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
	})

	if (!team) {
		throw new Error("Team not found")
	}

	// Check if user has permission to access team dashboard
	await requireTeamPermission(team.id, TEAM_PERMISSIONS.ACCESS_DASHBOARD)

	return { team }
})

export const Route = createFileRoute("/_admin/admin/teams/$teamId")({
	loader: async ({ params }) => {
		return getTeamDashboard(params.teamId)
	},
	component: TeamDashboardPage,
})

function TeamDashboardPage() {
	const { team } = Route.useLoaderData()

	return (
		<>
			<PageHeader
				items={[
					{ href: "/admin", label: "Admin" },
					{ href: "/admin/teams", label: "Teams" },
					{ label: team.name },
				]}
			/>
			<div className="container mx-auto px-5 pb-12">
				<div className="flex justify-between items-start mb-8">
					<div>
						<h1 className="text-3xl font-bold mb-2">{team.name}</h1>
						<p className="text-muted-foreground">
							Manage settings and features for {team.name}
						</p>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<Card>
						<CardHeader>
							<CardTitle>Programming</CardTitle>
							<CardDescription>Manage programming tracks and workouts</CardDescription>
						</CardHeader>
						<CardContent>
							<Button asChild className="w-full">
								<Link
									to="/admin/teams/$teamId/programming"
									params={{ teamId: team.id }}
								>
									Manage Programming
								</Link>
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Scaling Groups</CardTitle>
							<CardDescription>Configure scaling options</CardDescription>
						</CardHeader>
						<CardContent>
							<Button asChild className="w-full">
								<Link
									to="/admin/teams/$teamId/scaling"
									params={{ teamId: team.id }}
								>
									Manage Scaling
								</Link>
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Schedule Templates</CardTitle>
							<CardDescription>Manage class schedules</CardDescription>
						</CardHeader>
						<CardContent>
							<Button asChild className="w-full">
								<Link
									to="/admin/teams/$teamId/schedule-templates"
									params={{ teamId: team.id }}
								>
									Manage Schedules
								</Link>
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Gym Setup</CardTitle>
							<CardDescription>Configure locations and skills</CardDescription>
						</CardHeader>
						<CardContent>
							<Button asChild className="w-full">
								<Link
									to="/admin/teams/$teamId/gym-setup"
									params={{ teamId: team.id }}
								>
									Gym Setup
								</Link>
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Coaches</CardTitle>
							<CardDescription>Manage team coaches</CardDescription>
						</CardHeader>
						<CardContent>
							<Button asChild className="w-full">
								<Link
									to="/admin/teams/$teamId/coaches"
									params={{ teamId: team.id }}
								>
									Manage Coaches
								</Link>
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Classes</CardTitle>
							<CardDescription>Manage class catalog</CardDescription>
						</CardHeader>
						<CardContent>
							<Button asChild className="w-full">
								<Link
									to="/admin/teams/$teamId/classes"
									params={{ teamId: team.id }}
								>
									Manage Classes
								</Link>
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		</>
	)
}
