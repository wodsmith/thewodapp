import "server-only"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { ZSAError } from "@repo/zsa"
import { getAllMovementsAction } from "@/actions/movement-actions"
import { getAllTagsAction } from "@/actions/tag-actions"
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
import { EventDetailsForm } from "./_components/event-details-form"

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

	// Get divisions for the competition (for division-specific descriptions), movements, and tags
	const [{ divisions }, movementsResult, tagsResult] = await Promise.all([
		getCompetitionDivisionsWithCounts({ competitionId }),
		getAllMovementsAction(),
		getAllTagsAction(),
	])

	const [movements] = movementsResult ?? [null]
	const [tags] = tagsResult ?? [null]

	// Fetch division descriptions for this workout
	const divisionDescriptions = await getWorkoutDivisionDescriptions(
		event.workoutId,
		divisions.map((d) => d.id),
	)

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6 max-w-3xl">
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
					<div className="flex items-center gap-4 mt-2">
						<Button variant="ghost" size="sm" asChild>
							<Link href={`/compete/organizer/${competition.id}/events`}>
								<ChevronLeft className="h-4 w-4 mr-1" />
								Back to Events
							</Link>
						</Button>
					</div>
					<h1 className="text-3xl font-bold mt-4">Edit Event</h1>
					<p className="text-muted-foreground mt-1">
						Event #{event.trackOrder} - {event.workout.name}
					</p>
				</div>

				<EventDetailsForm
					event={event}
					competitionId={competition.id}
					organizingTeamId={competition.organizingTeamId}
					divisions={divisions}
					divisionDescriptions={divisionDescriptions}
					movements={movements?.data ?? []}
					tags={tags?.data ?? []}
				/>
			</div>
		</div>
	)
}
