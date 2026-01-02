"use client"

import { Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ClipboardList, Eye, EyeOff, Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
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
import {
	updateCompetitionWorkoutFn,
	type CompetitionWorkout,
} from "@/server-fns/competition-workouts-fns"

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
	const router = useRouter()
	const updateCompetitionWorkout = useServerFn(updateCompetitionWorkoutFn)
	const [pendingEvents, setPendingEvents] = useState<Set<string>>(new Set())
	const [isPublishingAll, setIsPublishingAll] = useState(false)

	const handleToggleEventStatus = async (
		trackWorkoutId: string,
		newStatus: "draft" | "published",
	) => {
		setPendingEvents((prev) => new Set(prev).add(trackWorkoutId))
		try {
			await updateCompetitionWorkout({
				data: {
					trackWorkoutId,
					teamId: organizingTeamId,
					eventStatus: newStatus,
				},
			})
			await router.invalidate()
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to update event")
		} finally {
			setPendingEvents((prev) => {
				const next = new Set(prev)
				next.delete(trackWorkoutId)
				return next
			})
		}
	}

	const handlePublishAll = async () => {
		const draftEvents = events.filter((e) => e.eventStatus !== "published")
		if (draftEvents.length === 0) return

		setIsPublishingAll(true)
		try {
			for (const event of draftEvents) {
				await updateCompetitionWorkout({
					data: {
						trackWorkoutId: event.id,
						teamId: organizingTeamId,
						eventStatus: "published",
					},
				})
			}
			toast.success(`Published ${draftEvents.length} event(s)`)
			await router.invalidate()
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to publish all events",
			)
		} finally {
			setIsPublishingAll(false)
		}
	}

	if (events.length === 0) {
		return null
	}

	const publishedCount = events.filter(
		(e) => e.eventStatus === "published",
	).length
	const draftCount = events.length - publishedCount
	const hasUnpublishedEvents = draftCount > 0

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
					{hasUnpublishedEvents && (
						<Button
							variant="outline"
							size="sm"
							onClick={handlePublishAll}
							disabled={isPublishingAll}
						>
							{isPublishingAll ? (
								<>
									<Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
									Publishing...
								</>
							) : (
								<>
									<Eye className="h-3.5 w-3.5 mr-1.5" />
									Publish All
								</>
							)}
						</Button>
					)}
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{events.map((event) => {
						const isPublished = event.eventStatus === "published"
						const isPending = pendingEvents.has(event.id)
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
											handleToggleEventStatus(
												event.id,
												value as "draft" | "published",
											)
										}
										disabled={isPending || isPublishingAll}
									>
										<SelectTrigger className="w-[110px] h-7 text-xs">
											<SelectValue>
												{isPending ? (
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
											to="/compete/organizer/$competitionId/results"
											params={{ competitionId }}
											search={{ event: event.id }}
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
