import Link from "next/link"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import type { Team } from "@/db/schema"

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
											className={`flex-1 border-2 border-primary px-4 py-2 font-mono font-semibold transition-colors ${
												isActive
													? "bg-primary text-primary-foreground shadow-[4px_4px_0px_0px] shadow-primary"
													: "bg-background hover:bg-orange hover:text-white shadow-[2px_2px_0px_0px] shadow-primary"
											}`}
										>
											{team.name}
										</Link>
										<Link
											href={`/admin/teams/${team.id}`}
											className="inline-flex items-center justify-center font-mono border-2 border-primary bg-orange px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 shadow-[4px_4px_0px_0px] shadow-primary"
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
