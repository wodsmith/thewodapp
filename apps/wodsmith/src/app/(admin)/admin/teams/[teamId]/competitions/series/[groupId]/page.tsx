import "server-only"
import { eq } from "drizzle-orm"
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
import { getDb } from "@/db"
import {
	TEAM_PERMISSIONS,
	competitionsTable,
	teamTable,
} from "@/db/schema"
import { getCompetitionGroup } from "@/server/competitions"
import { requireTeamPermission } from "@/utils/team-auth"
import { CompetitionGroupActions } from "./_components/competition-group-actions"

interface CompetitionGroupDetailPageProps {
	params: Promise<{
		teamId: string
		groupId: string
	}>
}

export async function generateMetadata({
	params,
}: CompetitionGroupDetailPageProps): Promise<Metadata> {
	const { teamId, groupId } = await params
	const db = getDb()

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
	})

	const group = await getCompetitionGroup(groupId)

	if (!team || !group) {
		return {
			title: "Not Found",
		}
	}

	return {
		title: `${team.name} - ${group.name}`,
		description: `View details for ${group.name} competition series`,
	}
}

export default async function CompetitionGroupDetailPage({
	params,
}: CompetitionGroupDetailPageProps) {
	const { teamId, groupId } = await params
	const db = getDb()

	// Get team by ID
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, teamId),
	})

	if (!team) {
		notFound()
	}

	// Check if user has permission
	try {
		await requireTeamPermission(team.id, TEAM_PERMISSIONS.ACCESS_DASHBOARD)
	} catch (error) {
		console.error(
			`ERROR: Unauthorized access attempt for competition group ${groupId} on teamId '${team.id}'`,
			error,
		)
		throw error
	}

	// Get competition group
	const group = await getCompetitionGroup(groupId)

	if (!group) {
		notFound()
	}

	// Verify the group belongs to this team
	if (group.organizingTeamId !== team.id) {
		notFound()
	}

	// Get all competitions in this group
	const competitions = await db.query.competitionsTable.findMany({
		where: eq(competitionsTable.groupId, groupId),
		orderBy: (table, { desc }) => [desc(table.startDate)],
	})

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-start justify-between">
				<div className="flex-1">
					<div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
						<Link
							href={`/admin/teams/${team.id}/competitions/series`}
							className="hover:text-foreground"
						>
							Competition Series
						</Link>
						<span>/</span>
						<span>{group.name}</span>
					</div>
					<h1 className="text-3xl font-bold">{group.name}</h1>
					{group.description && (
						<p className="text-muted-foreground mt-2">{group.description}</p>
					)}
				</div>
				<CompetitionGroupActions
					groupId={group.id}
					teamId={team.id}
					hasCompetitions={competitions.length > 0}
				/>
			</div>

			{/* Series Details Card */}
			<Card>
				<CardHeader>
					<CardTitle>Series Details</CardTitle>
					<CardDescription>Information about this competition series</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div>
						<div className="text-sm font-medium text-muted-foreground">Slug</div>
						<div className="text-sm font-mono mt-1">{group.slug}</div>
					</div>
					<div>
						<div className="text-sm font-medium text-muted-foreground">
							Competitions
						</div>
						<div className="text-sm mt-1">
							{competitions.length} {competitions.length === 1 ? "competition" : "competitions"}
						</div>
					</div>
					<div>
						<div className="text-sm font-medium text-muted-foreground">
							Created
						</div>
						<div className="text-sm mt-1">
							{new Date(group.createdAt).toLocaleDateString(undefined, {
								year: "numeric",
								month: "long",
								day: "numeric",
							})}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Competitions List */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Competitions</CardTitle>
							<CardDescription>
								Competitions in this series
							</CardDescription>
						</div>
						<Link href={`/admin/teams/${team.id}/competitions/new?groupId=${groupId}`}>
							<Button variant="outline" size="sm">
								Add Competition
							</Button>
						</Link>
					</div>
				</CardHeader>
				<CardContent>
					{competitions.length === 0 ? (
						<div className="text-center py-8">
							<p className="text-muted-foreground mb-4">
								No competitions in this series yet.
							</p>
							<Link href={`/admin/teams/${team.id}/competitions/new?groupId=${groupId}`}>
								<Button variant="outline" size="sm">
									Create First Competition
								</Button>
							</Link>
						</div>
					) : (
						<div className="space-y-3">
							{competitions.map((competition) => (
								<Link
									key={competition.id}
									href={`/admin/teams/${team.id}/competitions/${competition.id}`}
									className="block"
								>
									<div className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors">
										<div>
											<div className="font-medium">{competition.name}</div>
											<div className="text-sm text-muted-foreground mt-1">
												{new Date(competition.startDate).toLocaleDateString()} -{" "}
												{new Date(competition.endDate).toLocaleDateString()}
											</div>
										</div>
										<div className="text-sm text-muted-foreground">
											/{competition.slug}
										</div>
									</div>
								</Link>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
