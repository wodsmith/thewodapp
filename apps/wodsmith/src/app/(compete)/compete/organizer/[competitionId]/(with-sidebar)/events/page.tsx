import "server-only"
import { ZSAError } from "@repo/zsa"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getAllMovementsAction } from "@/actions/movement-actions"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getCompetitionDivisionsWithCounts } from "@/server/competition-divisions"
import {
	getCompetitionWorkouts,
	getWorkoutDivisionDescriptions,
} from "@/server/competition-workouts"
import { getCompetition } from "@/server/competitions"
import { getCompetitionSponsors } from "@/server/sponsors"
import { requireTeamPermission } from "@/utils/team-auth"
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

	// Parallel fetch: competition events, divisions, movements, and sponsors
	const [competitionEvents, divisionsData, movementsResult, sponsorsResult] =
		await Promise.all([
			getCompetitionWorkouts(competitionId),
			getCompetitionDivisionsWithCounts({ competitionId }),
			getAllMovementsAction(),
			getCompetitionSponsors(competitionId),
		])

	const [movements] = movementsResult ?? [null]
	const { divisions } = divisionsData

	// Flatten sponsors from groups and ungrouped
	const allSponsors = [
		...sponsorsResult.groups.flatMap((g) => g.sponsors),
		...sponsorsResult.ungroupedSponsors,
	]

	// Fetch division descriptions for all events
	const divisionIds = divisions.map((d) => d.id)
	const divisionDescriptionsByWorkout: Record<
		string,
		Array<{
			divisionId: string
			divisionLabel: string
			description: string | null
		}>
	> = {}

	if (divisionIds.length > 0) {
		// Fetch descriptions for each workout in parallel
		const descriptionPromises = competitionEvents.map(async (event) => {
			const descriptions = await getWorkoutDivisionDescriptions(
				event.workoutId,
				divisionIds,
				competition.organizingTeamId,
			)
			return { workoutId: event.workoutId, descriptions }
		})

		const results = await Promise.all(descriptionPromises)
		for (const { workoutId, descriptions } of results) {
			divisionDescriptionsByWorkout[workoutId] = descriptions
		}
	}

	return (
		<OrganizerEventManager
			competitionId={competition.id}
			organizingTeamId={competition.organizingTeamId}
			events={competitionEvents}
			movements={movements?.data ?? []}
			divisions={divisions}
			divisionDescriptionsByWorkout={divisionDescriptionsByWorkout}
			sponsors={allSponsors}
		/>
	)
}
