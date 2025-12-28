"use client"

import { useServerAction } from "@repo/zsa-react"
import { ClipboardList, Eye, EyeOff, Loader2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { updateCompetitionWorkoutAction } from "@/actions/competition-actions"
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
import type { CompetitionWorkout } from "@/server/competition-workouts"

interface QuickActionsEventsProps {
	events: CompetitionWorkout[]
	organizingTeamId: string
	competitionId: string
}

export function QuickActionsEvents({
	events,
	organizingTeamId,
	competitionId,
}: QuickActionsEventsProps) {
	const { execute } = useServerAction(updateCompetitionWorkoutAction)
	const [pendingEvents, setPendingEvents] = useState<Set<string>>(new Set())

	const handleToggleEventStatus = async (
		trackWorkoutId: string,
		newStatus: string,
	) => {
		setPendingEvents((prev) => new Set(prev).add(trackWorkoutId))
		await execute({
			trackWorkoutId,
			organizingTeamId,
			eventStatus: newStatus as "draft" | "published",
		})
		setPendingEvents((prev) => {
			const next = new Set(prev)
			next.delete(trackWorkoutId)
			return next
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
									<Select
										value={event.eventStatus ?? "draft"}
										onValueChange={(value) =>
											handleToggleEventStatus(event.id, value)
										}
										disabled={pendingEvents.has(event.id)}
									>
										<SelectTrigger className="w-[110px] h-7 text-xs">
											<SelectValue>
												{pendingEvents.has(event.id) ? (
													<span className="flex items-center gap-1.5">
														<Loader2 className="h-3.5 w-3.5 animate-spin" />
														Loading...
													</span>
												) : (
													<span className="flex items-center gap-1.5">
														{isPublished ? (
															<Eye className="h-3.5 w-3.5 text-green-600" />
														) : (
															<EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
														)}
														{isPublished ? "Published" : "Draft"}
													</span>
												)}
											</SelectValue>
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
									<Button
										variant="ghost"
										size="sm"
										className="h-7 w-7 p-0"
										asChild
									>
										<Link
											href={`/compete/organizer/${competitionId}/results?event=${event.id}`}
										>
											<ClipboardList className="h-3.5 w-3.5" />
											<span className="sr-only">View results</span>
										</Link>
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
