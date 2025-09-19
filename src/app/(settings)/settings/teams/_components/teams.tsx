import Link from "next/link"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import type { Team } from "@/db/schema"
import { Button } from "@/components/ui/button"

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
										<Button
											asChild
											variant={isActive ? "default" : "outline"}
											className="flex-1"
										>
											<Link href={`/settings/teams/${team.slug}`}>
												{team.name}
											</Link>
										</Button>
										<Button asChild variant="link">
											<Link href={`/admin/teams/${team.id}`}>
												Schedule Workouts
											</Link>
										</Button>
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
