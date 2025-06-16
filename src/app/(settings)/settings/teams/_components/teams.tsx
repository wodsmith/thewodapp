import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import type { Team } from "@/db/schema"
import Link from "next/link"

interface TeamsClientProps {
	teams: Team[]
	selectedTeamSlug: string
}

export function TeamsClient({ teams, selectedTeamSlug }: TeamsClientProps) {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Your Teams</CardTitle>
					<CardDescription>
						You are a member of the following teams.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						{teams.length > 0 ? (
							teams.map((team) => {
								const isActive = team.slug === selectedTeamSlug
								return (
									<div key={team.id} className="flex items-center gap-2">
										<Link
											href={`/settings/teams/${team.slug}`}
											className={`flex-1 rounded-lg border px-4 py-2 font-semibold transition-colors ${
												isActive
													? "bg-primary text-primary-foreground border-primary shadow"
													: "hover:bg-muted hover:border-muted-foreground"
											}`}
										>
											{team.name}
										</Link>
										<Link
											href={`/admin/teams/${team.slug}`}
											className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 hover:border-blue-300"
										>
											Schedule Workouts
										</Link>
									</div>
								)
							})
						) : (
							<p>You are not a member of any teams.</p>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
