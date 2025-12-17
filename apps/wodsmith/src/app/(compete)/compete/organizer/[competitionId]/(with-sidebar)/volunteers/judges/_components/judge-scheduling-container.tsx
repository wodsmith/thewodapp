"use client"

import { useMemo, useState } from "react"

import { Card, CardContent } from "@/components/ui/card"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { CompetitionJudgeRotation } from "@/db/schema"
import type { HeatWithAssignments } from "@/server/competition-heats"
import type { CompetitionWorkout } from "@/server/competition-workouts"
import { calculateCoverage } from "@/server/judge-rotations"
import type {
	JudgeHeatAssignment,
	JudgeVolunteerInfo,
} from "@/server/judge-scheduling"

import { DraggableJudge } from "./draggable-judge"
import { JudgeHeatCard } from "./judge-heat-card"
import { JudgeOverview } from "./judge-overview"
import { RotationOverview } from "./rotation-overview"
import { RotationTimeline } from "./rotation-timeline"

interface JudgeSchedulingContainerProps {
	competitionId: string
	organizingTeamId: string
	events: CompetitionWorkout[]
	heats: HeatWithAssignments[]
	judges: JudgeVolunteerInfo[]
	judgeAssignments: JudgeHeatAssignment[]
	rotations: CompetitionJudgeRotation[]
}

/**
 * Main container for judge scheduling.
 * Shows event selector, overview, available judges panel, and heat cards.
 */
export function JudgeSchedulingContainer({
	competitionId,
	organizingTeamId,
	events,
	heats,
	judges,
	judgeAssignments: initialAssignments,
	rotations: initialRotations,
}: JudgeSchedulingContainerProps) {
	const [selectedEventId, setSelectedEventId] = useState<string>(
		events[0]?.id ?? "",
	)
	const [assignments, setAssignments] =
		useState<JudgeHeatAssignment[]>(initialAssignments)
	const [selectedJudgeIds, setSelectedJudgeIds] = useState<Set<string>>(
		new Set(),
	)

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

	// Get rotations for selected event
	const eventRotations = useMemo(
		() => initialRotations.filter((r) => r.trackWorkoutId === selectedEventId),
		[initialRotations, selectedEventId],
	)

	// Get selected event details
	const selectedEvent = useMemo(
		() => events.find((e) => e.id === selectedEventId),
		[events, selectedEventId],
	)

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

		const heatsData = eventHeats.map((h) => ({
			heatNumber: h.heatNumber,
			laneCount: h.venue?.laneCount ?? maxLanes,
		}))

		return calculateCoverage(eventRotations, heatsData)
	}, [eventRotations, eventHeats, maxLanes])

	// Handle multi-select toggle
	function handleToggleSelect(membershipId: string, shiftKey: boolean) {
		setSelectedJudgeIds((prev) => {
			const next = new Set(prev)
			if (shiftKey && prev.size > 0) {
				// Range select - find indices
				const sortedJudges = unassignedJudges
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
		sourceHeatId: string,
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
			<div className="text-center py-12">
				<p className="text-muted-foreground">
					No events have been added to this competition yet.
				</p>
				<p className="text-sm text-muted-foreground mt-2">
					Add events in the Programming section before scheduling judges.
				</p>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			{/* Header with event selector */}
			<div className="flex items-center justify-between gap-4">
				<div>
					<h2 className="text-xl font-semibold">Judge Scheduling</h2>
					<p className="text-muted-foreground text-sm">
						Manage judge assignments with manual or rotation-based scheduling
					</p>
				</div>
				<Select value={selectedEventId} onValueChange={setSelectedEventId}>
					<SelectTrigger className="w-64">
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

			{/* Tabs for Manual vs Rotation View */}
			<Tabs defaultValue="manual" className="w-full">
				<TabsList className="grid w-full max-w-md grid-cols-2">
					<TabsTrigger value="manual">Manual Assignment</TabsTrigger>
					<TabsTrigger value="rotations">Rotations</TabsTrigger>
				</TabsList>

				{/* Manual Assignment Tab */}
				<TabsContent value="manual" className="space-y-6">
					{/* Overview */}
					<JudgeOverview
						events={events}
						heats={heats}
						judgeAssignments={assignments}
					/>

			{/* Main content: judges panel + heats */}
			<div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
				{/* Available Judges Panel */}
				<Card className="lg:sticky lg:top-4 lg:self-start">
					<CardContent className="p-4">
						<div className="flex items-center justify-between mb-3">
							<h3 className="font-medium text-sm">Available Judges</h3>
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
						{unassignedJudges.length === 0 ? (
							<p className="text-sm text-muted-foreground py-4 text-center">
								All judges assigned
							</p>
						) : (
							<div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
								{unassignedJudges.map((judge) => (
									<DraggableJudge
										key={judge.membershipId}
										volunteer={judge}
										isSelected={selectedJudgeIds.has(judge.membershipId)}
										onToggleSelect={handleToggleSelect}
										selectedIds={selectedJudgeIds}
									/>
								))}
							</div>
						)}
						{judges.length === 0 && (
							<p className="text-sm text-muted-foreground py-4 text-center">
								No judges have been added yet. Add volunteers with the Judge
								role type in the Volunteers tab.
							</p>
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
								<p className="text-sm text-muted-foreground mt-2">
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
									console.debug("Heat deletion is handled in Schedule section")
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
				</TabsContent>

				{/* Rotations Tab */}
				<TabsContent value="rotations" className="space-y-6">
					{/* Rotation Overview */}
					<RotationOverview
						rotations={eventRotations}
						coverage={rotationCoverage}
						eventName={selectedEvent?.workout.name ?? "Event"}
					/>

					{/* Rotation Timeline */}
					{eventHeats.length > 0 ? (
						<RotationTimeline
							competitionId={competitionId}
							teamId={organizingTeamId}
							trackWorkoutId={selectedEventId}
							eventName={selectedEvent?.workout.name ?? "Event"}
							heatsCount={eventHeats.length}
							laneCount={maxLanes}
							availableJudges={judges}
							initialRotations={eventRotations}
						/>
					) : (
						<Card>
							<CardContent className="py-8 text-center">
								<p className="text-muted-foreground">
									No heats scheduled for this event yet.
								</p>
								<p className="text-sm text-muted-foreground mt-2">
									Create heats in the Schedule section before creating rotations.
								</p>
							</CardContent>
						</Card>
					)}
				</TabsContent>
			</Tabs>
		</div>
	)
}
