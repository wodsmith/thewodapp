"use client"

import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { useServerAction } from "@repo/zsa-react"
import { Plus } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	deleteJudgeRotationAction,
	getEventRotationsAction,
} from "@/actions/judge-rotation-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { CompetitionJudgeRotation } from "@/db/schema"
import {
	type CoverageStats,
	calculateCoverage,
	expandRotationToAssignments,
} from "@/server/judge-rotations"
import type { JudgeVolunteerInfo } from "@/server/judge-scheduling"
import { RotationBlock } from "./rotation-block"
import { RotationEditor } from "./rotation-editor"

interface RotationTimelineProps {
	competitionId: string
	teamId: string
	trackWorkoutId: string
	eventName: string
	heatsCount: number
	laneCount: number
	availableJudges: JudgeVolunteerInfo[]
	initialRotations: CompetitionJudgeRotation[]
}

/**
 * Gantt-style timeline for judge rotations.
 * Grid: Y-axis = Lanes (1-N), X-axis = Heats (1-M).
 * Shows rotation blocks as colored segments spanning multiple heats.
 * Gaps highlighted, overlaps shown differently.
 */
export function RotationTimeline({
	competitionId,
	teamId,
	trackWorkoutId,
	eventName,
	heatsCount,
	laneCount,
	availableJudges,
	initialRotations,
}: RotationTimelineProps) {
	const [rotations, setRotations] =
		useState<CompetitionJudgeRotation[]>(initialRotations)
	const [isEditorOpen, setIsEditorOpen] = useState(false)
	const [editingRotation, setEditingRotation] =
		useState<CompetitionJudgeRotation | null>(null)

	const getRotations = useServerAction(getEventRotationsAction)
	const deleteRotation = useServerAction(deleteJudgeRotationAction)

	// Build heats array for coverage calculation
	const heats = useMemo(
		() =>
			Array.from({ length: heatsCount }, (_, i) => ({
				heatNumber: i + 1,
				laneCount,
			})),
		[heatsCount, laneCount],
	)

	// Calculate coverage
	const coverage: CoverageStats = useMemo(
		() => calculateCoverage(rotations, heats),
		[rotations, heats],
	)

	// Build coverage grid for visual display
	const coverageGrid = useMemo(() => {
		const grid = new Map<string, "empty" | "covered" | "overlap">()

		// Initialize all slots as empty
		for (let heat = 1; heat <= heatsCount; heat++) {
			for (let lane = 1; lane <= laneCount; lane++) {
				grid.set(`${heat}:${lane}`, "empty")
			}
		}

		// Mark covered slots
		for (const rotation of rotations) {
			const assignments = expandRotationToAssignments(rotation, heats)
			for (const assignment of assignments) {
				const key = `${assignment.heatNumber}:${assignment.laneNumber}`
				const current = grid.get(key)
				if (current === "covered") {
					grid.set(key, "overlap")
				} else {
					grid.set(key, "covered")
				}
			}
		}

		return grid
	}, [rotations, heats, heatsCount, laneCount])

	// Get judge name by membershipId
	const getJudgeName = useCallback(
		(membershipId: string) => {
			const judge = availableJudges.find((j) => j.membershipId === membershipId)
			if (!judge) return "Unknown Judge"
			return `${judge.firstName ?? ""} ${judge.lastName ?? ""}`.trim() || "Unknown"
		},
		[availableJudges],
	)

	async function refreshRotations() {
		const [result] = await getRotations.execute({ trackWorkoutId })
		if (result?.data) {
			setRotations(result.data)
		}
	}

	function handleCreateRotation() {
		setEditingRotation(null)
		setIsEditorOpen(true)
	}

	function handleEditRotation(rotation: CompetitionJudgeRotation) {
		setEditingRotation(rotation)
		setIsEditorOpen(true)
	}

	async function handleDeleteRotation(rotationId: string) {
		const [, error] = await deleteRotation.execute({ teamId, rotationId })
		if (!error) {
			await refreshRotations()
		}
	}

	function handleEditorSuccess() {
		setIsEditorOpen(false)
		setEditingRotation(null)
		refreshRotations()
	}

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-lg font-semibold">Rotation Timeline</h3>
					<p className="text-sm text-muted-foreground">
						{eventName} - {heatsCount} heats × {laneCount} lanes
					</p>
				</div>
				<Button onClick={handleCreateRotation}>
					<Plus className="h-4 w-4 mr-2" />
					Add Rotation
				</Button>
			</div>

			{/* Timeline Grid */}
			<Card>
				<CardHeader>
					<CardTitle className="text-sm font-medium">
						Coverage: {coverage.coveragePercent}% ({coverage.coveredSlots}/
						{coverage.totalSlots})
					</CardTitle>
				</CardHeader>
				<CardContent>
					<ScrollArea className="w-full">
						<div className="min-w-max">
							{/* Grid Container */}
							<div
								className="grid gap-0 border rounded-lg overflow-hidden relative"
								style={{
									gridTemplateColumns: `60px repeat(${heatsCount}, 60px)`,
									gridTemplateRows: `40px repeat(${laneCount}, 40px)`,
								}}
							>
								{/* Header Row - Heats */}
								<div className="bg-muted border-r border-b flex items-center justify-center text-xs font-medium sticky left-0 z-20">
									Lane
								</div>
								{Array.from({ length: heatsCount }, (_, i) => i + 1).map((heat) => (
									<div
										key={heat}
										className="bg-muted border-r border-b last:border-r-0 flex items-center justify-center text-xs font-medium tabular-nums"
									>
										H{heat}
									</div>
								))}

								{/* Lane Rows */}
								{Array.from({ length: laneCount }, (_, i) => i + 1).map((lane) => (
									<>
										{/* Lane Label */}
										<div
											key={`lane-${lane}`}
											className="bg-muted border-r border-b flex items-center justify-center text-xs font-medium tabular-nums sticky left-0 z-10"
										>
											L{lane}
										</div>

										{/* Heat Cells for this lane */}
										{Array.from({ length: heatsCount }, (_, i) => i + 1).map(
											(heat) => {
												const key = `${heat}:${lane}`
												const status = coverageGrid.get(key) || "empty"

												return (
													<TimelineCell
														key={key}
														heat={heat}
														lane={lane}
														status={status}
													/>
												)
											},
										)}
									</>
								))}

								{/* Rotation Blocks Overlay */}
								<div
									className="absolute inset-0 pointer-events-none"
									style={{
										gridColumn: "2 / -1",
										gridRow: "2 / -1",
										display: "grid",
										gridTemplateColumns: `repeat(${heatsCount}, 60px)`,
										gridTemplateRows: `repeat(${laneCount}, 40px)`,
										gap: 0,
									}}
								>
									{rotations.map((rotation) => {
										const startCol = rotation.startingHeat - 1 // 0-indexed
										const startRow = rotation.startingLane - 1 // 0-indexed
										const span = rotation.heatsCount

										return (
											<div
												key={rotation.id}
												className="pointer-events-auto"
												style={{
													gridColumnStart: startCol + 1,
													gridColumnEnd: startCol + span + 1,
													gridRowStart: startRow + 1,
												}}
											>
												<RotationBlock
													rotation={rotation}
													judgeName={getJudgeName(rotation.membershipId)}
													laneCount={laneCount}
													onEdit={handleEditRotation}
													startCol={startCol}
													startRow={startRow}
													span={span}
												/>
											</div>
										)
									})}
								</div>
							</div>
						</div>
					</ScrollArea>
				</CardContent>
			</Card>

			{/* Legend */}
			<div className="flex items-center gap-4 text-sm">
				<div className="flex items-center gap-2">
					<div className="h-4 w-4 rounded border bg-background" />
					<span className="text-muted-foreground">Empty</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="h-4 w-4 rounded border bg-green-100 dark:bg-green-950" />
					<span className="text-muted-foreground">Covered</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="h-4 w-4 rounded border bg-red-100 dark:bg-red-950" />
					<span className="text-muted-foreground">Gap (No Judge)</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="h-4 w-4 rounded border bg-orange-100 dark:bg-orange-950" />
					<span className="text-muted-foreground">Overlap (Multiple Judges)</span>
				</div>
			</div>

			{/* Rotation Editor Dialog */}
			<Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{editingRotation ? "Edit Rotation" : "Create Rotation"}
						</DialogTitle>
					</DialogHeader>
					<RotationEditor
						competitionId={competitionId}
						teamId={teamId}
						trackWorkoutId={trackWorkoutId}
						maxHeats={heatsCount}
						maxLanes={laneCount}
						availableJudges={availableJudges}
						rotation={editingRotation ?? undefined}
						onSuccess={handleEditorSuccess}
						onCancel={() => setIsEditorOpen(false)}
					/>
				</DialogContent>
			</Dialog>
		</div>
	)
}

