import { createFileRoute } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "~/db/index.server"
import { teamTable } from "~/db/schema.server"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card"

export const Route = createFileRoute("/_admin/admin/teams/programming")({
	component: AdminTeamsProgrammingPage,
	loader: async () => {
		const db = getDb()
		// Get all teams with programming tracks info
		const teams = await db.query.teamTable.findMany({
			orderBy: [{ createdAt: "desc" }],
		})
		return { teams }
	},
})

function AdminTeamsProgrammingPage() {
	const { teams } = Route.useLoaderData()

	return (
		<div className="max-w-4xl">
			<div className="mb-8">
				<h1 className="text-3xl font-bold tracking-tight">
					Programming Management
				</h1>
				<p className="text-muted-foreground mt-2">
					Manage programming tracks across all teams
				</p>
			</div>

			{teams.length === 0 ? (
				<Card>
					<CardContent className="pt-6">
						<p className="text-muted-foreground text-center">No teams found</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{teams.map((team) => (
						<Card key={team.id}>
							<CardHeader>
								<CardTitle>{team.name}</CardTitle>
								<CardDescription>{team.slug}</CardDescription>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground">
									Programming tracks management for this team
								</p>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	)
}
