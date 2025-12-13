"use client"

import { useState } from "react"
import { useServerAction } from "@repo/zsa-react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { updateCompetitionWorkoutAction } from "@/actions/competition-actions"
import type { CompetitionWorkout } from "@/server/competition-workouts"
import type { HeatWithAssignments } from "@/server/competition-heats"

interface QuickActionsHeatsProps {
	events: CompetitionWorkout[]
	heats: HeatWithAssignments[]
	organizingTeamId: string
}

export function QuickActionsHeats({
	events,
	heats,
	organizingTeamId,
}: QuickActionsHeatsProps) {
	const { execute } = useServerAction(updateCompetitionWorkoutAction)
	const [pendingEvents, setPendingEvents] = useState<Set<string>>(new Set())

	const handleToggleHeatStatus = async (
		trackWorkoutId: string,
		currentStatus: string | null,
	) => {
		setPendingEvents((prev) => new Set(prev).add(trackWorkoutId))
		const newStatus = currentStatus === "published" ? "draft" : "published"
		await execute({
			trackWorkoutId,
			organizingTeamId,
			heatStatus: newStatus,
		})
		setPendingEvents((prev) => {
			const next = new Set(prev)
			next.delete(trackWorkoutId)
			return next
		})
	}

	// Only show events that have scheduled heats
	const eventsWithHeats = events.filter((event) => {
		const eventHeats = heats.filter(
			(h) => h.trackWorkoutId === event.id && h.scheduledTime,
		)
		return eventHeats.length > 0
	})

	if (eventsWithHeats.length === 0) {
		return null
	}

	const publishedCount = eventsWithHeats.filter(
		(e) => e.heatStatus === "published",
	).length
	const draftCount = eventsWithHeats.length - publishedCount

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="text-base">Publish Heat Schedules</CardTitle>
						<CardDescription>
							{publishedCount} published, {draftCount} draft
						</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{eventsWithHeats.map((event) => {
						const isPublished = event.heatStatus === "published"
						const eventHeats = heats.filter(
							(h) => h.trackWorkoutId === event.id && h.scheduledTime,
						)
						return (
							<div
								key={event.id}
								className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0"
							>
								<div className="flex items-center gap-2 min-w-0">
									<span className="text-xs text-muted-foreground w-5 text-right tabular-nums">
										{event.trackOrder}
									</span>
									<span className="text-sm truncate">{event.workout.name}</span>
									<span className="text-xs text-muted-foreground">
										({eventHeats.length} heat
										{eventHeats.length !== 1 ? "s" : ""})
									</span>
								</div>
								<div className="flex items-center gap-2 shrink-0">
									<Badge
										variant={isPublished ? "default" : "secondary"}
										className="text-xs"
									>
										{isPublished ? "Published" : "Draft"}
									</Badge>
									<Button
										variant="ghost"
										size="sm"
										className="h-7 w-7 p-0"
										onClick={() =>
											handleToggleHeatStatus(event.id, event.heatStatus)
										}
										disabled={pendingEvents.has(event.id)}
									>
										{pendingEvents.has(event.id) ? (
											<Loader2 className="h-3.5 w-3.5 animate-spin" />
										) : isPublished ? (
											<EyeOff className="h-3.5 w-3.5" />
										) : (
											<Eye className="h-3.5 w-3.5" />
										)}
									</Button>
								</div>
							</div>
						)
					})}
				</div>
			</CardContent>
		</Card>
	)
}
