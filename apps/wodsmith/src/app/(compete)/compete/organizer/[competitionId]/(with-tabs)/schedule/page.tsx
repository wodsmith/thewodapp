import "server-only"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ZSAError } from "@repo/zsa"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getCompetitionDivisionsWithCounts } from "@/server/competition-divisions"
import {
	getCompetitionVenues,
	getHeatsForCompetition,
} from "@/server/competition-heats"
import { getCompetitionWorkouts } from "@/server/competition-workouts"
import {
	getCompetition,
	getCompetitionRegistrations,
} from "@/server/competitions"
import { requireTeamPermission } from "@/utils/team-auth"
import { HeatScheduleManager } from "./_components/heat-schedule-manager"
import { VenueManager } from "./_components/venue-manager"

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

	// Parallel fetch: venues, events, heats, divisions, and registrations
	const [venues, events, heats, divisionsData, registrations] =
		await Promise.all([
			getCompetitionVenues(competitionId),
			getCompetitionWorkouts(competitionId),
			getHeatsForCompetition(competitionId),
			getCompetitionDivisionsWithCounts({ competitionId }),
			getCompetitionRegistrations(competitionId),
		])

	const { divisions } = divisionsData

	return (
		<div className="space-y-8">
			{/* Venue Manager */}
			<section>
				<h2 className="text-lg font-semibold mb-4">Venues</h2>
				<VenueManager
					competitionId={competition.id}
					organizingTeamId={competition.organizingTeamId}
					venues={venues}
				/>
			</section>

			{/* Heat Schedule Manager */}
			<section>
				<h2 className="text-lg font-semibold mb-4">Heat Schedule</h2>
				<HeatScheduleManager
					competitionId={competition.id}
					organizingTeamId={competition.organizingTeamId}
					competitionStartDate={competition.startDate}
					events={events}
					venues={venues}
					heats={heats}
					divisions={divisions}
					registrations={registrations}
				/>
			</section>
		</div>
	)
}
