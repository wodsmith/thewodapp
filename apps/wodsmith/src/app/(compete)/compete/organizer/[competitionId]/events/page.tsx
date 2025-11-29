import "server-only"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ZSAError } from "@repo/zsa"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getCompetitionWorkouts } from "@/server/competition-workouts"
import { getCompetition } from "@/server/competitions"
import { getUserWorkouts } from "@/server/workouts"
import { requireTeamPermission } from "@/utils/team-auth"
import { OrganizerBreadcrumb } from "../../_components/organizer-breadcrumb"
import { OrganizerEventManager } from "./_components/organizer-event-manager"

interface CompetitionEventsPageProps {
	params: Promise<{
		competitionId: string
	}>
}

export async function generateMetadata({
	params,
}: CompetitionEventsPageProps): Promise<Metadata> {
	const { competitionId } = await params
	const competition = await getCompetition(competitionId)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `${competition.name} - Events`,
		description: `Manage events for ${competition.name}`,
	}
}

export default async function CompetitionEventsPage({
	params,
}: CompetitionEventsPageProps) {
	const { competitionId } = await params

	// Get competition
	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	// Check if user has permission on the organizing team
	try {
		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)
	} catch (error) {
		if (
			error instanceof ZSAError &&
			(error.code === "NOT_AUTHORIZED" || error.code === "FORBIDDEN")
		) {
			notFound()
		}
		throw error
	}

	// Parallel fetch: competition events and available workouts
	const [competitionEvents, availableWorkouts] = await Promise.all([
		getCompetitionWorkouts(competitionId),
		getUserWorkouts({
			teamId: competition.organizingTeamId,
			limit: 100,
		}),
	])

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				{/* Header */}
				<div>
					<OrganizerBreadcrumb
						segments={[
							{ label: competition.name, href: `/compete/organizer/${competition.id}` },
							{ label: "Events" },
						]}
					/>
					<h1 className="text-3xl font-bold">Competition Events</h1>
					<p className="text-muted-foreground mt-1">
						Manage the workouts/events for this competition
					</p>
				</div>

				{/* Navigation Tabs */}
				<div className="border-b">
					<nav className="flex gap-4">
						<Link
							href={`/compete/organizer/${competition.id}`}
							className="px-4 py-2 border-b-2 border-transparent hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground transition-colors"
						>
							Overview
						</Link>
						<Link
							href={`/compete/organizer/${competition.id}/divisions`}
							className="px-4 py-2 border-b-2 border-transparent hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground transition-colors"
						>
							Divisions
						</Link>
						<span className="px-4 py-2 border-b-2 border-primary font-medium">
							Events
						</span>
						<Link
							href={`/compete/organizer/${competition.id}/athletes`}
							className="px-4 py-2 border-b-2 border-transparent hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground transition-colors"
						>
							Athletes
						</Link>
					</nav>
				</div>

				<OrganizerEventManager
					competitionId={competition.id}
					organizingTeamId={competition.organizingTeamId}
					events={competitionEvents}
					availableWorkouts={availableWorkouts}
				/>
			</div>
		</div>
	)
}
