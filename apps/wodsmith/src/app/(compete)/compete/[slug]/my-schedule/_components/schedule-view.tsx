"use client"

import type { EventWithRotations } from "@/server/judge-schedule"
import { EventSection } from "./event-section"

interface ScheduleViewProps {
	events: EventWithRotations[]
	competitionName: string
}

/**
 * Client component that displays all judge rotations grouped by event
 */
export function ScheduleView({ events, competitionName }: ScheduleViewProps) {
	if (events.length === 0) {
		return (
			<div className="bg-muted rounded-lg border p-8 text-center">
				<h1 className="text-2xl font-bold mb-2">No Assignments Yet</h1>
				<p className="text-muted-foreground">
					No judging assignments yet. Check back after the organizer publishes
					the schedule.
				</p>
			</div>
		)
	}

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-3xl font-bold mb-2">My Judging Schedule</h1>
				<p className="text-muted-foreground">{competitionName}</p>
			</div>

			<div className="space-y-8">
				{events.map((event) => (
					<EventSection key={event.trackWorkoutId} event={event} />
				))}
			</div>

			<div className="bg-muted rounded-lg border p-4 text-sm text-muted-foreground">
				<p className="font-semibold mb-1">Need help?</p>
				<p>
					If you have questions about your assignments, please contact the
					competition organizers.
				</p>
			</div>
		</div>
	)
}
