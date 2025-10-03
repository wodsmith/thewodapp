import Link from "next/link"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import type { Team } from "@/db/schema"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface TeamPermission {
	teamId: string
	canManageProgramming: boolean
}

interface TeamsClientProps {
	teams: Team[]
	selectedTeamSlug: string
	teamPermissions: TeamPermission[]
}

export function TeamsClient({
	teams,
	selectedTeamSlug,
	teamPermissions,
}: TeamsClientProps) {
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
					<div className="space-y-1">
						{teams.length > 0 ? (
							teams.map((team) => {
								const isActive = team.slug === selectedTeamSlug
								const permissions = teamPermissions.find(
									(p) => p.teamId === team.id,
								)
								const canManageProgramming = permissions?.canManageProgramming ?? false

								return (
									<div
										key={team.id}
										className={cn(
											"flex items-center justify-between gap-4 px-3 py-2 rounded-md border transition-colors",
											isActive
												? "bg-primary text-primary-foreground border-primary"
												: "bg-background hover:bg-accent border-border",
										)}
									>
										<Link
											href={`/settings/teams/${team.slug}`}
											className="flex-1 font-medium"
										>
											{team.name}
										</Link>
										{canManageProgramming && (
											<Link
												href={`/admin/teams/${team.id}`}
												className={cn(
													buttonVariants({ variant: "link", size: "sm" }),
													isActive
														? "text-primary-foreground hover:text-primary-foreground/80"
														: "text-primary",
													"h-auto p-0",
												)}
											>
												Manage Team
											</Link>
										)}
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
