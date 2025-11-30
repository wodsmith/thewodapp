import "server-only"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ZSAError } from "@repo/zsa"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getCompetitionDivisionsWithCounts } from "@/server/competition-divisions"
import {
	getCompetitionFloors,
	getCompetitionHeats,
} from "@/server/competition-schedule"
import { getCompetitionWorkouts } from "@/server/competition-workouts"
import { getCompetition, getCompetitionRegistrations } from "@/server/competitions"
import { requireTeamPermission } from "@/utils/team-auth"
import { OrganizerBreadcrumb } from "../../_components/organizer-breadcrumb"
import { FloorManager } from "./_components/floor-manager"
import { HeatScheduleManager } from "./_components/heat-schedule-manager"

interface CompetitionSchedulePageProps {
	params: Promise<{
		competitionId: string
	}>
}

export async function generateMetadata({
	params,
}: CompetitionSchedulePageProps): Promise<Metadata> {
	const { competitionId } = await params
	const competition = await getCompetition(competitionId)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `${competition.name} - Schedule`,
		description: `Manage heat schedule for ${competition.name}`,
	}
}

export default async function CompetitionSchedulePage({
	params,
}: CompetitionSchedulePageProps) {
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

	// Fetch all needed data in parallel
	const [floors, heats, events, divisions, registrations] = await Promise.all([
		getCompetitionFloors(competitionId),
		getCompetitionHeats(competitionId),
		getCompetitionWorkouts(competitionId),
		getCompetitionDivisionsWithCounts({ competitionId }),
		getCompetitionRegistrations(competitionId),
	])

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				{/* Breadcrumb and Header */}
				<div>
					<OrganizerBreadcrumb
						segments={[
							{ label: competition.name, href: `/compete/organizer/${competition.id}` },
							{ label: "Schedule" },
						]}
					/>
					<h1 className="text-3xl font-bold">Heat Schedule</h1>
					<p className="text-muted-foreground mt-1">
						Configure floors and generate heat schedules for events
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
						<Link
							href={`/compete/organizer/${competition.id}/events`}
							className="px-4 py-2 border-b-2 border-transparent hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground transition-colors"
						>
							Events
						</Link>
						<span className="px-4 py-2 border-b-2 border-primary font-medium">
							Schedule
						</span>
						<Link
							href={`/compete/organizer/${competition.id}/athletes`}
							className="px-4 py-2 border-b-2 border-transparent hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground transition-colors"
						>
							Athletes
						</Link>
					</nav>
				</div>

				{/* Floor Configuration */}
				<FloorManager
					competitionId={competition.id}
					floors={floors}
				/>

				{/* Heat Schedule Manager */}
				<HeatScheduleManager
					competitionId={competition.id}
					floors={floors}
					events={events}
					divisions={divisions?.divisions ?? []}
					heats={heats}
					registrations={registrations}
					competitionStartDate={competition.startDate}
				/>
			</div>
		</div>
	)
}
