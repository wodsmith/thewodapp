import "server-only"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getCompetition } from "@/server/competitions"
import { getScalingGroupWithLevels } from "@/server/scaling-groups"
import { parseCompetitionSettings } from "@/types/competitions"
import { requireTeamPermission } from "@/utils/team-auth"
import { getAdminTeamContext } from "../../../_utils/get-team-context"
import { DivisionManager } from "./_components/division-manager"

interface CompetitionDivisionsPageProps {
	params: Promise<{
		competitionId: string
	}>
}

export async function generateMetadata({
	params,
}: CompetitionDivisionsPageProps): Promise<Metadata> {
	const { team } = await getAdminTeamContext()
	const { competitionId } = await params

	const competition = await getCompetition(competitionId)

	if (!competition) {
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
	const { team } = await getAdminTeamContext()
	const { competitionId } = await params

	// Check if user has permission to manage competitions
	await requireTeamPermission(team.id, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

	// Get competition
	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	// Verify the competition belongs to this team (organizing or event team)
	if (competition.organizingTeamId !== team.id && competition.competitionTeamId !== team.id) {
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
						href="/admin/teams/competitions"
						className="hover:text-foreground"
					>
						Competitions
					</Link>
					<span>/</span>
					<Link
						href={`/admin/teams/competitions/${competition.id}`}
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
						href={`/admin/teams/competitions/${competition.id}`}
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
							href={`/admin/teams/competitions/${competition.id}/edit`}
						>
							<Button>Configure Divisions</Button>
						</Link>
					</CardContent>
				</Card>
			) : (
				<>
					<DivisionManager
						teamId={team.id}
						competitionId={competition.id}
						scalingGroupId={scalingGroupId}
						scalingGroupTitle={scalingGroup.title}
						scalingGroupDescription={scalingGroup.description}
						levels={scalingGroup.levels}
					/>

					<Card>
						<CardHeader>
							<CardTitle>How Divisions Work</CardTitle>
							<CardDescription>
								Understanding competition divisions
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2 text-sm">
							<p>
								Athletes will select their division when registering for this
								competition.
							</p>
							<p>
								<strong>Position:</strong> #1 is the most difficult (e.g., RX),
								and higher numbers are progressively easier (e.g., Scaled).
							</p>
							<p>
								<strong>Team Size:</strong> Individual divisions have size 1.
								Team divisions (pairs, teams of 3, etc.) have size 2+.
							</p>
						</CardContent>
					</Card>
				</>
			)}
		</div>
	)
}
