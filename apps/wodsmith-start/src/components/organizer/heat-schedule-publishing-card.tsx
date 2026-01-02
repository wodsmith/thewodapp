"use client"

import { Link } from "@tanstack/react-router"
import { Calendar, CheckCircle2, Circle, Globe, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { HeatPublishStatus } from "@/server-fns/competition-heats-fns"
import {
	getHeatPublishStatusFn,
	publishAllHeatsForEventFn,
	publishHeatScheduleFn,
} from "@/server-fns/competition-heats-fns"

interface HeatSchedulePublishingCardProps {
	trackWorkoutId: string
	eventName: string
	competitionId: string
}

/**
 * Format time for display (e.g., "9:00 AM")
 */
function formatTime(date: Date | null): string {
	if (!date) return "No time set"
	return new Date(date).toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	})
}

/**
 * HeatSchedulePublishingCard
 *
 * Displays a card for managing heat schedule visibility.
 * Allows organizers to publish/unpublish individual heats
 * or publish all heats at once.
 */
export function HeatSchedulePublishingCard({
	trackWorkoutId,
	eventName,
	competitionId,
}: HeatSchedulePublishingCardProps) {
	const [statuses, setStatuses] = useState<HeatPublishStatus[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [publishingHeatId, setPublishingHeatId] = useState<string | null>(null)
	const [isPublishingAll, setIsPublishingAll] = useState(false)

	// Fetch heat publish statuses on mount
	useEffect(() => {
		async function fetchStatuses() {
			setIsLoading(true)
			try {
				const result = await getHeatPublishStatusFn({
					data: { trackWorkoutId },
				})
				setStatuses(result.statuses)
			} catch (error) {
				const message =
					error instanceof Error
						? error.message
						: "Failed to fetch heat statuses"
				toast.error(message)
			} finally {
				setIsLoading(false)
			}
		}
		fetchStatuses()
	}, [trackWorkoutId])

	// Handle publishing/unpublishing a single heat
	async function handleToggleHeat(heatId: string, currentlyPublished: boolean) {
		setPublishingHeatId(heatId)
		try {
			const result = await publishHeatScheduleFn({
				data: {
					heatId,
					publish: !currentlyPublished,
				},
			})

			// Update local state
			const publishedAt = result.schedulePublishedAt ?? null
			setStatuses((prev) =>
				prev.map((s) =>
					s.heatId === heatId
						? {
								...s,
								isPublished: publishedAt !== null,
								schedulePublishedAt: publishedAt,
							}
						: s,
				),
			)

			toast.success(
				currentlyPublished
					? "Heat schedule unpublished"
					: "Heat schedule published",
			)
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to update heat status"
			toast.error(message)
		} finally {
			setPublishingHeatId(null)
		}
	}

	// Handle publishing/unpublishing all heats
	async function handlePublishAll(publish: boolean) {
		setIsPublishingAll(true)
		try {
			const result = await publishAllHeatsForEventFn({
				data: {
					trackWorkoutId,
					publish,
				},
			})

			// Update local state
			const publishedAt = result.schedulePublishedAt ?? null
			setStatuses((prev) =>
				prev.map((s) => ({
					...s,
					isPublished: publishedAt !== null,
					schedulePublishedAt: publishedAt,
				})),
			)

			toast.success(
				publish
					? `Published ${result.updatedCount} heat${result.updatedCount !== 1 ? "s" : ""}`
					: `Unpublished ${result.updatedCount} heat${result.updatedCount !== 1 ? "s" : ""}`,
			)
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to update heat statuses"
			toast.error(message)
		} finally {
			setIsPublishingAll(false)
		}
	}

	// Calculate counts
	const publishedCount = statuses.filter((s) => s.isPublished).length
	const unpublishedCount = statuses.length - publishedCount
	const allPublished = statuses.length > 0 && unpublishedCount === 0
	const allUnpublished = publishedCount === 0

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-lg">
						<Globe className="h-5 w-5" />
						Heat Schedule Publishing
					</CardTitle>
				</CardHeader>
				<CardContent className="flex items-center justify-center py-8">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</CardContent>
			</Card>
		)
	}

	if (statuses.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-lg">
						<Globe className="h-5 w-5" />
						Heat Schedule Publishing
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col items-center gap-4 py-6">
					<p className="text-sm text-muted-foreground text-center">
						No heats scheduled for this event yet.
					</p>
					<Button asChild variant="outline" size="sm">
						<Link
							to="/compete/organizer/$competitionId/schedule"
							params={{ competitionId }}
						>
							<Calendar className="h-4 w-4 mr-2" />
							Go to Schedule
						</Link>
					</Button>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2 text-lg">
						<Globe className="h-5 w-5" />
						Heat Schedule Publishing
					</CardTitle>
					<div className="flex items-center gap-2">
						<Badge
							variant={allPublished ? "default" : "outline"}
							className="text-xs tabular-nums"
						>
							{publishedCount}/{statuses.length} published
						</Badge>
					</div>
				</div>
				<p className="text-sm text-muted-foreground mt-1">
					Control which heats are visible to athletes for {eventName}
				</p>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Bulk Actions */}
				<div className="flex gap-2">
					<Button
						variant={allPublished ? "outline" : "default"}
						size="sm"
						onClick={() => handlePublishAll(true)}
						disabled={isPublishingAll || allPublished}
					>
						{isPublishingAll ? (
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						) : (
							<CheckCircle2 className="h-4 w-4 mr-2" />
						)}
						Publish All Heats
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => handlePublishAll(false)}
						disabled={isPublishingAll || allUnpublished}
					>
						{isPublishingAll ? (
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						) : (
							<Circle className="h-4 w-4 mr-2" />
						)}
						Unpublish All
					</Button>
				</div>

				{/* Heat List */}
				<div className="border rounded-md divide-y">
					{statuses.map((status) => {
						const isToggling = publishingHeatId === status.heatId
						return (
							<div
								key={status.heatId}
								className="flex items-center justify-between px-4 py-3"
							>
								<div className="flex items-center gap-3">
									{status.isPublished ? (
										<CheckCircle2 className="h-5 w-5 text-green-600" />
									) : (
										<Circle className="h-5 w-5 text-muted-foreground" />
									)}
									<div>
										<span className="font-medium tabular-nums">
											Heat {status.heatNumber}
										</span>
										{status.scheduledTime && (
											<span className="text-sm text-muted-foreground ml-2">
												{formatTime(status.scheduledTime)}
											</span>
										)}
									</div>
								</div>
								<Button
									variant={status.isPublished ? "outline" : "default"}
									size="sm"
									onClick={() =>
										handleToggleHeat(status.heatId, status.isPublished)
									}
									disabled={isToggling}
								>
									{isToggling ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : status.isPublished ? (
										"Unpublish"
									) : (
										"Publish"
									)}
								</Button>
							</div>
						)
					})}
				</div>

				{/* Help Text */}
				<p className="text-xs text-muted-foreground">
					Published heats are visible to athletes on the competition schedule.
					Unpublished heats remain hidden.
				</p>
			</CardContent>
		</Card>
	)
}
