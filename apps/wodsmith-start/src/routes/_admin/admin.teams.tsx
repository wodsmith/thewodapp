import { createFileRoute } from "@tanstack/react-router"
import { eq } from "drizzle-orm"
import { getDb } from "~/db/index.server"
import { teamTable } from "~/db/schema.server"
import Link from "~/components/link"
import { Button } from "~/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card"

export const Route = createFileRoute("/_admin/admin/teams")({
	component: AdminTeamsPage,
	loader: async () => {
		const db = getDb()
		const teams = await db.query.teamTable.findMany({
			orderBy: [{ createdAt: "desc" }],
		})
		return { teams }
	},
})

interface AdminTeamsPageProps {
	loaderData: Awaited<ReturnType<typeof Route.options.loader>>
}

function AdminTeamsPage() {
	const { teams } = Route.useLoaderData()

	return (
		<div className="max-w-4xl">
			<div className="mb-8">
				<h1 className="text-3xl font-bold tracking-tight">Teams Management</h1>
				<p className="text-muted-foreground mt-2">
					View and manage all teams in the system
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
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<CardTitle>{team.name}</CardTitle>
										<CardDescription>{team.slug}</CardDescription>
									</div>
									<Button asChild size="sm">
										<Link
											to="/admin/teams/$teamId"
											params={{ teamId: team.id }}
										>
											View Details
										</Link>
									</Button>
								</div>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-2 gap-4 text-sm">
									<div>
										<span className="text-muted-foreground">Type:</span>
										<p className="font-medium">{team.type}</p>
									</div>
									<div>
										<span className="text-muted-foreground">Created:</span>
										<p className="font-medium">
											{new Date(team.createdAt).toLocaleDateString()}
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	)
}
