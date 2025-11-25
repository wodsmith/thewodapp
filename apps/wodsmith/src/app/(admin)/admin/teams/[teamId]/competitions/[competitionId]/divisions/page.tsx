import "server-only"
import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getDb } from "@/db"
import { TEAM_PERMISSIONS, teamTable } from "@/db/schema"
import { getCompetition } from "@/server/competitions"
import { getScalingGroupWithLevels } from "@/server/scaling-groups"
import { requireTeamPermission } from "@/utils/team-auth"
import { parseCompetitionSettings } from "@/types/competitions"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface CompetitionDivisionsPageProps {
	params: Promise<{
		teamId: string
		competitionId: string
	}>
}

export async function generateMetadata({
	params,
}: CompetitionDivisionsPageProps): Promise<Metadata> {
	const { teamId, competitionId } = await params
	const db = getDb()

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
	})

	const competition = await getCompetition(competitionId)

	if (!team || !competition) {
		return {
			title: "Not Found",
		}
	}

	return {
		title: `${team.name} - ${competition.name} Divisions`,
		description: `Manage divisions for ${competition.name}`,
	}
}

export default async function CompetitionDivisionsPage({
	params,
}: CompetitionDivisionsPageProps) {
	const { teamId, competitionId } = await params
	const db = getDb()

	// Get team by ID
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
	})

	if (!team) {
		notFound()
	}

	// Check if user has permission to manage competitions
	try {
		await requireTeamPermission(team.id, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)
	} catch (error) {
		console.error(
			`ERROR: Unauthorized access attempt for competition management on teamId '${team.id}'`,
			error,
		)
		throw error
	}

	// Get competition
	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	// Verify the competition belongs to this team
	if (competition.organizingTeamId !== team.id) {
		notFound()
	}

	// Parse competition settings to get division configuration
	const settings = parseCompetitionSettings(competition.settings)
	const scalingGroupId = settings?.divisions?.scalingGroupId

	// Get scaling group with levels if configured
	let scalingGroup:
		| Awaited<ReturnType<typeof getScalingGroupWithLevels>>
		| null = null
	if (scalingGroupId) {
		try {
			scalingGroup = await getScalingGroupWithLevels({
				teamId: team.id,
				scalingGroupId,
			})
		} catch (error) {
			console.error("Failed to fetch scaling group:", error)
		}
	}

	return (
		<div className="flex flex-col gap-6">
			<div>
				<div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
					<Link
						href={`/admin/teams/${team.id}/competitions`}
						className="hover:text-foreground"
					>
						Competitions
					</Link>
					<span>/</span>
					<Link
						href={`/admin/teams/${team.id}/competitions/${competition.id}`}
						className="hover:text-foreground"
					>
						{competition.name}
					</Link>
					<span>/</span>
					<span>Divisions</span>
				</div>
				<h1 className="text-3xl font-bold">Competition Divisions</h1>
				<p className="text-muted-foreground mt-1">
					Manage the divisions for this competition
				</p>
			</div>

			{/* Navigation Tabs */}
			<div className="border-b">
				<nav className="flex gap-4">
					<Link
						href={`/admin/teams/${team.id}/competitions/${competition.id}`}
						className="px-4 py-2 border-b-2 border-transparent hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground transition-colors"
					>
						Overview
					</Link>
					<span className="px-4 py-2 border-b-2 border-primary font-medium">
						Divisions
					</span>
					<span className="px-4 py-2 border-b-2 border-transparent text-muted-foreground opacity-50 cursor-not-allowed">
						Athletes (Coming Soon)
					</span>
				</nav>
			</div>

			{!scalingGroupId || !scalingGroup ? (
				<Card>
					<CardHeader>
						<CardTitle>No Divisions Configured</CardTitle>
						<CardDescription>
							This competition does not have any divisions set up yet. Athletes
							will register without selecting a division.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Link
							href={`/admin/teams/${team.id}/competitions/${competition.id}/edit`}
						>
							<Button>Configure Divisions</Button>
						</Link>
					</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>{scalingGroup.title}</CardTitle>
									<CardDescription>
										{scalingGroup.description || "Scaling group for divisions"}
									</CardDescription>
								</div>
								<div className="flex gap-2">
									<Link
										href={`/admin/teams/${team.id}/competitions/${competition.id}/edit`}
									>
										<Button variant="outline" size="sm">
											Change Divisions
										</Button>
									</Link>
									<Link href={`/admin/teams/${team.id}/scaling`}>
										<Button variant="outline" size="sm">
											Manage Scaling Groups
										</Button>
									</Link>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div>
									<h3 className="text-lg font-semibold mb-3">
										Division Levels
									</h3>
									<div className="space-y-2">
										{scalingGroup.levels.map((level) => (
											<div
												key={level.id}
												className="flex items-center justify-between p-3 border rounded-lg"
											>
												<div className="flex items-center gap-3">
													<Badge variant="outline">
														Position {level.position}
													</Badge>
													<span className="font-medium">{level.label}</span>
												</div>
												<div className="text-sm text-muted-foreground">
													{/* TODO: Add registration count per division in Phase 4 */}
													0 registrations
												</div>
											</div>
										))}
									</div>
								</div>

								{scalingGroup.levels.length === 0 && (
									<div className="text-center py-8 text-muted-foreground">
										<p>No levels defined in this scaling group.</p>
										<p className="text-sm mt-1">
											Add levels to this scaling group to create divisions.
										</p>
									</div>
								)}
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>How Divisions Work</CardTitle>
							<CardDescription>
								Understanding competition divisions
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2 text-sm">
							<p>
								Athletes will select their division (scaling level) when
								registering for this competition.
							</p>
							<p>
								The position number indicates difficulty: 0 is the hardest, and
								higher numbers are progressively easier.
							</p>
							<p>
								You can manage the scaling levels by clicking "Manage Scaling
								Groups" above.
							</p>
						</CardContent>
					</Card>
				</>
			)}
		</div>
	)
}
