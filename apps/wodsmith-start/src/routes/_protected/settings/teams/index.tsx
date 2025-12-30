import { createFileRoute, Link } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import type { Team } from "@/db/schema"
import { getUserTeamsFn } from "@/server-fns/team-settings-fns"
import { cn } from "@/utils/cn"

export const Route = createFileRoute("/_protected/settings/teams/")({
	component: TeamsPage,
	loader: async () => {
		const result = await getUserTeamsFn()

		if (!result.success) {
			return { teams: [] as Team[] }
		}

		return { teams: result.data }
	},
})

function TeamsPage() {
	const { teams } = Route.useLoaderData()

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0">
					<div>
						<CardTitle>Your Teams</CardTitle>
						<CardDescription>
							You are a member of the following teams.
						</CardDescription>
					</div>
					<Link
						to="/settings/teams/create"
						className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
					>
						<Plus className="h-4 w-4 mr-2" />
						Create New Team
					</Link>
				</CardHeader>
				<CardContent>
					<div className="space-y-1">
						{teams.length > 0 ? (
							teams.map((team) => (
								<div
									key={team.id}
									className={cn(
										"flex items-center justify-between gap-4 px-3 py-2 rounded-md border transition-colors",
										"bg-background hover:bg-accent border-border",
									)}
								>
									<Link
										to="/settings/teams/$teamSlug"
										params={{ teamSlug: team.slug }}
										className="flex-1 font-medium"
									>
										{team.name}
									</Link>
								</div>
							))
						) : (
							<div className="text-center py-8">
								<p className="text-muted-foreground mb-4">
									You are not a member of any teams.
								</p>
								<Link
									to="/settings/teams/create"
									className={cn(buttonVariants({ variant: "default" }))}
								>
									<Plus className="h-4 w-4 mr-2" />
									Create your first team
								</Link>
							</div>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
