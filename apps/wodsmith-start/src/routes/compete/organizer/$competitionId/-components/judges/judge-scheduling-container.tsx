"use client"

import { Link } from "@tanstack/react-router"
import { ClipboardList, FileWarning } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import type {
	CompetitionJudgeRotation,
	JudgeAssignmentVersion,
} from "@/db/schema"
import type { LaneShiftPattern } from "@/db/schemas/volunteers"
import { calculateCoverage } from "@/lib/judge-rotation-utils"
import type { HeatWithAssignments } from "@/server-fns/competition-heats-fns"
import type { CompetitionWorkout } from "@/server-fns/competition-workouts-fns"
import {
	getAssignmentsForVersionFn,
	rollbackToVersionFn,
} from "@/server-fns/judge-assignment-fns"
import type {
	JudgeHeatAssignment,
	JudgeVolunteerInfo,
} from "@/server-fns/judge-scheduling-fns"

import { DraggableJudge } from "./draggable-judge"
import { EventDefaultsEditor } from "./event-defaults-editor"
import { JudgeHeatCard } from "./judge-heat-card"
import { JudgeOverview } from "./judge-overview"
import { RotationOverview } from "./rotation-overview"
import { RotationTimeline } from "./rotation-timeline"

/** Per-event defaults for judge rotations */
interface EventDefaults {
	defaultHeatsCount: number | null
	defaultLaneShiftPattern: LaneShiftPattern | null
	minHeatBuffer: number | null
}

interface JudgeSchedulingContainerProps {
	competitionId: string
	competitionSlug: string
	organizingTeamId: string
	competitionType: "in-person" | "online"
	events: CompetitionWorkout[]
	heats: HeatWithAssignments[]
	judges: JudgeVolunteerInfo[]
	judgeAssignments: JudgeHeatAssignment[]
	rotations: CompetitionJudgeRotation[]
	/** Map of event ID to event defaults */
	eventDefaultsMap: Map<string, EventDefaults>
	/** Map of event ID to version history */
	versionHistoryMap: Map<string, JudgeAssignmentVersion[]>
	/** Map of event ID to active version */
	activeVersionMap: Map<string, JudgeAssignmentVersion | null>
	/** Competition-level default heats per rotation */
	competitionDefaultHeats: number
	/** Competition-level default lane shift pattern */
	competitionDefaultPattern: LaneShiftPattern
	/** Currently selected event ID (from URL) */
	selectedEventId: string
	/** Callback when event selection changes */
	onEventChange: (eventId: string) => void
}

/**
 * Main container for judge scheduling.
 * Shows event selector, overview, available judges panel, and heat cards.
 */
