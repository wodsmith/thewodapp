"use client"

import { useServerAction } from "@repo/zsa-react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useState } from "react"
import { updateCompetitionWorkoutAction } from "@/actions/competition-actions"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import type { HeatWithAssignments } from "@/server/competition-heats"
import type { CompetitionWorkout } from "@/server/competition-workouts"

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

	const handleHeatStatusChange = async (
		trackWorkoutId: string,
		newStatus: string,
	) => {
		setPendingEvents((prev) => new Set(prev).add(trackWorkoutId))
		await execute({
			trackWorkoutId,
			organizingTeamId,
			heatStatus: newStatus as "draft" | "published",
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
								<Select
									value={event.heatStatus ?? "draft"}
									onValueChange={(value) =>
										handleHeatStatusChange(event.id, value)
									}
									disabled={pendingEvents.has(event.id)}
								>
									<SelectTrigger className="w-[110px] h-7 text-xs">
										{pendingEvents.has(event.id) ? (
											<Loader2 className="h-3.5 w-3.5 animate-spin" />
										) : (
											<SelectValue>
												<span className="flex items-center gap-1.5">
													{isPublished ? (
														<Eye className="h-3.5 w-3.5 text-green-600" />
													) : (
														<EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
													)}
													{isPublished ? "Published" : "Draft"}
												</span>
											</SelectValue>
										)}
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="draft">
											<span className="flex items-center gap-2">
												<EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
												Draft
											</span>
										</SelectItem>
										<SelectItem value="published">
											<span className="flex items-center gap-2">
												<Eye className="h-3.5 w-3.5 text-green-600" />
												Published
											</span>
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
						)
					})}
				</div>
			</CardContent>
		</Card>
	)
}
