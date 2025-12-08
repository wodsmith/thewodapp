"use client"

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

interface QuickActionsEventsProps {
	events: CompetitionWorkout[]
	organizingTeamId: string
}

export function QuickActionsEvents({
	events,
	organizingTeamId,
}: QuickActionsEventsProps) {
	const { execute, isPending } = useServerAction(updateCompetitionWorkoutAction)

	const handleToggleEventStatus = async (
		trackWorkoutId: string,
		currentStatus: string | null,
	) => {
		const newStatus = currentStatus === "published" ? "draft" : "published"
		await execute({
			trackWorkoutId,
			organizingTeamId,
			eventStatus: newStatus,
		})
	}

	if (events.length === 0) {
		return null
	}

	const publishedCount = events.filter(
		(e) => e.eventStatus === "published",
	).length
	const draftCount = events.length - publishedCount

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="text-base">Publish Events</CardTitle>
						<CardDescription>
							{publishedCount} published, {draftCount} draft
						</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{events.map((event) => {
						const isPublished = event.eventStatus === "published"
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
											handleToggleEventStatus(event.id, event.eventStatus)
										}
										disabled={isPending}
									>
										{isPending ? (
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