export function JudgeSchedulingContainer({
	competitionId,
	competitionSlug,
	organizingTeamId,
	competitionType,
	events,
	heats,
	judges,
	judgeAssignments: initialAssignments,
	rotations: initialRotations,
	eventDefaultsMap,
	versionHistoryMap,
	activeVersionMap,
	competitionDefaultHeats,
	competitionDefaultPattern,
	selectedEventId,
	onEventChange,
}: JudgeSchedulingContainerProps) {
	const isOnline = competitionType === "online"
	const [assignments, setAssignments] =
		useState<JudgeHeatAssignment[]>(initialAssignments)
	const [selectedJudgeIds, setSelectedJudgeIds] = useState<Set<string>>(
		new Set(),
	)
	const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
		null,
	)
	const [isRollingBack, setIsRollingBack] = useState(false)
	const [isFetchingAssignments, setIsFetchingAssignments] = useState(false)
	const [filterEmptyLanes, setFilterEmptyLanes] = useState(false)

	// Get heats for selected event
	const eventHeats = useMemo(
		() =>
			heats
				.filter((h) => h.trackWorkoutId === selectedEventId)
				.sort((a, b) => a.heatNumber - b.heatNumber),
		[heats, selectedEventId],
	)

	// Get max lanes from venue or default to 10
	const maxLanes = useMemo(() => {
		const venueWithLanes = eventHeats.find((h) => h.venue?.laneCount)
		return venueWithLanes?.venue?.laneCount ?? 10
	}, [eventHeats])

	// Get assigned judge IDs for current event
	const assignedJudgeIds = useMemo(() => {
		const eventHeatIds = new Set(eventHeats.map((h) => h.id))
		return new Set(
			assignments
				.filter((a) => eventHeatIds.has(a.heatId))
				.map((a) => a.membershipId),
		)
	}, [eventHeats, assignments])

	// Get unassigned judges for current event
	const unassignedJudges = useMemo(
		() => judges.filter((j) => !assignedJudgeIds.has(j.membershipId)),
		[judges, assignedJudgeIds],
	)

	// Get all judges sorted by total heat assignment count (ascending - least assigned first)
	const judgesByAssignmentCount = useMemo(() => {
		// Count assignments per judge across ALL heats (not just current event)
		const assignmentCounts = new Map<string, number>()
		for (const judge of judges) {
			assignmentCounts.set(judge.membershipId, 0)
		}
		for (const assignment of assignments) {
			const count = assignmentCounts.get(assignment.membershipId) ?? 0
			assignmentCounts.set(assignment.membershipId, count + 1)
		}

		// Sort judges by assignment count (ascending)
		return [...judges]
			.map((judge) => ({
				...judge,
				assignmentCount: assignmentCounts.get(judge.membershipId) ?? 0,
			}))
			.sort((a, b) => a.assignmentCount - b.assignmentCount)
	}, [judges, assignments])

	// Get rotations for selected event - track locally to update on changes
	const initialEventRotations = useMemo(
		() => initialRotations.filter((r) => r.trackWorkoutId === selectedEventId),
		[initialRotations, selectedEventId],
	)
	const [eventRotations, setEventRotations] = useState(initialEventRotations)

	// Sync when event changes or initial data changes
	useEffect(() => {
		setEventRotations(initialEventRotations)
	}, [initialEventRotations])

	// Get selected event details
	const selectedEvent = useMemo(
		() => events.find((e) => e.id === selectedEventId),
		[events, selectedEventId],
	)

	// Get version data for selected event
	const eventVersionHistory = useMemo(
		() => versionHistoryMap.get(selectedEventId) ?? [],
		[versionHistoryMap, selectedEventId],
	)

	const eventActiveVersion = useMemo(
		() => activeVersionMap.get(selectedEventId) ?? null,
		[activeVersionMap, selectedEventId],
	)

	// Auto-select active version when event changes
	useEffect(() => {
		if (eventActiveVersion) {
			setSelectedVersionId(eventActiveVersion.id)
		} else {
			setSelectedVersionId(null)
		}
	}, [eventActiveVersion])

	// Handle version change
	async function handleVersionChange(versionId: string) {
		if (versionId === eventActiveVersion?.id) {
			// Already active, just update UI
			setSelectedVersionId(versionId)
			return
		}

		// Rollback to different version
		setIsRollingBack(true)
		try {
			const result = await rollbackToVersionFn({
				data: {
					teamId: organizingTeamId,
					versionId,
				},
			})

			if (result) {
				toast.success("Version activated successfully")
				setSelectedVersionId(versionId)

				// Fetch assignments for the new version
				setIsFetchingAssignments(true)
				try {
					const assignmentsResult = await getAssignmentsForVersionFn({
						data: { versionId },
					})
					if (assignmentsResult) {
						setAssignments((prev) => {
							// Remove old assignments for this event, add new ones
							const eventHeatIds = new Set(eventHeats.map((h) => h.id))
							const withoutEvent = prev.filter(
								(a) => !eventHeatIds.has(a.heatId),
							)
							// Type assertion needed because getAssignmentsForVersion returns raw DB structure
							// but JudgeHeatAssignment expects a 'volunteer' property (server-side type mismatch)
							return [
								...withoutEvent,
								...(assignmentsResult as JudgeHeatAssignment[]),
							]
						})
					}
				} finally {
					setIsFetchingAssignments(false)
				}
			}
		} catch (_err) {
			toast.error("Failed to activate version")
		} finally {
			setIsRollingBack(false)
		}
	}

	// Get event defaults for selected event (with fallback to competition defaults)
	const selectedEventDefaults = useMemo(() => {
		const eventDefaults = eventDefaultsMap.get(selectedEventId)
		return {
			defaultHeatsCount:
				eventDefaults?.defaultHeatsCount ?? competitionDefaultHeats,
			defaultLaneShiftPattern:
				eventDefaults?.defaultLaneShiftPattern ?? competitionDefaultPattern,
			minHeatBuffer: eventDefaults?.minHeatBuffer ?? 2,
			// Raw values (null if not overridden at event level)
			rawDefaultHeatsCount: eventDefaults?.defaultHeatsCount ?? null,
			rawDefaultLaneShiftPattern:
				eventDefaults?.defaultLaneShiftPattern ?? null,
			rawMinHeatBuffer: eventDefaults?.minHeatBuffer ?? null,
		}
	}, [
		selectedEventId,
		eventDefaultsMap,
		competitionDefaultHeats,
		competitionDefaultPattern,
	])

	// Compute occupied lanes per heat from athlete assignments
	const occupiedLanesByHeat = useMemo(() => {
		const map = new Map<number, Set<number>>()
		for (const heat of eventHeats) {
			const occupiedLanes = new Set<number>()
			for (const assignment of heat.assignments) {
				occupiedLanes.add(assignment.laneNumber)
			}
			map.set(heat.heatNumber, occupiedLanes)
		}
		return map
	}, [eventHeats])

	// Calculate rotation coverage for selected event
	const rotationCoverage = useMemo(() => {
		if (eventHeats.length === 0) {
			return {
				totalSlots: 0,
				coveredSlots: 0,
				coveragePercent: 0,
				gaps: [],
				overlaps: [],
			}
		}

		const heatsData = eventHeats.map((h) => {
			const base = {
				heatNumber: h.heatNumber,
				laneCount: h.venue?.laneCount ?? maxLanes,
			}
			// Include occupiedLanes if filtering is enabled
			if (filterEmptyLanes) {
				return {
					...base,
					occupiedLanes: occupiedLanesByHeat.get(h.heatNumber),
				}
			}
			return base
		})

		return calculateCoverage(eventRotations, heatsData)
	}, [eventRotations, eventHeats, maxLanes, filterEmptyLanes, occupiedLanesByHeat])

	// Handle multi-select toggle
	function handleToggleSelect(membershipId: string, shiftKey: boolean) {
		setSelectedJudgeIds((prev) => {
			const next = new Set(prev)
			if (shiftKey && prev.size > 0) {
				// Range select - find indices using the sorted list
				const sortedJudges = judgesByAssignmentCount
				const lastSelected = Array.from(prev).pop()
				const lastIndex = sortedJudges.findIndex(
					(j) => j.membershipId === lastSelected,
				)
				const currentIndex = sortedJudges.findIndex(
					(j) => j.membershipId === membershipId,
				)
				if (lastIndex !== -1 && currentIndex !== -1) {
					const start = Math.min(lastIndex, currentIndex)
					const end = Math.max(lastIndex, currentIndex)
					for (let i = start; i <= end; i++) {
						const judge = sortedJudges[i]
						if (judge) {
							next.add(judge.membershipId)
						}
					}
					return next
				}
			}
			// Toggle single
			if (next.has(membershipId)) {
				next.delete(membershipId)
			} else {
				next.add(membershipId)
			}
			return next
		})
	}

	function clearSelection() {
		setSelectedJudgeIds(new Set())
	}

	// Handle assignment changes from heat cards
	function handleAssignmentChange(
		heatId: string,
		newAssignments: JudgeHeatAssignment[],
	) {
		setAssignments((prev) => {
			// Remove old assignments for this heat, add new ones
			const withoutHeat = prev.filter((a) => a.heatId !== heatId)
			return [...withoutHeat, ...newAssignments]
		})
	}

	// Handle cross-heat moves
	function handleMoveAssignment(
		assignmentId: string,
		_sourceHeatId: string,
		targetHeatId: string,
		targetLane: number,
		assignment: JudgeHeatAssignment,
	) {
		setAssignments((prev) => {
			// Remove from source heat
			const withoutSource = prev.filter((a) => a.id !== assignmentId)
			// Add to target heat with updated lane
			const movedAssignment: JudgeHeatAssignment = {
				...assignment,
				heatId: targetHeatId,
				laneNumber: targetLane,
			}
			return [...withoutSource, movedAssignment]
		})
	}

	if (events.length === 0) {
		return (
			<div className="py-12 text-center">
				<p className="text-muted-foreground">
					No events have been added to this competition yet.
				</p>
				<p className="mt-2 text-sm text-muted-foreground">
					Add events in the Programming section before scheduling judges.
				</p>
			</div>
		)
	}

	return (
		<section className="space-y-8">
			{/* Header */}
			<div className="flex items-start justify-between gap-4">
				<div>
					<h2 className="text-xl font-semibold">Judging Schedule</h2>
					<p className="text-sm text-muted-foreground">
						Manage judge assignments with manual or rotation-based scheduling
					</p>
				</div>
				{heats.length > 0 && (
					<Button variant="outline" size="sm" asChild>
						<Link
							to="/compete/$slug/judges-schedule"
							params={{ slug: competitionSlug }}
						>
							<ClipboardList className="mr-2 h-4 w-4" />
							View Printable Schedule
						</Link>
					</Button>
				)}
			</div>

			{/* Event Selector - Prominent placement */}
			<div className="flex items-center gap-3">
				<label htmlFor="event-selector" className="text-sm font-medium">
					Event:
				</label>
				<Select value={selectedEventId} onValueChange={onEventChange}>
					<SelectTrigger id="event-selector" className="w-80">
						<SelectValue placeholder="Select event" />
					</SelectTrigger>
					<SelectContent>
						{events.map((event) => (
							<SelectItem key={event.id} value={event.id}>
								{String(event.trackOrder).padStart(2, "0")} -{" "}
								{event.workout.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Published Assignments Section - Only for in-person competitions */}
			{!isOnline && (
				<section className="space-y-6">
					<h3 className="text-lg font-semibold">Published Assignments</h3>

					{/* Version Selector */}
					{eventVersionHistory.length > 0 && (
						<Card>
							<CardContent className="p-4">
								<div className="flex items-center gap-4">
									<div className="flex-1">
										<label
											htmlFor="version-selector"
											className="mb-1 block text-sm font-medium"
										>
											Assignment Version
										</label>
										<Select
											value={selectedVersionId ?? ""}
											onValueChange={handleVersionChange}
											disabled={isRollingBack || isFetchingAssignments}
										>
											<SelectTrigger id="version-selector" className="w-full">
												<SelectValue placeholder="Select version" />
											</SelectTrigger>
											<SelectContent>
												{eventVersionHistory.map((version) => (
													<SelectItem key={version.id} value={version.id}>
														Version {version.version} - Published{" "}
														{new Date(version.publishedAt).toLocaleDateString()}
														{version.isActive && " (Active)"}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										{selectedVersionId &&
											eventVersionHistory.find(
												(v) => v.id === selectedVersionId,
											)?.notes && (
												<p className="mt-1 text-xs text-muted-foreground">
													{
														eventVersionHistory.find(
															(v) => v.id === selectedVersionId,
														)?.notes
													}
												</p>
											)}
									</div>
								</div>
							</CardContent>
						</Card>
					)}

					{/* Empty State when no version */}
					{!eventActiveVersion && (
						<Card>
							<CardContent className="py-12 text-center">
								<FileWarning className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
								<h4 className="mb-2 text-lg font-semibold">
									No assignments published yet
								</h4>
								<p className="mb-4 text-muted-foreground">
									Create rotations in the Rotations section below, then publish
									them to generate assignments.
								</p>
							</CardContent>
						</Card>
					)}

					{/* Show content when there's an active version */}
					{eventActiveVersion && (
						<>
							{/* Overview */}
							<JudgeOverview
								events={events}
								heats={heats}
								judgeAssignments={assignments}
							/>

							{/* Main content: judges panel + heats */}
							<div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
								{/* Available Judges Panel */}
								<Card className="lg:sticky lg:top-4 lg:self-start">
									<CardContent className="p-4">
										<div className="mb-3 flex items-center justify-between">
											<h4 className="text-sm font-medium">Available Judges</h4>
											{selectedJudgeIds.size > 0 && (
												<button
													type="button"
													onClick={clearSelection}
													className="text-xs text-muted-foreground hover:text-foreground"
												>
													Clear ({selectedJudgeIds.size})
												</button>
											)}
										</div>
										{judges.length === 0 ? (
											<p className="py-4 text-center text-sm text-muted-foreground">
												No judges have been added yet. Add volunteers with the
												Judge role type in the Volunteers section above.
											</p>
										) : (
											<div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
												{judgesByAssignmentCount.map((judge) => (
													<DraggableJudge
														key={judge.membershipId}
														volunteer={judge}
														isSelected={selectedJudgeIds.has(
															judge.membershipId,
														)}
														onToggleSelect={handleToggleSelect}
														selectedIds={selectedJudgeIds}
														assignmentCount={judge.assignmentCount}
														isAssignedToCurrentEvent={assignedJudgeIds.has(
															judge.membershipId,
														)}
													/>
												))}
											</div>
										)}
									</CardContent>
								</Card>

								{/* Heats Grid */}
								<div className="space-y-4">
									{eventHeats.length === 0 ? (
										<Card>
											<CardContent className="py-8 text-center">
												<p className="text-muted-foreground">
													No heats scheduled for this event yet.
												</p>
												<p className="mt-2 text-sm text-muted-foreground">
													Create heats in the Schedule section first.
												</p>
											</CardContent>
										</Card>
									) : (
										eventHeats.map((heat) => (
											<JudgeHeatCard
												key={heat.id}
												heat={heat}
												competitionId={competitionId}
												organizingTeamId={organizingTeamId}
												unassignedVolunteers={unassignedJudges}
												judgeAssignments={assignments.filter(
													(a) => a.heatId === heat.id,
												)}
												maxLanes={maxLanes}
												onDelete={() => {
													// No-op: Heat deletion should be done in Schedule section
													console.debug(
														"Heat deletion is handled in Schedule section",
													)
												}}
												onAssignmentChange={(newAssignments) =>
													handleAssignmentChange(heat.id, newAssignments)
												}
												onMoveAssignment={handleMoveAssignment}
												selectedJudgeIds={selectedJudgeIds}
												onClearSelection={clearSelection}
											/>
										))
									)}
								</div>
							</div>
						</>
					)}
				</section>
			)}

			{/* Rotations Section - Only for in-person competitions */}
			{!isOnline && (
				<section className="space-y-6">
					<h3 className="text-lg font-semibold">Rotations</h3>

					{/* Event Defaults Editor */}
					<EventDefaultsEditor
						teamId={organizingTeamId}
						competitionId={competitionId}
						trackWorkoutId={selectedEventId}
						defaultHeatsCount={selectedEventDefaults.rawDefaultHeatsCount}
						defaultLaneShiftPattern={
							selectedEventDefaults.rawDefaultLaneShiftPattern
						}
						minHeatBuffer={selectedEventDefaults.rawMinHeatBuffer}
						competitionDefaultHeats={competitionDefaultHeats}
						competitionDefaultPattern={competitionDefaultPattern}
					/>

					{/* Rotation Overview */}
					<RotationOverview
						rotations={eventRotations}
						coverage={rotationCoverage}
						eventName={selectedEvent?.workout.name ?? "Event"}
						teamId={organizingTeamId}
						trackWorkoutId={selectedEventId}
						hasActiveVersion={!!eventActiveVersion}
						nextVersionNumber={
							eventVersionHistory.length > 0
								? (eventVersionHistory[0]?.version ?? 0) + 1
								: 1
						}
					/>

					{/* Rotation Timeline */}
					{eventHeats.length > 0 ? (
						<RotationTimeline
							key={selectedEventId}
							competitionId={competitionId}
							teamId={organizingTeamId}
							trackWorkoutId={selectedEventId}
							eventName={selectedEvent?.workout.name ?? "Event"}
							heatsWithAssignments={eventHeats}
							laneCount={maxLanes}
							availableJudges={judges}
							initialRotations={eventRotations}
							eventLaneShiftPattern={
								selectedEventDefaults.defaultLaneShiftPattern
							}
							eventDefaultHeatsCount={selectedEventDefaults.defaultHeatsCount}
							minHeatBuffer={selectedEventDefaults.minHeatBuffer}
							filterEmptyLanes={filterEmptyLanes}
							onFilterEmptyLanesChange={setFilterEmptyLanes}
							onRotationsChange={setEventRotations}
						/>
					) : (
						<Card>
							<CardContent className="py-8 text-center">
								<p className="text-muted-foreground">
									No heats scheduled for this event yet.
								</p>
								<p className="mt-2 text-sm text-muted-foreground">
									Create heats in the Schedule section before creating
									rotations.
								</p>
							</CardContent>
						</Card>
					)}
				</section>
			)}
		</section>
	)
}
