import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
	Check,
	ChevronDown,
	ChevronRight,
	Eye,
	EyeOff,
	Loader2,
	Trophy,
} from "lucide-react"
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
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import type { AllEventsResultsStatusResponse } from "@/server-fns/division-results-fns"
import {
	publishAllDivisionResultsFn,
	publishDivisionResultsFn,
} from "@/server-fns/division-results-fns"

interface QuickActionsDivisionResultsProps {
	competitionId: string
	organizingTeamId: string
	divisionResults: AllEventsResultsStatusResponse
}

export function QuickActionsDivisionResults({
	competitionId,
	organizingTeamId,
	divisionResults,
}: QuickActionsDivisionResultsProps) {
	const router = useRouter()
	// Track pending state per event+division combination
	const [pendingDivisions, setPendingDivisions] = useState<Set<string>>(
		new Set(),
	)
	// Track bulk updating state per event
	const [bulkUpdatingEvents, setBulkUpdatingEvents] = useState<Set<string>>(
		new Set(),
	)
	// Track expanded state per event
	const [expandedEvents, setExpandedEvents] = useState<Set<string>>(
		// Expand first event by default, or all events if only a few
		new Set(
			divisionResults.events.length <= 3
				? divisionResults.events.map((e) => e.eventId)
				: divisionResults.events.slice(0, 1).map((e) => e.eventId),
		),
	)

	// Wrap server functions with useServerFn for client-side calls
	const publishDivisionResults = useServerFn(publishDivisionResultsFn)
	const publishAllDivisionResults = useServerFn(publishAllDivisionResultsFn)

	// Create a unique key for event+division combination
	const getDivisionKey = (eventId: string, divisionId: string) =>
		`${eventId}:${divisionId}`

	const handleToggleDivisionResults = async (
		eventId: string,
		divisionId: string,
		publish: boolean,
	) => {
		const key = getDivisionKey(eventId, divisionId)
		setPendingDivisions((prev) => new Set(prev).add(key))
		try {
			await publishDivisionResults({
				data: {
					competitionId,
					organizingTeamId,
					eventId,
					divisionId,
					publish,
				},
			})
			toast.success(
				publish ? "Division results published" : "Division results unpublished",
			)
			await router.invalidate()
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to update results",
			)
		} finally {
			setPendingDivisions((prev) => {
				const next = new Set(prev)
				next.delete(key)
				return next
			})
		}
	}

	const handlePublishAllForEvent = async (
		eventId: string,
		publish: boolean,
	) => {
		setBulkUpdatingEvents((prev) => new Set(prev).add(eventId))
		try {
			const result = await publishAllDivisionResults({
				data: {
					competitionId,
					organizingTeamId,
					eventId,
					publish,
				},
			})
			toast.success(
				publish
					? `Published results for ${result.updatedCount} divisions`
					: `Unpublished results for ${result.updatedCount} divisions`,
			)
			await router.invalidate()
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to update all divisions",
			)
		} finally {
			setBulkUpdatingEvents((prev) => {
				const next = new Set(prev)
				next.delete(eventId)
				return next
			})
		}
	}

	const toggleEventExpanded = (eventId: string) => {
		setExpandedEvents((prev) => {
			const next = new Set(prev)
			if (next.has(eventId)) {
				next.delete(eventId)
			} else {
				next.add(eventId)
			}
			return next
		})
	}

	if (
		divisionResults.events.length === 0 ||
		divisionResults.totalCombinations === 0
	) {
		return null
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Trophy className="h-4 w-4 text-muted-foreground" />
						<div>
							<CardTitle className="text-base">Division Results</CardTitle>
							<CardDescription>
								{divisionResults.totalPublishedCount} of{" "}
								{divisionResults.totalCombinations} published
							</CardDescription>
						</div>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					{divisionResults.events.map((event) => {
						const isExpanded = expandedEvents.has(event.eventId)
						const isBulkUpdating = bulkUpdatingEvents.has(event.eventId)
						const allPublished = event.publishedCount === event.totalCount
						// Check if any division has scores to publish
						const eventHasAnyScores = event.divisions.some(
							(d) => d.scoredCount > 0,
						)

						return (
							<Collapsible
								key={event.eventId}
								open={isExpanded}
								onOpenChange={() => toggleEventExpanded(event.eventId)}
							>
								<div className="rounded-lg border">
									{/* Event Header */}
									<div className="flex items-center justify-between p-3 bg-muted/30">
										<CollapsibleTrigger asChild>
											<button
												type="button"
												className="flex items-center gap-2 text-left hover:text-primary transition-colors"
											>
												{isExpanded ? (
													<ChevronDown className="h-4 w-4" />
												) : (
													<ChevronRight className="h-4 w-4" />
												)}
												<span className="font-medium text-sm">
													{event.eventName}
												</span>
												<Badge variant="secondary" className="text-xs">
													{event.publishedCount}/{event.totalCount}
												</Badge>
											</button>
										</CollapsibleTrigger>

										<div className="flex gap-1.5">
											{!allPublished && eventHasAnyScores && (
												<Button
													size="sm"
													variant="default"
													className="h-7 text-xs"
													onClick={(e) => {
														e.stopPropagation()
														handlePublishAllForEvent(event.eventId, true)
													}}
													disabled={isBulkUpdating}
												>
													{isBulkUpdating ? (
														<Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
													) : (
														<Eye className="h-3.5 w-3.5 mr-1" />
													)}
													Publish All
												</Button>
											)}
											{event.publishedCount > 0 && (
												<Button
													size="sm"
													variant="outline"
													className="h-7 text-xs"
													onClick={(e) => {
														e.stopPropagation()
														handlePublishAllForEvent(event.eventId, false)
													}}
													disabled={isBulkUpdating}
												>
													{isBulkUpdating ? (
														<Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
													) : (
														<EyeOff className="h-3.5 w-3.5 mr-1" />
													)}
													Unpublish
												</Button>
											)}
										</div>
									</div>

									{/* Divisions List */}
									<CollapsibleContent>
										<div className="p-3 pt-0 space-y-1">
											{event.divisions.map((division) => {
												const key = getDivisionKey(
													event.eventId,
													division.divisionId,
												)
												const isPending = pendingDivisions.has(key)
												const isComplete =
													division.scoredCount === division.registrationCount &&
													division.registrationCount > 0
												// Disable if no scores to publish
												const hasNoScores = division.scoredCount === 0
												const isDisabled =
													isPending || isBulkUpdating || hasNoScores

												return (
													<div
														key={division.divisionId}
														className={`flex items-center justify-between gap-2 py-2 border-b last:border-0 ${hasNoScores ? "opacity-50" : ""}`}
													>
														<div className="flex items-center gap-2 min-w-0">
															<span className="font-medium text-sm truncate">
																{division.label}
															</span>
															<Badge
																variant="secondary"
																className="text-xs shrink-0"
															>
																{division.scoredCount}/
																{division.registrationCount} scored
															</Badge>
															{hasNoScores && (
																<Badge
																	variant="outline"
																	className="text-xs shrink-0"
																>
																	No scores
																</Badge>
															)}
															{isComplete && (
																<Badge className="text-xs shrink-0 border-green-500/50 bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">
																	<Check className="h-3 w-3 mr-1" />
																	Complete
																</Badge>
															)}
														</div>

														<div className="flex items-center gap-2 shrink-0">
															<Select
																value={
																	division.isPublished ? "published" : "draft"
																}
																onValueChange={(value) =>
																	handleToggleDivisionResults(
																		event.eventId,
																		division.divisionId,
																		value === "published",
																	)
																}
																disabled={isDisabled}
															>
																<SelectTrigger className="w-[120px] h-8 text-xs">
																	<SelectValue>
																		{isPending ? (
																			<span className="flex items-center gap-1.5">
																				<Loader2 className="h-3.5 w-3.5 animate-spin" />
																				Updating...
																			</span>
																		) : (
																			<span className="flex items-center gap-1.5">
																				{division.isPublished ? (
																					<Eye className="h-3.5 w-3.5 text-green-600" />
																				) : (
																					<EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
																				)}
																				{division.isPublished
																					? "Published"
																					: "Draft"}
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
														</div>
													</div>
												)
											})}
										</div>
									</CollapsibleContent>
								</div>
							</Collapsible>
						)
					})}
				</div>

				{divisionResults.events.length > 0 && (
					<div className="mt-4 pt-4 border-t">
						<p className="text-xs text-muted-foreground">
							Published divisions show results on the public leaderboard. Draft
							divisions are hidden from athletes. Results are published per
							event, allowing you to release results as each event completes.
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
