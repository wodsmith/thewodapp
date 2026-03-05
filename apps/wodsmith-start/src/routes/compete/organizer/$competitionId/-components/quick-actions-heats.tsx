"use client"

import { Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Calendar, ClipboardList, Eye, EyeOff, Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import type { HeatWithAssignments } from "@/server-fns/competition-heats-fns"
import type { CompetitionWorkout } from "@/server-fns/competition-workouts-fns"
import { updateCompetitionWorkoutFn } from "@/server-fns/competition-workouts-fns"

interface QuickActionsHeatsProps {
	events: CompetitionWorkout[]
	heats: HeatWithAssignments[]
	organizingTeamId: string
	competitionSlug: string
}

export function QuickActionsHeats({
	events,
	heats,
	organizingTeamId,
	competitionSlug,
}: QuickActionsHeatsProps) {
	const router = useRouter()
	const updateCompetitionWorkout = useServerFn(updateCompetitionWorkoutFn)
	const [pendingEvents, setPendingEvents] = useState<Set<string>>(new Set())

	const handleHeatStatusChange = async (
		trackWorkoutId: string,
		newStatus: string,
	) => {
		setPendingEvents((prev) => new Set(prev).add(trackWorkoutId))
		try {
			await updateCompetitionWorkout({
				data: {
					trackWorkoutId,
					teamId: organizingTeamId,
					heatStatus: newStatus as "draft" | "published",
				},
			})
			await router.invalidate()
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to update heat status",
			)
		} finally {
			setPendingEvents((prev) => {
				const next = new Set(prev)
				next.delete(trackWorkoutId)
				return next
			})
		}
	}

	// Count events with heats for the summary
	const eventsWithHeats = events.filter((event) => {
		const eventHeats = heats.filter(
			(h) => h.trackWorkoutId === event.id && h.scheduledTime,
		)
		return eventHeats.length > 0
	})

	const publishedCount = eventsWithHeats.filter(
		(e) => e.heatStatus === "published",
	).length

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Calendar className="h-4 w-4 text-muted-foreground" />
						<div>
							<CardTitle className="text-base">Heat Schedules</CardTitle>
							<CardDescription>
								Control when athletes can see their heat assignments
							</CardDescription>
						</div>
					</div>
					{eventsWithHeats.length > 0 && (
						<Badge variant="secondary" className="text-xs">
							{publishedCount}/{eventsWithHeats.length} published
						</Badge>
					)}
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{events.map((event) => {
						const isPublished = event.heatStatus === "published"
						const eventHeats = heats.filter(
							(h) => h.trackWorkoutId === event.id && h.scheduledTime,
						)
						const hasHeats = eventHeats.length > 0
						const isDisabled = pendingEvents.has(event.id) || !hasHeats

						return (
							<div
								key={event.id}
								className={`flex items-center justify-between gap-2 py-1.5 border-b last:border-0 ${!hasHeats ? "opacity-50" : ""}`}
							>
								<div className="flex items-center gap-2 min-w-0">
									<span className="text-xs text-muted-foreground w-5 text-right tabular-nums">
										{event.trackOrder}
									</span>
									<span className="text-sm truncate">{event.workout.name}</span>
									{hasHeats ? (
										<span className="text-xs text-muted-foreground">
											({eventHeats.length} heat
											{eventHeats.length !== 1 ? "s" : ""})
										</span>
									) : (
										<Badge variant="outline" className="text-xs">
											No heats
										</Badge>
									)}
								</div>
								<Select
									value={event.heatStatus ?? "draft"}
									onValueChange={(value) =>
										handleHeatStatusChange(event.id, value)
									}
									disabled={isDisabled}
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

				{/* Link to Judges Schedule */}
				{heats.length > 0 && (
					<div className="mt-4 pt-4 border-t">
						<Button variant="outline" size="sm" asChild className="w-full">
							<Link
								to="/compete/$slug/judges-schedule"
								params={{ slug: competitionSlug }}
							>
								<ClipboardList className="mr-2 h-4 w-4" />
								View Judges Schedule
							</Link>
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
