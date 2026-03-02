/**
 * Competition Event Edit Route
 *
 * Organizer page for editing a single competition event.
 * Fetches event details, divisions, movements, sponsors, and judging sheets.
 */

import { useState } from "react"
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
import { Video } from "lucide-react"
import {
	EVENT_DETAILS_FORM_ID,
	EventDetailsForm,
} from "@/components/events/event-details-form"
import { EventResourcesCard } from "@/components/events/event-resources-card"
import { EventJudgingSheets } from "@/components/organizer/event-judging-sheets"
import { EventSubmissionWindowCard } from "@/components/organizer/event-submission-window-card"
import { HeatSchedulePublishingCard } from "@/components/organizer/heat-schedule-publishing-card"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"

// Get parent route APIs to access loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")
const eventRoute = getRouteApi(
	"/compete/organizer/$competitionId/events/$eventId",
)

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/events/$eventId/",
)({
	component: EventEditPage,
})

function EventEditPage() {
	const {
		event,
		divisions,
		movements,
		sponsors,
		divisionDescriptions,
		resources,
		judgingSheets: initialSheets,
		isOnline,
		submissionOpensAt,
		submissionClosesAt,
		timezone,
	} = eventRoute.useLoaderData()
	// Get competition from parent layout loader data
	const { competition } = parentRoute.useLoaderData()

	// Local state for judging sheets to enable real-time updates
	const [judgingSheets, setJudgingSheets] = useState(initialSheets)

	return (
		<>
			{/* Header */}
			<div className="flex items-center justify-between">
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

			{/* Event Details Form */}
			<EventDetailsForm
				event={event}
				competitionId={competition.id}
				organizingTeamId={competition.organizingTeamId}
				divisions={divisions}
				divisionDescriptions={divisionDescriptions}
				movements={movements}
				sponsors={sponsors}
			/>

			{/* Event Resources */}
			<EventResourcesCard
				eventId={event.id}
				teamId={competition.organizingTeamId}
				initialResources={resources}
			/>

			{/* Judging Sheets */}
			<EventJudgingSheets
				competitionId={competition.id}
				trackWorkoutId={event.id}
				sheets={judgingSheets}
				onSheetsChange={setJudgingSheets}
			/>

			{/* Submission Window (online) or Heat Schedule Publishing (in-person) */}
			{isOnline ? (
				<>
					<EventSubmissionWindowCard
						competitionId={competition.id}
						eventName={event.workout.name}
						submissionOpensAt={submissionOpensAt}
						submissionClosesAt={submissionClosesAt}
						timezone={timezone}
					/>

					{/* Video Submissions Review Link */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Video className="h-5 w-5" />
								Video Submissions
							</CardTitle>
							<CardDescription>
								Review athlete video submissions for this event
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Link
								to="/compete/organizer/$competitionId/events/$eventId/submissions"
								params={{
									competitionId: competition.id,
									eventId: event.id,
								}}
							>
								<Button variant="outline">View Submissions</Button>
							</Link>
						</CardContent>
					</Card>
				</>
			) : (
				<HeatSchedulePublishingCard
					trackWorkoutId={event.id}
					eventName={event.workout.name}
					competitionId={competition.id}
					organizingTeamId={competition.organizingTeamId}
				/>
			)}
		</>
	)
}
