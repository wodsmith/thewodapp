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
import { requireTeamPermission } from "@/utils/team-auth"
import { getAdminTeamContext } from "../../_utils/get-team-context"
import { CompetitionActions } from "../../[teamId]/competitions/[competitionId]/_components/competition-actions"

interface CompetitionDetailPageProps {
	params: Promise<{
		competitionId: string
	}>
}

export async function generateMetadata({
	params,
}: CompetitionDetailPageProps): Promise<Metadata> {
	const { team } = await getAdminTeamContext()
	const { competitionId } = await params

	const competition = await getCompetition(competitionId)

	if (!competition) {
		return {
			title: "Not Found",
		}
	}

	return {
		title: `${team.name} - ${competition.name}`,
		description: `View details for ${competition.name}`,
	}
}

export default async function CompetitionDetailPage({
	params,
}: CompetitionDetailPageProps) {
	const { team } = await getAdminTeamContext()
	const { competitionId } = await params

	// Check if user has permission
	await requireTeamPermission(team.id, TEAM_PERMISSIONS.ACCESS_DASHBOARD)

	// Get competition
	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	// Verify the competition belongs to this team (organizing or event team)
	if (competition.organizingTeamId !== team.id && competition.competitionTeamId !== team.id) {
		notFound()
	}

	// Group is already fetched via getCompetition relation
	const group = competition.group

	const formatDate = (date: Date) => {
		return new Date(date).toLocaleDateString(undefined, {
			year: "numeric",
			month: "long",
			day: "numeric",
		})
	}

	const formatDateTime = (date: Date) => {
		return new Date(date).toLocaleDateString(undefined, {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		})
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-start justify-between">
				<div className="flex-1">
					<div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
						<Link
							href="/admin/teams/competitions"
							className="hover:text-foreground"
						>
							Competitions
						</Link>
						{group && (
							<>
								<span>/</span>
								<Link
									href={`/admin/teams/competitions/series/${group.id}`}
									className="hover:text-foreground"
								>
									{group.name}
								</Link>
							</>
						)}
						<span>/</span>
						<span>{competition.name}</span>
					</div>
					<h1 className="text-3xl font-bold">{competition.name}</h1>
					{competition.description && (
						<p className="text-muted-foreground mt-2">
							{competition.description}
						</p>
					)}
				</div>
				<CompetitionActions
					competitionId={competition.id}
					teamId={team.id}
				/>
			</div>

			{/* Navigation Tabs */}
			<div className="border-b">
				<nav className="flex gap-4">
					<span className="px-4 py-2 border-b-2 border-primary font-medium">
						Overview
					</span>
					<Link
						href={`/admin/teams/competitions/${competition.id}/divisions`}
						className="px-4 py-2 border-b-2 border-transparent hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground transition-colors"
					>
						Divisions
					</Link>
					<span className="px-4 py-2 border-b-2 border-transparent text-muted-foreground opacity-50 cursor-not-allowed">
						Athletes (Coming Soon)
					</span>
				</nav>
			</div>

			{/* Competition Details Card */}
			<Card>
				<CardHeader>
					<CardTitle>Competition Details</CardTitle>
					<CardDescription>Basic information about this competition</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 md:grid-cols-2">
						<div>
							<div className="text-sm font-medium text-muted-foreground">
								Competition Dates
							</div>
							<div className="text-sm mt-1">
								{formatDate(competition.startDate)} -{" "}
								{formatDate(competition.endDate)}
							</div>
						</div>
						<div>
							<div className="text-sm font-medium text-muted-foreground">
								Slug
							</div>
							<div className="text-sm font-mono mt-1">{competition.slug}</div>
						</div>
					</div>

					{group && (
						<div>
							<div className="text-sm font-medium text-muted-foreground">
								Series
							</div>
							<div className="text-sm mt-1">
								<Link
									href={`/admin/teams/competitions/series/${group.id}`}
									className="text-primary hover:underline"
								>
									{group.name}
								</Link>
							</div>
						</div>
					)}

					<div>
						<div className="text-sm font-medium text-muted-foreground">
							Competition Team
						</div>
						<div className="text-sm mt-1 font-mono">
							{competition.competitionTeamId}
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							Athletes will be added to this team when they register
						</p>
					</div>

					<div>
						<div className="text-sm font-medium text-muted-foreground">
							Created
						</div>
						<div className="text-sm mt-1">{formatDateTime(competition.createdAt)}</div>
					</div>
				</CardContent>
			</Card>

			{/* Registration Window Card */}
			<Card>
				<CardHeader>
					<CardTitle>Registration</CardTitle>
					<CardDescription>Registration window and settings</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{competition.registrationOpensAt && competition.registrationClosesAt ? (
						<>
							<div className="grid gap-4 md:grid-cols-2">
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Registration Opens
									</div>
									<div className="text-sm mt-1">
										{formatDateTime(competition.registrationOpensAt)}
									</div>
								</div>
								<div>
									<div className="text-sm font-medium text-muted-foreground">
										Registration Closes
									</div>
									<div className="text-sm mt-1">
										{formatDateTime(competition.registrationClosesAt)}
									</div>
								</div>
							</div>
							<div>
								<div className="text-sm font-medium text-muted-foreground">
									Status
								</div>
								<div className="text-sm mt-1">
									{new Date() < new Date(competition.registrationOpensAt)
										? "Not yet open"
										: new Date() > new Date(competition.registrationClosesAt)
											? "Closed"
											: "Open"}
								</div>
							</div>
						</>
					) : (
						<div className="text-center py-6">
							<p className="text-sm text-muted-foreground">
								No registration window configured
							</p>
							<Link href={`/admin/teams/competitions/${competition.id}/edit`}>
								<Button variant="outline" size="sm" className="mt-2">
									Configure Registration
								</Button>
							</Link>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Registrations Card - Placeholder for Phase 2 */}
			<Card>
				<CardHeader>
					<CardTitle>Registrations</CardTitle>
					<CardDescription>Athletes registered for this competition</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-center py-8">
						<p className="text-muted-foreground text-sm">
							Registration management coming in Phase 2
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
