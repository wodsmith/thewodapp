"use client"

import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { useServerAction } from "@repo/zsa-react"
import { ChevronLeft, Pencil, Plus, Trash2, User } from "lucide-react"
import {
	Fragment,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import {
	deleteJudgeRotationAction,
	getEventRotationsAction,
} from "@/actions/judge-rotation-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { CompetitionJudgeRotation, LaneShiftPattern } from "@/db/schema"
import {
	type CoverageStats,
	calculateCoverage,
	expandRotationToAssignments,
} from "@/lib/judge-rotation-utils"
import type { JudgeVolunteerInfo } from "@/server/judge-scheduling"
import { type PreviewCell, RotationEditor } from "./rotation-editor"

interface RotationTimelineProps {
	competitionId: string
	teamId: string
	trackWorkoutId: string
	eventName: string
	heatsCount: number
	laneCount: number
	availableJudges: JudgeVolunteerInfo[]
	initialRotations: CompetitionJudgeRotation[]
	/** Event-level lane shift pattern (with competition fallback already applied) */
	eventLaneShiftPattern: LaneShiftPattern
	/** Event-level default heats count (with competition fallback already applied) */
	eventDefaultHeatsCount: number
}

/**
 * Gantt-style timeline for judge rotations.
 * Single column layout: Grid on top, action area below.
 * Action area shows either the judge list or the rotation form (no layout shift).
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
	eventLaneShiftPattern,
	eventDefaultHeatsCount,
}: RotationTimelineProps) {
	const [rotations, setRotations] =
		useState<CompetitionJudgeRotation[]>(initialRotations)
	const [isEditorOpen, setIsEditorOpen] = useState(false)
	const [editingRotation, setEditingRotation] =
		useState<CompetitionJudgeRotation | null>(null)
	const [selectedRotationId, setSelectedRotationId] = useState<string | null>(
		null,
	)
	// Initial cell position when clicking on the grid (used when editor first opens)
	const [initialCellPosition, setInitialCellPosition] = useState<{
		heat: number
		lane: number
	} | null>(null)
	// External position update for when user clicks a cell while editor is already open
	const [externalPosition, setExternalPosition] = useState<{
		heat: number
		lane: number
	} | null>(null)
	// Preview cells from the editor form
	const [previewCells, setPreviewCells] = useState<PreviewCell[]>([])
	// Track cells currently covered by the rotation being edited (for outline styling)
	const [editingRotationCells, setEditingRotationCells] = useState<Set<string>>(
		new Set(),
	)

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

	// Build coverage grid with rotation IDs for highlighting
	const coverageGrid = useMemo(() => {
		const grid = new Map<
			string,
			{ status: "empty" | "covered" | "overlap"; rotationIds: string[] }
		>()

		// Initialize all slots as empty
		for (let heat = 1; heat <= heatsCount; heat++) {
			for (let lane = 1; lane <= laneCount; lane++) {
				grid.set(`${heat}:${lane}`, { status: "empty", rotationIds: [] })
			}
		}

		// Mark covered slots with rotation IDs
		for (const rotation of rotations) {
			const assignments = expandRotationToAssignments(rotation, heats)
			for (const assignment of assignments) {
				const key = `${assignment.heatNumber}:${assignment.laneNumber}`
				const current = grid.get(key)
				if (!current) continue

				if (current.rotationIds.length > 0) {
					grid.set(key, {
						status: "overlap",
						rotationIds: [...current.rotationIds, rotation.id],
					})
				} else {
					grid.set(key, { status: "covered", rotationIds: [rotation.id] })
				}
			}
		}

		return grid
	}, [rotations, heats, heatsCount, laneCount])

	// Build preview cell lookup for fast checking
	const previewCellSet = useMemo(() => {
		const set = new Set<string>()
		for (const cell of previewCells) {
			set.add(`${cell.heat}:${cell.lane}`)
		}
		return set
	}, [previewCells])

	// Get judge name by membershipId
	const getJudgeName = useCallback(
		(membershipId: string) => {
			const judge = availableJudges.find((j) => j.membershipId === membershipId)
			if (!judge) return "Unknown Judge"
			return (
				`${judge.firstName ?? ""} ${judge.lastName ?? ""}`.trim() || "Unknown"
			)
		},
		[availableJudges],
	)

	async function refreshRotations() {
		const [result] = await getRotations.execute({ trackWorkoutId })
		if (result?.data) {
			setRotations(result.data.rotations)
		}
	}

	function handleCreateRotation() {
		setEditingRotation(null)
		setInitialCellPosition(null)
		setSelectedRotationId(null)
		setEditingRotationCells(new Set())
		setIsEditorOpen(true)
	}

	function handleCellClick(heat: number, lane: number) {
		if (isEditorOpen) {
			// Editor is already open - update external position to shift the rotation
			setExternalPosition({ heat, lane })
		} else {
			// Editor is closed - open it with initial position
			setEditingRotation(null)
			setInitialCellPosition({ heat, lane })
			setExternalPosition(null)
			setSelectedRotationId(null)
			setEditingRotationCells(new Set())
			setIsEditorOpen(true)
		}
	}

	function handleEditRotation(rotation: CompetitionJudgeRotation) {
		// Calculate cells covered by the rotation being edited
		const assignments = expandRotationToAssignments(rotation, heats)
		const cellKeys = new Set<string>(
			assignments.map((a) => `${a.heatNumber}:${a.laneNumber}`),
		)
		setEditingRotationCells(cellKeys)

		setEditingRotation(rotation)
		setInitialCellPosition(null)
		setSelectedRotationId(null)
		setIsEditorOpen(true)
	}

	async function handleDeleteRotation(rotationId: string) {
		const [, error] = await deleteRotation.execute({ teamId, rotationId })
		if (!error) {
			if (selectedRotationId === rotationId) {
				setSelectedRotationId(null)
			}
			await refreshRotations()
		}
	}

	function handleEditorSuccess() {
		setIsEditorOpen(false)
		setEditingRotation(null)
		setInitialCellPosition(null)
		setExternalPosition(null)
		setPreviewCells([])
		setEditingRotationCells(new Set())
		refreshRotations()
	}

	function handleEditorCancel() {
		setIsEditorOpen(false)
		setEditingRotation(null)
		setInitialCellPosition(null)
		setExternalPosition(null)
		setPreviewCells([])
		setEditingRotationCells(new Set())
	}

	function toggleRotationSelection(rotationId: string) {
		setSelectedRotationId((prev) => (prev === rotationId ? null : rotationId))
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
			</div>

			{/* Main Content: Action Panel (left) + Grid (right) */}
			<div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
				{/* Action Area - swaps between judge list and form */}
				<Card className="lg:self-start">
					<CardHeader className="pb-3">
						<div className="flex items-center justify-between">
							{isEditorOpen ? (
								<>
									<Button
										variant="ghost"
										size="sm"
										onClick={handleEditorCancel}
										className="gap-1 -ml-2"
									>
										<ChevronLeft className="h-4 w-4" />
										Back
									</Button>
									<CardTitle className="text-sm font-medium">
										{editingRotation ? "Edit Rotation" : "Add Rotation"}
									</CardTitle>
									<div className="w-16" /> {/* Spacer for centering */}
								</>
							) : (
								<>
									<CardTitle className="text-sm font-medium">
										Assigned Judges ({rotations.length})
									</CardTitle>
									<Button size="sm" onClick={handleCreateRotation}>
										<Plus className="h-4 w-4 mr-1" />
										Add
									</Button>
								</>
							)}
						</div>
					</CardHeader>
					<CardContent className="pt-0">
						{isEditorOpen ? (
							/* Rotation Form */
							<RotationEditor
								competitionId={competitionId}
								teamId={teamId}
								trackWorkoutId={trackWorkoutId}
								maxHeats={heatsCount}
								maxLanes={laneCount}
								availableJudges={availableJudges}
								rotation={editingRotation ?? undefined}
								initialHeat={initialCellPosition?.heat}
								initialLane={initialCellPosition?.lane}
								externalPosition={externalPosition}
								eventLaneShiftPattern={eventLaneShiftPattern}
								eventDefaultHeatsCount={eventDefaultHeatsCount}
								onSuccess={handleEditorSuccess}
								onCancel={handleEditorCancel}
								onPreviewChange={setPreviewCells}
							/>
						) : rotations.length === 0 ? (
							/* Empty State */
							<p className="text-sm text-muted-foreground py-8 text-center">
								No judges assigned yet.
								<br />
								Click a cell in the grid or "Add" to assign judges.
							</p>
						) : (
							/* Judge List */
							<div className="space-y-2 max-h-[60vh] overflow-y-auto">
								{rotations.map((rotation) => {
									const endHeat = Math.min(
										rotation.startingHeat + rotation.heatsCount - 1,
										heatsCount,
									)
									const isSelected = selectedRotationId === rotation.id

									return (
										<div
											key={rotation.id}
											className={`w-full p-3 rounded-lg border transition-all ${
												isSelected
													? "bg-primary/10 border-primary ring-2 ring-primary/20"
													: "bg-muted/50 border-transparent hover:bg-muted hover:border-border"
											}`}
										>
											<div className="flex items-start justify-between gap-2">
												{/* Clickable area for selection */}
												<button
													type="button"
													onClick={() => toggleRotationSelection(rotation.id)}
													className="flex items-center gap-2 min-w-0 text-left flex-1"
												>
													<User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
													<span className="font-medium text-sm truncate">
														{getJudgeName(rotation.membershipId)}
													</span>
												</button>
												{/* Action buttons */}
												<div className="flex items-center gap-1 flex-shrink-0">
													<Button
														variant="ghost"
														size="icon"
														className="h-6 w-6"
														onClick={() => handleEditRotation(rotation)}
													>
														<Pencil className="h-3 w-3" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														className="h-6 w-6 text-destructive hover:text-destructive"
														onClick={() => handleDeleteRotation(rotation.id)}
													>
														<Trash2 className="h-3 w-3" />
													</Button>
												</div>
											</div>
											{/* Clickable info area */}
											<button
												type="button"
												onClick={() => toggleRotationSelection(rotation.id)}
												className="mt-1 text-xs text-muted-foreground tabular-nums text-left w-full"
											>
												Heats {rotation.startingHeat}-{endHeat} • Lane{" "}
												{rotation.startingLane}
												{rotation.laneShiftPattern !== "stay" && (
													<span className="ml-1">
														({rotation.laneShiftPattern.replace("_", " ")})
													</span>
												)}
											</button>
										</div>
									)
								})}
							</div>
						)}
					</CardContent>
				</Card>

				{/* Timeline Grid */}
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium">
							Coverage: {coverage.coveragePercent}% ({coverage.coveredSlots}/
							{coverage.totalSlots})
						</CardTitle>
					</CardHeader>
					<CardContent className="pt-0">
						<ScrollArea className="w-full">
							<div className="min-w-max">
								{/* Grid Container */}
								<div
									className="grid gap-0 border rounded-lg overflow-hidden"
									style={{
										gridTemplateColumns: `60px repeat(${heatsCount}, 60px)`,
										gridTemplateRows: `40px repeat(${laneCount}, 40px)`,
									}}
								>
									{/* Header Row - Heats */}
									<div className="bg-muted border-r border-b flex items-center justify-center text-xs font-medium sticky left-0 z-20">
										Lane
									</div>
									{Array.from({ length: heatsCount }, (_, i) => i + 1).map(
										(heat) => (
											<div
												key={heat}
												className="bg-muted border-r border-b last:border-r-0 flex items-center justify-center text-xs font-medium tabular-nums"
											>
												H{heat}
											</div>
										),
									)}

									{/* Lane Rows */}
									{Array.from({ length: laneCount }, (_, i) => i + 1).map(
										(lane) => (
											<Fragment key={`lane-row-${lane}`}>
												{/* Lane Label */}
												<div className="bg-muted border-r border-b flex items-center justify-center text-xs font-medium tabular-nums sticky left-0 z-10">
													L{lane}
												</div>

												{/* Heat Cells for this lane */}
												{Array.from(
													{ length: heatsCount },
													(_, i) => i + 1,
												).map((heat) => {
													const key = `${heat}:${lane}`
													const cellData = coverageGrid.get(key) || {
														status: "empty" as const,
														rotationIds: [],
													}
													const isHighlighted =
														selectedRotationId !== null &&
														cellData.rotationIds.includes(selectedRotationId)
													const isPreview = previewCellSet.has(key)
													// Check if this cell is part of the rotation being edited
													const isEditingCell = editingRotationCells.has(key)
													// Check if preview cell has a conflict (overlaps with existing assignment
													// that isn't the rotation being edited)
													const isPreviewConflict =
														isPreview &&
														cellData.status !== "empty" &&
														!isEditingCell

													return (
														<TimelineCell
															key={key}
															heat={heat}
															lane={lane}
															status={cellData.status}
															isHighlighted={isHighlighted}
															isPreview={isPreview}
															isPreviewConflict={isPreviewConflict}
															isEditingCell={isEditingCell}
															onClick={() => handleCellClick(heat, lane)}
														/>
													)
												})}
											</Fragment>
										),
									)}
								</div>
							</div>
						</ScrollArea>

						{/* Legend */}
						<div className="flex flex-wrap items-center gap-4 mt-4 text-xs">
							<div className="flex items-center gap-2">
								<div className="h-4 w-4 rounded border bg-background" />
								<span className="text-muted-foreground">Empty</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="h-4 w-4 rounded border bg-emerald-500/40" />
								<span className="text-muted-foreground">Covered</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="h-4 w-4 rounded border bg-amber-500/40" />
								<span className="text-muted-foreground">Overlap</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="h-4 w-4 rounded border bg-primary/60 ring-2 ring-primary" />
								<span className="text-muted-foreground">Selected</span>
							</div>
							{isEditorOpen && (
								<>
									<div className="flex items-center gap-2">
										<div className="h-4 w-4 rounded border bg-muted-foreground/30 border-dashed border-muted-foreground" />
										<span className="text-muted-foreground">Preview</span>
									</div>
									<div className="flex items-center gap-2">
										<div className="h-4 w-4 rounded border-dashed border-2 border-red-500 bg-red-500/40" />
										<span className="text-muted-foreground">Conflict</span>
									</div>
									{editingRotation && (
										<div className="flex items-center gap-2">
											<div className="h-4 w-4 rounded border bg-background ring-2 ring-emerald-500" />
											<span className="text-muted-foreground">
												Current Assignment
											</span>
										</div>
									)}
								</>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}

interface TimelineCellProps {
	heat: number
	lane: number
	status: "empty" | "covered" | "overlap"
	isHighlighted: boolean
	isPreview: boolean
	/** True if this preview cell conflicts with an existing assignment */
	isPreviewConflict: boolean
	/** True if this cell is part of the rotation currently being edited */
	isEditingCell: boolean
	onClick: () => void
}

function TimelineCell({
	heat,
	lane,
	status,
	isHighlighted,
	isPreview,
	isPreviewConflict,
	isEditingCell,
	onClick,
}: TimelineCellProps) {
	const ref = useRef<HTMLButtonElement>(null)
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

	// Determine background class based on status, highlight, preview, and editing state
	let bgClass: string
	if (isPreviewConflict) {
		// Preview cell that conflicts with existing assignment - RED
		bgClass = "bg-red-500/40 border-dashed border-2 border-red-500"
	} else if (isPreview) {
		// Preview cells without conflict - gray dashed border
		bgClass =
			"bg-muted-foreground/20 border-dashed border-2 border-muted-foreground/50"
	} else if (isEditingCell) {
		// Cells currently covered by the rotation being edited - outline style (no fill)
		bgClass = "bg-background ring-2 ring-inset ring-emerald-500"
	} else if (isHighlighted) {
		bgClass = "bg-primary/50 ring-2 ring-inset ring-primary"
	} else if (status === "empty") {
		bgClass = "bg-background hover:bg-muted/50"
	} else if (status === "covered") {
		bgClass = "bg-emerald-500/30"
	} else {
		bgClass = "bg-amber-500/30"
	}

	return (
		<button
			ref={ref}
			type="button"
			onClick={onClick}
			className={`border-r border-b last:border-r-0 transition-colors cursor-pointer ${bgClass} ${
				isDraggedOver ? "ring-2 ring-blue-500 ring-inset" : ""
			}`}
		/>
	)
}
