import "server-only"
import { ZSAError } from "@repo/zsa"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getAllMovementsAction } from "@/actions/movement-actions"
import { Button } from "@/components/ui/button"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getCompetitionDivisionsWithCounts } from "@/server/competition-divisions"
import {
	getCompetitionEvent,
	getWorkoutDivisionDescriptions,
} from "@/server/competition-workouts"
import { getCompetition } from "@/server/competitions"
import { requireTeamPermission } from "@/utils/team-auth"
import { OrganizerBreadcrumb } from "../../../_components/organizer-breadcrumb"
import {
	EVENT_DETAILS_FORM_ID,
	EventDetailsForm,
} from "./_components/event-details-form"

interface EventDetailsPageProps {
	params: Promise<{
		competitionId: string
		eventId: string
	}>
}

export async function generateMetadata({
	params,
}: EventDetailsPageProps): Promise<Metadata> {
	const { competitionId, eventId } = await params
	const [competition, event] = await Promise.all([
		getCompetition(competitionId),
		getCompetitionEvent(eventId),
	])

	if (!competition || !event) {
		return {
			title: "Event Not Found",
		}
	}

	return {
		title: `${event.workout.name} - ${competition.name}`,
		description: `Edit event details for ${event.workout.name}`,
	}
}

export default async function EventDetailsPage({
	params,
}: EventDetailsPageProps) {
	const { competitionId, eventId } = await params

	// Parallel fetch: competition and event
	const [competition, event] = await Promise.all([
		getCompetition(competitionId),
		getCompetitionEvent(eventId),
	])

	if (!competition) {
		notFound()
	}

	if (!event) {
		notFound()
	}

	// Check permission
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

	// Get divisions for the competition (for division-specific descriptions) and movements
	const [{ divisions }, movementsResult] = await Promise.all([
		getCompetitionDivisionsWithCounts({ competitionId }),
		getAllMovementsAction(),
	])

	const [movements] = movementsResult ?? [null]

	// Fetch division descriptions for this workout
	const divisionDescriptions = await getWorkoutDivisionDescriptions(
		event.workoutId,
		divisions.map((d) => d.id),
		competition.organizingTeamId,
	)

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				{/* Header */}
				<div>
					<OrganizerBreadcrumb
						segments={[
							{
								label: competition.name,
								href: `/compete/organizer/${competition.id}`,
							},
							{
								label: "Events",
								href: `/compete/organizer/${competition.id}/events`,
							},
							{ label: event.workout.name },
						]}
					/>
					<div className="flex items-center justify-between mt-4">
						<div>
							<h1 className="text-3xl font-bold">Edit Event</h1>
							<p className="text-muted-foreground mt-1">
								Event #{event.trackOrder} - {event.workout.name}
							</p>
						</div>
						<Button type="submit" form={EVENT_DETAILS_FORM_ID}>
							Save Changes
						</Button>
					</div>
				</div>

				<EventDetailsForm
					event={event}
					competitionId={competition.id}
					organizingTeamId={competition.organizingTeamId}
					divisions={divisions}
					divisionDescriptions={divisionDescriptions}
					movements={movements?.data ?? []}
				/>
			</div>
		</div>
	)
}
