"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Plus, User, Mail, Clock } from "lucide-react"

// TODO: Migrate full component from apps/wodsmith/src/app/(admin)/admin/teams/[teamId]/coaches/_components/Coaches.tsx
// This is a stub component that displays coaches data
// Full component includes: create/delete coach dialogs, skill assignment, availability management

interface Coach {
	id: string
	userId: string
	teamId: string
	bio: string | null
	hourlyRate: number | null
	isActive: number
	user?: {
		id: string
		name: string | null
		email: string
	}
	skills?: Array<{
		skill: {
			id: string
			name: string
		}
	}>
}

interface TeamMember {
	userId: string
	teamId: string
	role: string
	user: {
		id: string
		name: string | null
		email: string
	}
}

interface Skill {
	id: string
	name: string
}

interface CoachesProps {
	coaches: Coach[] | null
	teamMembers: TeamMember[] | null
	availableSkills: Skill[] | null
	teamId: string
	teamSlug: string
}

export default function Coaches({
	coaches,
	teamMembers,
	availableSkills,
	teamId,
	teamSlug,
}: CoachesProps) {
	const coachesList = coaches ?? []
	const membersList = teamMembers ?? []
	const skillsList = availableSkills ?? []

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h2 className="text-2xl font-bold font-mono">Coaches</h2>
					<p className="text-muted-foreground font-mono">
						Manage coaching staff and their specializations
					</p>
				</div>
				<Button disabled>
					<Plus className="h-4 w-4 mr-2" />
					Add Coach
				</Button>
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{coachesList.length === 0 ? (
					<Card className="col-span-full">
						<CardContent className="py-12 text-center">
							<p className="text-muted-foreground font-mono">
								No coaches added yet. Add your first coach to get started.
							</p>
						</CardContent>
					</Card>
				) : (
					coachesList.map((coach) => (
						<Card key={coach.id}>
							<CardHeader>
								<CardTitle className="flex items-center gap-2 font-mono">
									<User className="h-4 w-4" />
									{coach.user?.name || "Unknown Coach"}
								</CardTitle>
								<CardDescription className="flex items-center gap-2 font-mono">
									<Mail className="h-3 w-3" />
									{coach.user?.email}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								{coach.bio && (
									<p className="text-sm text-muted-foreground font-mono">
										{coach.bio}
									</p>
								)}
								{coach.hourlyRate && (
									<div className="flex items-center gap-2 text-sm font-mono">
										<Clock className="h-3 w-3" />
										${coach.hourlyRate}/hour
									</div>
								)}
								{coach.skills && coach.skills.length > 0 && (
									<div className="flex flex-wrap gap-1">
										{coach.skills.map((s) => (
											<Badge
												key={s.skill.id}
												variant="secondary"
												className="font-mono text-xs"
											>
												{s.skill.name}
											</Badge>
										))}
									</div>
								)}
								<Badge
									variant={coach.isActive ? "default" : "secondary"}
									className="font-mono"
								>
									{coach.isActive ? "Active" : "Inactive"}
								</Badge>
							</CardContent>
						</Card>
					))
				)}
			</div>

			{/* Debug info */}
			<details className="text-xs text-muted-foreground">
				<summary>Debug: Data Summary</summary>
				<pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
					{JSON.stringify(
						{
							teamId,
							teamSlug,
							coachesCount: coachesList.length,
							membersCount: membersList.length,
							skillsCount: skillsList.length,
						},
						null,
						2
					)}
				</pre>
			</details>
		</div>
	)
}
