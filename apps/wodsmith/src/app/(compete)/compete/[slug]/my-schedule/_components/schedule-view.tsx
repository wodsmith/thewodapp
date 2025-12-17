"use client"

import type { CompetitionJudgeRotation } from "@/db/schema"
import { ScheduleCard } from "./schedule-card"

export interface EnrichedRotation {
	rotation: CompetitionJudgeRotation
	eventName: string
	timeWindow: string | null
	isUpcoming: boolean
}

interface ScheduleViewProps {
	rotations: EnrichedRotation[]
	competitionName: string
}

/**
 * Client component that displays all judge rotations
 */
export function ScheduleView({
	rotations,
	competitionName,
}: ScheduleViewProps) {
	if (rotations.length === 0) {
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
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold mb-2">My Judging Schedule</h1>
				<p className="text-muted-foreground">{competitionName}</p>
			</div>

			<div className="space-y-4">
				{rotations.map((enriched) => (
					<ScheduleCard
						key={enriched.rotation.id}
						rotation={enriched.rotation}
						eventName={enriched.eventName}
						timeWindow={enriched.timeWindow}
						isUpcoming={enriched.isUpcoming}
					/>
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