interface TimelineCellProps {
	heat: number
	lane: number
	status: "empty" | "covered" | "overlap"
}

function TimelineCell({ heat, lane, status }: TimelineCellProps) {
	const ref = useRef<HTMLDivElement>(null)
	const [isDraggedOver, setIsDraggedOver] = useState(false)

	useEffect(() => {
		const element = ref.current
		if (!element) return

		return dropTargetForElements({
			element,
			canDrop: ({ source }) => source.data.type === "rotation",
			onDragEnter: () => setIsDraggedOver(true),
			onDragLeave: () => setIsDraggedOver(false),
			onDrop: ({ source }) => {
				setIsDraggedOver(false)
				// TODO: Handle rotation drop - update startingHeat and startingLane
				console.log("Dropped rotation on cell", {
					heat,
					lane,
					rotation: source.data.rotation,
				})
			},
		})
	}, [heat, lane])

	const bgClass =
		status === "empty"
			? "bg-background"
			: status === "covered"
				? "bg-green-100 dark:bg-green-950/30"
				: "bg-orange-100 dark:bg-orange-950/30"

	return (
		<div
			ref={ref}
			className={`border-r border-b last:border-r-0 transition-colors ${bgClass} ${
				isDraggedOver ? "ring-2 ring-primary ring-inset" : ""
			}`}
		/>
	)
}
