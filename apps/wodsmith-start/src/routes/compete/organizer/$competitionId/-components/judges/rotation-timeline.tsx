"use client"

import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { ChevronLeft, Loader2, Pencil, Plus, Search, Trash2, User } from "lucide-react"
import {
	Fragment,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { toast } from "sonner"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ToggleGroup } from "@/components/ui/toggle-group"
import type { CompetitionJudgeRotation, LaneShiftPattern } from "@/db/schema"
import type { VolunteerAvailability } from "@/db/schemas/volunteers"
import { VOLUNTEER_AVAILABILITY } from "@/db/schemas/volunteers"
import {
	type CoverageStats,
	calculateCoverage,
	expandRotationToAssignments,
	filterRotationsByAvailability,
} from "@/lib/judge-rotation-utils"
import type { HeatWithAssignments } from "@/server-fns/competition-heats-fns"
import {
	adjustRotationsForOccupiedLanesFn,
	deleteVolunteerRotationsFn,
	getEventRotationsFn,
	updateJudgeRotationFn,
} from "@/server-fns/judge-rotation-fns"
import type { JudgeVolunteerInfo } from "@/server-fns/judge-scheduling-fns"
import {
	type MultiPreviewCell,
	MultiRotationEditor,
} from "./multi-rotation-editor"

interface RotationTimelineProps {
	competitionId: string
	teamId: string
	trackWorkoutId: string
	eventName: string
	/** Array of heats with assignments for display and lane filtering */
	heatsWithAssignments: HeatWithAssignments[]
	laneCount: number
	availableJudges: JudgeVolunteerInfo[]
	initialRotations: CompetitionJudgeRotation[]
	/** Event-level lane shift pattern (with competition fallback already applied) */
	eventLaneShiftPattern: LaneShiftPattern
	/** Event-level default heats count (with competition fallback already applied) */
	eventDefaultHeatsCount: number
	/** Minimum heat buffer between rotations for the same judge (default 2) */
	minHeatBuffer: number
	/** Whether to filter out empty lanes (lanes with no athletes) */
	filterEmptyLanes: boolean
	/** Callback when filter state changes */
	onFilterEmptyLanesChange: (value: boolean) => void
	/** Callback when rotations are updated */
	onRotationsChange?: (rotations: CompetitionJudgeRotation[]) => void
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
	heatsWithAssignments,
	laneCount,
	availableJudges,
	initialRotations,
	eventLaneShiftPattern,
	eventDefaultHeatsCount,
	minHeatBuffer,
	filterEmptyLanes,
	onFilterEmptyLanesChange,
	onRotationsChange,
}: RotationTimelineProps) {
	const heatsCount = heatsWithAssignments.length
	const [availabilityFilter, setAvailabilityFilter] = useState<
		"all" | VolunteerAvailability
	>("all")
	const [judgeSearchQuery, setJudgeSearchQuery] = useState("")
	const [rotations, setRotations] =
		useState<CompetitionJudgeRotation[]>(initialRotations)

	// Sync rotations state when initialRotations prop changes (e.g., event switch)
	useEffect(() => {
		setRotations(initialRotations)
		// Also reset UI state when switching events
		setIsEditorOpen(false)
		setEditingVolunteerId(null)
		setSelectedRotationId(null)
		setSelectedVolunteerId(null)
		setExpandedVolunteers(new Set())
		setPreviewCells([])
		setEditingRotationCells(new Set())
	}, [initialRotations])

	const [isEditorOpen, setIsEditorOpen] = useState(false)
	const [editingVolunteerId, setEditingVolunteerId] = useState<string | null>(
		null,
	)
	const [selectedRotationId, setSelectedRotationId] = useState<string | null>(
		null,
	)
	// Track which volunteer is selected in the list (to highlight their cells on grid)
	const [selectedVolunteerId, setSelectedVolunteerId] = useState<string | null>(
		null,
	)
	const [activeBlockIndex, setActiveBlockIndex] = useState(0)
	const [expandedVolunteers, setExpandedVolunteers] = useState<Set<string>>(
		new Set(),
	)
	// Initial cell position when clicking on the grid (used when editor first opens)
	const [initialCellPosition, setInitialCellPosition] = useState<{
		heat: number
		lane: number
	} | null>(null)
	// External position update for when user clicks a cell while editor is already open
	// Includes a timestamp to ensure React sees each click as a new value
	const [externalPosition, setExternalPosition] = useState<{
		heat: number
		lane: number
		timestamp: number
	} | null>(null)
	// Preview cells from the editor form
	const [previewCells, setPreviewCells] = useState<MultiPreviewCell[]>([])
	// Track cells currently covered by the rotations being edited (for outline styling)
	const [editingRotationCells, setEditingRotationCells] = useState<Set<string>>(
		new Set(),
	)
	// Delete confirmation dialog state
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
	const [deletingVolunteerId, setDeletingVolunteerId] = useState<string | null>(
		null,
	)
	const [isDeleting, setIsDeleting] = useState(false)

	// Clear unassigned lanes modal state
	const [clearUnassignedOpen, setClearUnassignedOpen] = useState(false)
	const [isClearingUnassigned, setIsClearingUnassigned] = useState(false)

	// Compute occupied lanes per heat from athlete assignments
	const occupiedLanesByHeat = useMemo(() => {
		const map = new Map<number, Set<number>>()
		for (const heat of heatsWithAssignments) {
			const occupiedLanes = new Set<number>()
			for (const assignment of heat.assignments) {
				occupiedLanes.add(assignment.laneNumber)
			}
			map.set(heat.heatNumber, occupiedLanes)
		}
		return map
	}, [heatsWithAssignments])

	// Build heats array for coverage calculation
	// Use actual heat numbers from heatsWithAssignments
	const heats = useMemo(
		() =>
			heatsWithAssignments.map((heat) => {
				// Include occupiedLanes if filtering is enabled
				if (filterEmptyLanes) {
					// Compute occupied lanes directly from heat assignments to ensure consistency
					const occupiedLanes = new Set<number>()
					for (const assignment of heat.assignments) {
						occupiedLanes.add(assignment.laneNumber)
					}
					return {
						heatNumber: heat.heatNumber,
						laneCount,
						occupiedLanes,
					}
				}
				return {
					heatNumber: heat.heatNumber,
					laneCount,
				}
			}),
		[heatsWithAssignments, laneCount, filterEmptyLanes],
	)

	// Calculate coverage
	const coverage: CoverageStats = useMemo(
		() => calculateCoverage(rotations, heats),
		[rotations, heats],
	)

	// Find rotations that have assignments on lanes without athletes
	// NOTE: This uses the OLD expansion (without respectOccupiedLanes) to identify
	// rotations that WOULD have assignments on unassigned lanes if shift pattern
	// were applied naively. This is intentional - it shows what needs adjustment.
	const rotationsOnUnassignedLanes = useMemo(() => {
		if (!filterEmptyLanes) return []

		const affectedRotations: Array<{
			rotation: CompetitionJudgeRotation
			judgeName: string
			unassignedSlots: Array<{ heat: number; lane: number }>
		}> = []

		for (const rotation of rotations) {
			// Use naive expansion to detect what would land on unassigned lanes
			const assignments = expandRotationToAssignments(rotation, heats)
			const unassignedSlots: Array<{ heat: number; lane: number }> = []

			for (const assignment of assignments) {
				const occupiedLanes = occupiedLanesByHeat.get(assignment.heatNumber)
				if (!occupiedLanes?.has(assignment.laneNumber)) {
					unassignedSlots.push({
						heat: assignment.heatNumber,
						lane: assignment.laneNumber,
					})
				}
			}

			if (unassignedSlots.length > 0) {
				const judge = availableJudges.find(
					(j) => j.membershipId === rotation.membershipId,
				)
				const judgeName =
					`${judge?.firstName ?? ""} ${judge?.lastName ?? ""}`.trim() ||
					"Unknown Judge"

				affectedRotations.push({
					rotation,
					judgeName,
					unassignedSlots,
				})
			}
		}

		return affectedRotations
	}, [
		filterEmptyLanes,
		rotations,
		heats,
		occupiedLanesByHeat,
		availableJudges,
	])

	// Group rotations by volunteer
	const rotationsByVolunteer = useMemo(() => {
		const grouped = new Map<string, CompetitionJudgeRotation[]>()
		for (const rotation of rotations) {
			const existing = grouped.get(rotation.membershipId) || []
			grouped.set(rotation.membershipId, [...existing, rotation])
		}
		return grouped
	}, [rotations])

	// Filter rotations by volunteer availability and search query
	const filteredRotationsByVolunteer = useMemo(() => {
		// Get judge availability from availableJudges
		const judgeAvailabilityMap = new Map<
			string,
			VolunteerAvailability | undefined
		>()
		for (const judge of availableJudges) {
			judgeAvailabilityMap.set(judge.membershipId, judge.availability)
		}

		const byAvailability = filterRotationsByAvailability(
			rotationsByVolunteer,
			availabilityFilter,
			judgeAvailabilityMap,
		)

		// Apply search filter if query exists
		if (!judgeSearchQuery.trim()) {
			return byAvailability
		}

		const query = judgeSearchQuery.toLowerCase().trim()
		const filtered = new Map<string, CompetitionJudgeRotation[]>()

		for (const [membershipId, rots] of byAvailability.entries()) {
			const judge = availableJudges.find((j) => j.membershipId === membershipId)
			const fullName =
				`${judge?.firstName ?? ""} ${judge?.lastName ?? ""}`.toLowerCase()

			if (fullName.includes(query)) {
				filtered.set(membershipId, rots)
			}
		}

		return filtered
	}, [rotationsByVolunteer, availabilityFilter, availableJudges, judgeSearchQuery])

	// Build maps between display index (1-based) and actual heat number
	const { displayToHeatNumber, heatNumberToDisplay } = useMemo(() => {
		const displayToHeat = new Map<number, number>()
		const heatToDisplay = new Map<number, number>()
		heatsWithAssignments.forEach((heat, idx) => {
			displayToHeat.set(idx + 1, heat.heatNumber)
			heatToDisplay.set(heat.heatNumber, idx + 1)
		})
		return { displayToHeatNumber: displayToHeat, heatNumberToDisplay: heatToDisplay }
	}, [heatsWithAssignments])

	// Build coverage grid with rotation IDs for highlighting and buffer zones
	const coverageGrid = useMemo(() => {
		const grid = new Map<
			string,
			{
				status:
					| "empty"
					| "covered"
					| "overlap"
					| "buffer-blocked"
					| "unavailable"
				rotationIds: string[]
			}
		>()

		// Initialize all slots using display indices but looking up by actual heat number
		for (let displayIdx = 1; displayIdx <= heatsCount; displayIdx++) {
			const actualHeatNumber = displayToHeatNumber.get(displayIdx) ?? displayIdx
			for (let lane = 1; lane <= laneCount; lane++) {
				// Mark as unavailable if filtering is enabled and lane has no athlete
				if (filterEmptyLanes) {
					const occupiedLanes = occupiedLanesByHeat.get(actualHeatNumber)
					const hasAthlete = occupiedLanes?.has(lane) ?? false
					if (!hasAthlete) {
						grid.set(`${displayIdx}:${lane}`, {
							status: "unavailable",
							rotationIds: [],
						})
						continue
					}
				}
				// Default to empty
				grid.set(`${displayIdx}:${lane}`, { status: "empty", rotationIds: [] })
			}
		}

		// Mark covered slots with rotation IDs
		// Use respectOccupiedLanes when filtering so shift pattern cycles through occupied lanes only
		for (const rotation of rotations) {
			const assignments = expandRotationToAssignments(rotation, heats, {
				respectOccupiedLanes: filterEmptyLanes,
			})
			for (const assignment of assignments) {
				// Convert actual heat number to display index for grid lookup
				const displayIdx = heatNumberToDisplay.get(assignment.heatNumber)
				if (displayIdx === undefined) continue
				const key = `${displayIdx}:${assignment.laneNumber}`
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

		// When a volunteer is being edited/selected, mark buffer zones
		if (editingVolunteerId) {
			const volunteerRotations = rotationsByVolunteer.get(editingVolunteerId)
			if (volunteerRotations) {
				for (const rotation of volunteerRotations) {
					const assignments = expandRotationToAssignments(rotation, heats, {
						respectOccupiedLanes: filterEmptyLanes,
					})
					if (assignments.length === 0) continue

					// Get the heat range of this rotation (using display indices)
					const displayIndices = assignments
						.map((a) => heatNumberToDisplay.get(a.heatNumber))
						.filter((idx): idx is number => idx !== undefined)
					if (displayIndices.length === 0) continue
					const rotationStart = Math.min(...displayIndices)
					const rotationEnd = Math.max(...displayIndices)

					// Calculate buffer zones (in display indices)
					// Buffer after: (rotationEnd, rotationEnd + minHeatBuffer]
					const bufferAfterEnd = rotationEnd + minHeatBuffer

					// Buffer before: [rotationStart - minHeatBuffer, rotationStart)
					const bufferBeforeStart = rotationStart - minHeatBuffer

					// Mark buffer zone cells (all lanes in buffer heats)
					for (let displayIdx = bufferBeforeStart; displayIdx <= bufferAfterEnd; displayIdx++) {
						// Skip heats within the rotation itself
						if (displayIdx >= rotationStart && displayIdx <= rotationEnd) continue
						// Skip heats outside valid range
						if (displayIdx < 1 || displayIdx > heatsCount) continue

						for (let lane = 1; lane <= laneCount; lane++) {
							const key = `${displayIdx}:${lane}`
							const current = grid.get(key)
							if (!current) continue

							// Only mark as buffer-blocked if not already covered/overlapped
							// (we want to show that existing assignments would be conflicts)
							if (current.status === "empty") {
								grid.set(key, {
									status: "buffer-blocked",
									rotationIds: current.rotationIds,
								})
							}
						}
					}
				}
			}
		}

		return grid
	}, [
		rotations,
		heats,
		heatsCount,
		laneCount,
		editingVolunteerId,
		rotationsByVolunteer,
		minHeatBuffer,
		filterEmptyLanes,
		occupiedLanesByHeat,
		displayToHeatNumber,
		heatNumberToDisplay,
	])

	// Build preview cell lookup for fast checking with block colors
	const previewCellMap = useMemo(() => {
		const map = new Map<string, number>()
		for (const cell of previewCells) {
			map.set(`${cell.heat}:${cell.lane}`, cell.blockIndex)
		}
		return map
	}, [previewCells])

	// Compute cells for the selected volunteer (for highlighting on grid)
	const selectedVolunteerCells = useMemo(() => {
		if (!selectedVolunteerId) return new Set<string>()
		const volunteerRotations = rotationsByVolunteer.get(selectedVolunteerId)
		if (!volunteerRotations) return new Set<string>()

		const cellKeys = new Set<string>()
		for (const rotation of volunteerRotations) {
			const assignments = expandRotationToAssignments(rotation, heats, {
				respectOccupiedLanes: filterEmptyLanes,
			})
			for (const assignment of assignments) {
				// Convert actual heat number to display index for grid lookup
				const displayIdx = heatNumberToDisplay.get(assignment.heatNumber)
				if (displayIdx === undefined) continue
				cellKeys.add(`${displayIdx}:${assignment.laneNumber}`)
			}
		}
		return cellKeys
	}, [selectedVolunteerId, rotationsByVolunteer, heats, filterEmptyLanes, heatNumberToDisplay])

	// Color palette for multiple blocks
	const BLOCK_COLORS = [
		{ bg: "bg-blue-500/30", border: "border-blue-500" },
		{ bg: "bg-purple-500/30", border: "border-purple-500" },
		{ bg: "bg-cyan-500/30", border: "border-cyan-500" },
		{ bg: "bg-pink-500/30", border: "border-pink-500" },
		{ bg: "bg-orange-500/30", border: "border-orange-500" },
	]

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

	const refreshRotations = useCallback(async () => {
		try {
			const result = await getEventRotationsFn({ data: { trackWorkoutId } })
			if (result?.rotations) {
				setRotations(result.rotations)
				onRotationsChange?.(result.rotations)
			}
		} catch (err) {
			console.error("Failed to refresh rotations:", err)
		}
	}, [trackWorkoutId, onRotationsChange])

	function handleCreateRotation() {
		setEditingVolunteerId(null)
		setInitialCellPosition(null)
		setSelectedRotationId(null)
		setEditingRotationCells(new Set())
		setActiveBlockIndex(0)
		setIsEditorOpen(true)
	}

	function handleCellClick(heat: number, lane: number) {
		// Block clicks on unavailable cells (no athlete assigned)
		if (filterEmptyLanes) {
			const occupiedLanes = occupiedLanesByHeat.get(heat)
			if (!occupiedLanes?.has(lane)) {
				return
			}
		}

		if (isEditorOpen) {
			// Editor is already open - update external position to shift the ACTIVE block
			// Include timestamp to ensure React sees each click as a new value
			setExternalPosition({ heat, lane, timestamp: Date.now() })
		} else {
			// Editor is closed - open it with initial position
			setEditingVolunteerId(null)
			setInitialCellPosition({ heat, lane })
			setExternalPosition(null)
			setSelectedRotationId(null)
			setSelectedVolunteerId(null)
			setEditingRotationCells(new Set())
			setActiveBlockIndex(0)
			setIsEditorOpen(true)
		}
	}

	/**
	 * Handle rotation drop - update the rotation's starting heat and lane
	 */
	const handleRotationDrop = useCallback(
		async (
			rotation: CompetitionJudgeRotation,
			targetHeat: number,
			targetLane: number,
		) => {
			// Skip if dropping on the same position
			if (
				rotation.startingHeat === targetHeat &&
				rotation.startingLane === targetLane
			) {
				return
			}

			try {
				await updateJudgeRotationFn({
					data: {
						teamId,
						rotationId: rotation.id,
						startingHeat: targetHeat,
						startingLane: targetLane,
					},
				})
				// Refresh rotations to reflect the update
				await refreshRotations()
			} catch (error) {
				console.error("Failed to update rotation:", error)
				toast.error("Failed to update rotation")
			}
		},
		[teamId, refreshRotations],
	)

	function handleEditVolunteerRotations(membershipId: string) {
		const volunteerRotations = rotationsByVolunteer.get(membershipId) || []

		// Calculate cells covered by ALL rotations being edited (using display indices)
		const cellKeys = new Set<string>()
		for (const rotation of volunteerRotations) {
			const assignments = expandRotationToAssignments(rotation, heats, {
				respectOccupiedLanes: filterEmptyLanes,
			})
			for (const assignment of assignments) {
				const displayIdx = heatNumberToDisplay.get(assignment.heatNumber)
				if (displayIdx === undefined) continue
				cellKeys.add(`${displayIdx}:${assignment.laneNumber}`)
			}
		}
		setEditingRotationCells(cellKeys)

		setEditingVolunteerId(membershipId)
		setInitialCellPosition(null)
		setSelectedRotationId(null)
		setSelectedVolunteerId(null)
		setActiveBlockIndex(0)
		setIsEditorOpen(true)
	}

	function handleAddRotationForVolunteer(membershipId: string) {
		const volunteerRotations = rotationsByVolunteer.get(membershipId) || []

		// Calculate cells covered by existing rotations (using display indices)
		const cellKeys = new Set<string>()
		for (const rotation of volunteerRotations) {
			const assignments = expandRotationToAssignments(rotation, heats, {
				respectOccupiedLanes: filterEmptyLanes,
			})
			for (const assignment of assignments) {
				const displayIdx = heatNumberToDisplay.get(assignment.heatNumber)
				if (displayIdx === undefined) continue
				cellKeys.add(`${displayIdx}:${assignment.laneNumber}`)
			}
		}
		setEditingRotationCells(cellKeys)

		// Open editor with existing rotations, but set active block to a new one
		// The MultiRotationEditor will need to handle adding a new block
		setEditingVolunteerId(membershipId)
		setInitialCellPosition(null)
		setSelectedRotationId(null)
		setSelectedVolunteerId(null)
		// Set to length of existing rotations - this signals to add a new block
		setActiveBlockIndex(volunteerRotations.length)
		setIsEditorOpen(true)
	}

	function handleEditorSuccess() {
		setIsEditorOpen(false)
		setEditingVolunteerId(null)
		setInitialCellPosition(null)
		setExternalPosition(null)
		setPreviewCells([])
		setEditingRotationCells(new Set())
		setSelectedVolunteerId(null)
		setActiveBlockIndex(0)
		refreshRotations()
	}

	function handleEditorCancel() {
		setIsEditorOpen(false)
		setEditingVolunteerId(null)
		setInitialCellPosition(null)
		setExternalPosition(null)
		setPreviewCells([])
		setEditingRotationCells(new Set())
		setSelectedVolunteerId(null)
		setActiveBlockIndex(0)
	}

	function toggleVolunteerExpansion(membershipId: string) {
		const isCurrentlyExpanded = expandedVolunteers.has(membershipId)

		setExpandedVolunteers((prev) => {
			const next = new Set(prev)
			if (next.has(membershipId)) {
				next.delete(membershipId)
			} else {
				next.add(membershipId)
			}
			return next
		})

		// Sync selection with expansion state:
		// - Expanding: select the volunteer (and clear rotation selection)
		// - Collapsing: deselect the volunteer
		if (isCurrentlyExpanded) {
			// Collapsing - deselect
			if (selectedVolunteerId === membershipId) {
				setSelectedVolunteerId(null)
			}
		} else {
			// Expanding - select (and clear any rotation selection)
			setSelectedRotationId(null)
			setSelectedVolunteerId(membershipId)
		}
	}

	function toggleRotationSelection(rotationId: string) {
		// Clear any selected volunteer when selecting a rotation
		setSelectedVolunteerId(null)
		setSelectedRotationId((prev) => (prev === rotationId ? null : rotationId))
	}

	function handleDeleteVolunteerRotations(membershipId: string) {
		setDeletingVolunteerId(membershipId)
		setDeleteConfirmOpen(true)
	}

	async function confirmDeleteVolunteerRotations() {
		if (!deletingVolunteerId) return

		setIsDeleting(true)
		try {
			await deleteVolunteerRotationsFn({
				data: {
					teamId,
					membershipId: deletingVolunteerId,
					trackWorkoutId,
				},
			})
			toast.success("Rotations deleted")
			await refreshRotations()
		} catch (err) {
			console.error("Failed to delete rotations:", err)
			toast.error("Failed to delete rotations")
		} finally {
			setIsDeleting(false)
			setDeleteConfirmOpen(false)
			setDeletingVolunteerId(null)
		}
	}

	async function confirmAdjustUnassignedLanes() {
		if (rotationsOnUnassignedLanes.length === 0) return

		setIsClearingUnassigned(true)
		try {
			const rotationIds = rotationsOnUnassignedLanes.map((r) => r.rotation.id)

			// Convert occupiedLanesByHeat Map to a plain object for the server function
			const occupiedLanesObj: Record<string, number[]> = {}
			for (const [heatNum, lanesSet] of occupiedLanesByHeat.entries()) {
				occupiedLanesObj[String(heatNum)] = Array.from(lanesSet)
			}

			const result = await adjustRotationsForOccupiedLanesFn({
				data: {
					teamId,
					competitionId,
					trackWorkoutId,
					occupiedLanesByHeat: occupiedLanesObj,
					rotationIds,
				},
			})
			toast.success(
				`Adjusted ${result.data.deletedCount} rotation${result.data.deletedCount > 1 ? "s" : ""}, created ${result.data.createdCount} new`,
			)
			await refreshRotations()
		} catch (err) {
			console.error("Failed to adjust rotations:", err)
			toast.error("Failed to adjust rotations")
		} finally {
			setIsClearingUnassigned(false)
			setClearUnassignedOpen(false)
		}
	}

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-lg font-semibold">Rotation Timeline</h3>
					<p className="text-sm text-muted-foreground">
						{eventName} - {heatsCount} heats x {laneCount} lanes
					</p>
				</div>
				<div className="flex items-center gap-4">
					{filterEmptyLanes && rotationsOnUnassignedLanes.length > 0 && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => setClearUnassignedOpen(true)}
						>
							<Pencil className="mr-1 h-4 w-4" />
							Adjust unassigned lanes ({rotationsOnUnassignedLanes.length})
						</Button>
					)}
					<div className="flex items-center gap-2">
						<Checkbox
							id="filter-empty-lanes"
							checked={filterEmptyLanes}
							onCheckedChange={(checked) =>
								onFilterEmptyLanesChange(checked === true)
							}
						/>
						<label
							htmlFor="filter-empty-lanes"
							className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
						>
							Only show lanes with athletes
						</label>
					</div>
				</div>
			</div>

			{/* Main Content: Action Panel (left) + Grid (right) */}
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
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
										className="-ml-2 gap-1"
									>
										<ChevronLeft className="h-4 w-4" />
										Back
									</Button>
									<CardTitle className="text-sm font-medium">
										{editingVolunteerId ? "Edit Rotations" : "Add Rotation"}
									</CardTitle>
									<div className="w-16" /> {/* Spacer for centering */}
								</>
							) : (
								<>
									<CardTitle className="text-sm font-medium">
										Assigned Judges ({rotations.length})
									</CardTitle>
									<Button size="sm" onClick={handleCreateRotation}>
										<Plus className="mr-1 h-4 w-4" />
										Add
									</Button>
								</>
							)}
						</div>
					</CardHeader>
					<CardContent className="pt-0">
						{isEditorOpen ? (
							/* Rotation Form */
							<MultiRotationEditor
								competitionId={competitionId}
								teamId={teamId}
								trackWorkoutId={trackWorkoutId}
								maxHeats={heatsCount}
								maxLanes={laneCount}
								availableJudges={availableJudges}
								rotationsByVolunteer={rotationsByVolunteer}
								existingRotations={
									editingVolunteerId
										? rotationsByVolunteer.get(editingVolunteerId)
										: undefined
								}
								initialHeat={initialCellPosition?.heat}
								initialLane={initialCellPosition?.lane}
								externalPosition={externalPosition}
								activeBlockIndex={activeBlockIndex}
								onActiveBlockChange={setActiveBlockIndex}
								eventLaneShiftPattern={eventLaneShiftPattern}
								eventDefaultHeatsCount={eventDefaultHeatsCount}
								filterEmptyLanes={filterEmptyLanes}
								occupiedLanesByHeat={occupiedLanesByHeat}
								onSuccess={handleEditorSuccess}
								onCancel={handleEditorCancel}
								onPreviewChange={setPreviewCells}
								onJudgeSelect={setSelectedVolunteerId}
							/>
						) : rotations.length === 0 ? (
							/* Empty State */
							<p className="py-8 text-center text-sm text-muted-foreground">
								No judges assigned yet.
								<br />
								Click a cell in the grid or "Add" to assign judges.
							</p>
						) : (
							/* Grouped Judge List */
							<>
								{/* Search Input */}
								<div className="relative mb-3">
									<Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										type="text"
										placeholder="Search judges..."
										value={judgeSearchQuery}
										onChange={(e) => setJudgeSearchQuery(e.target.value)}
										className="h-8 pl-8 text-sm"
									/>
								</div>

								{/* Availability Filter */}
								<div className="mb-3">
									<div className="mb-2 text-xs font-medium text-muted-foreground">
										Filter by Availability
									</div>
									<ToggleGroup
										value={availabilityFilter}
										onValueChange={(value) => {
											setAvailabilityFilter(
												value as "all" | VolunteerAvailability,
											)
										}}
										options={[
											{ value: "all", label: "All" },
											{
												value: VOLUNTEER_AVAILABILITY.MORNING,
												label: "Morning",
											},
											{
												value: VOLUNTEER_AVAILABILITY.AFTERNOON,
												label: "Afternoon",
											},
											{
												value: VOLUNTEER_AVAILABILITY.ALL_DAY,
												label: "All Day",
											},
										]}
										className="justify-start"
									/>
								</div>
								<div className="max-h-[60vh] space-y-2 overflow-y-auto">
									{Array.from(filteredRotationsByVolunteer.entries()).map(
										([membershipId, volunteerRotations]) => {
											const judgeName = getJudgeName(membershipId)
											const isExpanded = expandedVolunteers.has(membershipId)

											// Calculate heat ranges for this volunteer
											const heatRanges = volunteerRotations.map((r) => ({
												start: r.startingHeat,
												end: Math.min(
													r.startingHeat + r.heatsCount - 1,
													heatsCount,
												),
											}))
											const minHeat = Math.min(
												...heatRanges.map((r) => r.start),
											)
											const maxHeat = Math.max(...heatRanges.map((r) => r.end))

											const isVolunteerSelected =
												selectedVolunteerId === membershipId

											return (
												<div
													key={membershipId}
													className={`rounded-lg border transition-colors ${
														isVolunteerSelected
															? "border-primary bg-primary/10 ring-1 ring-primary"
															: "bg-muted/50"
													}`}
												>
													{/* Volunteer Header */}
													<div className="space-y-2 p-3">
														<div className="flex items-start justify-between gap-2">
															<button
																type="button"
																onClick={() => {
																	// Toggle expand/collapse - this also syncs selection state
																	toggleVolunteerExpansion(membershipId)
																}}
																className="flex flex-1 items-center gap-2 text-left"
															>
																<User
																	className={`h-4 w-4 flex-shrink-0 ${
																		isVolunteerSelected
																			? "text-primary"
																			: "text-muted-foreground"
																	}`}
																/>
																<div className="min-w-0 flex-1">
																	<div
																		className={`truncate text-sm font-medium ${
																			isVolunteerSelected ? "text-primary" : ""
																		}`}
																	>
																		{judgeName} ({volunteerRotations.length}{" "}
																		rotation
																		{volunteerRotations.length > 1 ? "s" : ""})
																	</div>
																	<div className="text-xs tabular-nums text-muted-foreground">
																		Heats {minHeat}-{maxHeat} • Lane{" "}
																		{volunteerRotations[0]?.startingLane ?? 1}
																		{volunteerRotations[0]?.laneShiftPattern &&
																			volunteerRotations[0].laneShiftPattern !==
																				"stay" && (
																				<span className="ml-1">
																					(
																					{volunteerRotations[0].laneShiftPattern.replace(
																						"_",
																						" ",
																					)}
																					)
																				</span>
																			)}
																	</div>
																</div>
																<ChevronLeft
																	className={`h-4 w-4 transition-transform ${isExpanded ? "-rotate-90" : ""}`}
																/>
															</button>
														</div>
														<div className="flex items-center gap-1">
															<Button
																variant="outline"
																size="sm"
																className="h-7 text-xs"
																onClick={() =>
																	handleEditVolunteerRotations(membershipId)
																}
															>
																<Pencil className="mr-1 h-3 w-3" />
																Edit
															</Button>
															<Button
																variant="outline"
																size="sm"
																className="h-7 text-xs"
																onClick={() =>
																	handleAddRotationForVolunteer(membershipId)
																}
															>
																<Plus className="mr-1 h-3 w-3" />
																Add Rotation
															</Button>
															<Button
																variant="outline"
																size="icon"
																className="h-7 w-7 text-destructive hover:bg-destructive hover:text-destructive-foreground"
																onClick={() =>
																	handleDeleteVolunteerRotations(membershipId)
																}
																title="Delete all rotations"
															>
																<Trash2 className="h-3.5 w-3.5" />
															</Button>
														</div>
													</div>

													{/* Expanded individual rotations */}
													{isExpanded && (
														<div className="space-y-1.5 border-t px-3 pb-3 pt-2">
															{volunteerRotations.map((rotation, idx) => {
																const endHeat = Math.min(
																	rotation.startingHeat +
																		rotation.heatsCount -
																		1,
																	heatsCount,
																)
																const isSelected =
																	selectedRotationId === rotation.id

																return (
																	<button
																		key={rotation.id}
																		type="button"
																		onClick={() =>
																			toggleRotationSelection(rotation.id)
																		}
																		className={`flex w-full items-center gap-2 rounded border p-2 text-left transition-all ${
																			isSelected
																				? "border-primary bg-primary/10"
																				: "border-border bg-background hover:bg-muted/50"
																		}`}
																	>
																		<span className="text-xs">
																			<span className="font-medium">
																				Rotation {idx + 1}:
																			</span>{" "}
																			<span className="tabular-nums text-muted-foreground">
																				H{rotation.startingHeat}-{endHeat}, L
																				{rotation.startingLane}
																				{rotation.laneShiftPattern ===
																				"shift_right"
																					? " (shift)"
																					: " (stay)"}
																			</span>
																		</span>
																	</button>
																)
															})}
														</div>
													)}
												</div>
											)
										},
									)}
								</div>
							</>
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
									className="grid gap-0 overflow-hidden rounded-lg border"
									style={{
										gridTemplateColumns: `60px repeat(${heatsCount}, 60px)`,
										gridTemplateRows: `40px 24px repeat(${laneCount}, 40px)`,
									}}
								>
									{/* Header Row - Heat Numbers */}
									<div className="sticky left-0 z-20 flex items-center justify-center border-b border-r bg-muted text-xs font-medium">
										Lane
									</div>
									{Array.from({ length: heatsCount }, (_, i) => i + 1).map(
										(heat) => (
											<div
												key={heat}
												className="flex items-center justify-center border-b border-r bg-muted text-xs font-medium tabular-nums last:border-r-0"
											>
												H{heat}
											</div>
										),
									)}

									{/* Header Row - Heat Times */}
									<div className="sticky left-0 z-20 border-b border-r bg-muted" />
									{heatsWithAssignments.map((heat) => {
										const timeText = heat.scheduledTime
											? heat.scheduledTime.toLocaleTimeString("en-US", {
													hour: "numeric",
													minute: "2-digit",
												})
											: "--"
										return (
											<div
												key={`time-${heat.heatNumber}`}
												className="flex items-center justify-center border-b border-r bg-muted text-xs tabular-nums text-muted-foreground last:border-r-0"
											>
												{timeText}
											</div>
										)
									})}

									{/* Lane Rows */}
									{Array.from({ length: laneCount }, (_, i) => i + 1).map(
										(lane) => (
											<Fragment key={`lane-row-${lane}`}>
												{/* Lane Label */}
												<div className="sticky left-0 z-10 flex items-center justify-center border-b border-r bg-muted text-xs font-medium tabular-nums">
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
													// Highlight if a specific rotation is selected OR if volunteer is selected
													const isHighlighted =
														(selectedRotationId !== null &&
															cellData.rotationIds.includes(
																selectedRotationId,
															)) ||
														selectedVolunteerCells.has(key)
													const previewBlockIndex = previewCellMap.get(key)
													const isPreview = previewBlockIndex !== undefined
													// Check if this cell is part of the rotations being edited
													const isEditingCell = editingRotationCells.has(key)
													// Check if preview cell has a conflict (overlaps with existing assignment
													// that isn't part of the rotations being edited)
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
															previewBlockIndex={previewBlockIndex}
															blockColors={BLOCK_COLORS}
															isPreviewConflict={isPreviewConflict}
															isEditingCell={isEditingCell}
															minHeatBuffer={minHeatBuffer}
															onClick={() => handleCellClick(heat, lane)}
															onRotationDrop={(rotation) =>
																handleRotationDrop(rotation, heat, lane)
															}
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
						<div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
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
								<div className="h-4 w-4 rounded border bg-neutral-200 dark:bg-neutral-800 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(0,0,0,0.15)_2px,rgba(0,0,0,0.15)_4px)]" />
								<span className="text-muted-foreground">No Athlete</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="h-4 w-4 rounded border bg-primary/60 ring-2 ring-primary" />
								<span className="text-muted-foreground">Selected</span>
							</div>
							{isEditorOpen && (
								<>
									{BLOCK_COLORS.slice(
										0,
										Math.min(
											previewCells.length > 0
												? Math.max(...previewCells.map((c) => c.blockIndex)) + 1
												: 1,
											BLOCK_COLORS.length,
										),
									).map((color) => (
										<div key={color.bg} className="flex items-center gap-2">
											<div
												className={`h-4 w-4 rounded border-2 border-dashed ${color.bg} ${color.border}`}
											/>
											<span className="text-muted-foreground">
												Block {BLOCK_COLORS.indexOf(color) + 1}
											</span>
										</div>
									))}
									<div className="flex items-center gap-2">
										<div className="h-4 w-4 rounded border-2 border-dashed border-red-500 bg-red-500/40" />
										<span className="text-muted-foreground">Conflict</span>
									</div>
									{editingVolunteerId && (
										<>
											<div className="flex items-center gap-2">
												<div className="h-4 w-4 rounded border bg-background ring-2 ring-emerald-500" />
												<span className="text-muted-foreground">
													Current Assignment
												</span>
											</div>
											<div className="flex items-center gap-2">
												<div className="h-4 w-4 rounded border-2 border-amber-500/40 bg-amber-500/20" />
												<span className="text-muted-foreground">
													Buffer Zone ({minHeatBuffer} heat gap)
												</span>
											</div>
										</>
									)}
								</>
							)}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete all rotations?</AlertDialogTitle>
						<AlertDialogDescription>
							This will remove all rotations for{" "}
							{deletingVolunteerId
								? getJudgeName(deletingVolunteerId)
								: "this judge"}{" "}
							from this event. This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmDeleteVolunteerRotations}
							disabled={isDeleting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Adjust Unassigned Lanes Confirmation Dialog */}
			<AlertDialog
				open={clearUnassignedOpen}
				onOpenChange={setClearUnassignedOpen}
			>
				<AlertDialogContent className="max-w-lg">
					<AlertDialogHeader>
						<AlertDialogTitle>Adjust rotations to skip unassigned lanes?</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div className="space-y-3">
								<p>
									The following {rotationsOnUnassignedLanes.length} rotation
									{rotationsOnUnassignedLanes.length > 1 ? "s" : ""} will be
									adjusted to only cover lanes with athletes:
								</p>
								<div className="max-h-48 overflow-y-auto rounded-md border bg-muted/50 p-2">
									{rotationsOnUnassignedLanes.map(
										({ rotation, judgeName, unassignedSlots }) => (
											<div
												key={rotation.id}
												className="border-b py-2 last:border-b-0"
											>
												<div className="font-medium text-foreground">
													{judgeName}
												</div>
												<div className="text-xs text-muted-foreground">
													Heats {rotation.startingHeat}-
													{rotation.startingHeat + rotation.heatsCount - 1}, Lane{" "}
													{rotation.startingLane}
												</div>
												<div className="mt-1 text-xs text-orange-600 dark:text-orange-400">
													Will skip:{" "}
													{unassignedSlots
														.map((s) => `H${s.heat}L${s.lane}`)
														.join(", ")}
												</div>
											</div>
										),
									)}
								</div>
								<p className="text-sm text-muted-foreground">
									Rotations may be split into multiple smaller rotations to skip
									the unassigned slots.
								</p>
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isClearingUnassigned}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={confirmAdjustUnassignedLanes}
							disabled={isClearingUnassigned}
						>
							{isClearingUnassigned && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							Adjust {rotationsOnUnassignedLanes.length} rotation
							{rotationsOnUnassignedLanes.length > 1 ? "s" : ""}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}

interface TimelineCellProps {
	heat: number
	lane: number
	status: "empty" | "covered" | "overlap" | "buffer-blocked" | "unavailable"
	isHighlighted: boolean
	isPreview: boolean
	/** Block index for preview cells (used for coloring) */
	previewBlockIndex?: number
	/** Color palette for blocks */
	blockColors: Array<{ bg: string; border: string }>
	/** True if this preview cell conflicts with an existing assignment */
	isPreviewConflict: boolean
	/** True if this cell is part of the rotations currently being edited */
	isEditingCell: boolean
	/** Minimum heat buffer (for tooltip) */
	minHeatBuffer: number
	onClick: () => void
	/** Handler for when a rotation is dropped on this cell */
	onRotationDrop: (rotation: CompetitionJudgeRotation) => void
}

function TimelineCell({
	heat: _heat,
	lane: _lane,
	status,
	isHighlighted,
	isPreview,
	previewBlockIndex,
	blockColors,
	isPreviewConflict,
	isEditingCell,
	minHeatBuffer,
	onClick,
	onRotationDrop,
}: TimelineCellProps) {
	const ref = useRef<HTMLButtonElement>(null)
	const [isDraggedOver, setIsDraggedOver] = useState(false)

	// Skip drop target registration and interaction for unavailable cells
	const isUnavailable = status === "unavailable"

	useEffect(() => {
		if (isUnavailable) return

		const element = ref.current
		if (!element) return

		return dropTargetForElements({
			element,
			canDrop: ({ source }) => source.data.type === "rotation",
			onDragEnter: () => setIsDraggedOver(true),
			onDragLeave: () => setIsDraggedOver(false),
			onDrop: ({ source }) => {
				setIsDraggedOver(false)
				const rotation = source.data.rotation as
					| CompetitionJudgeRotation
					| undefined
				if (rotation) {
					onRotationDrop(rotation)
				}
			},
		})
	}, [onRotationDrop, isUnavailable])

	// Determine background class based on status, highlight, preview, and editing state
	let bgClass: string
	let title: string | undefined

	if (isUnavailable) {
		// Unavailable cell - dark with diagonal stripes, non-interactive
		bgClass =
			"bg-neutral-200 dark:bg-neutral-800 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.1)_4px,rgba(0,0,0,0.1)_8px)] dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.1)_4px,rgba(255,255,255,0.1)_8px)] cursor-not-allowed"
		title = "No athlete assigned"
	} else if (isPreviewConflict) {
		// Preview cell that conflicts with existing assignment - RED
		bgClass = "bg-red-500/40 border-dashed border-2 border-red-500"
		title = "Conflict: Heat already assigned"
	} else if (isPreview && previewBlockIndex !== undefined) {
		// Preview cells without conflict - use block-specific color
		const colors = blockColors[previewBlockIndex % blockColors.length] ?? {
			bg: "bg-blue-500/30",
			border: "border-blue-500",
		}
		bgClass = `${colors.bg} border-dashed border-2 ${colors.border}`
		title = `Preview: Block ${previewBlockIndex + 1}`
	} else if (isEditingCell) {
		// Cells currently covered by the rotations being edited - outline style (no fill)
		bgClass = "bg-background ring-2 ring-inset ring-emerald-500"
		title = "Current assignment"
	} else if (isHighlighted) {
		bgClass = "bg-primary/50 ring-2 ring-inset ring-primary"
		title = "Selected rotation"
	} else if (status === "buffer-blocked") {
		// Buffer zone - amber with diagonal stripes pattern
		bgClass = "bg-amber-500/20 border-amber-500/40 border-2"
		title = `Buffer zone: Requires ${minHeatBuffer} heat gap between rotations`
	} else if (status === "empty") {
		bgClass = "bg-background hover:bg-muted/50"
	} else if (status === "covered") {
		bgClass = "bg-emerald-500/30"
		title = "Covered"
	} else {
		bgClass = "bg-amber-500/30"
		title = "Overlap: Multiple judges assigned"
	}

	return (
		<button
			ref={ref}
			type="button"
			onClick={isUnavailable ? undefined : onClick}
			title={title}
			disabled={isUnavailable}
			className={`border-b border-r transition-colors last:border-r-0 ${bgClass} ${
				isDraggedOver ? "ring-2 ring-inset ring-blue-500" : ""
			} ${isUnavailable ? "" : "cursor-pointer"}`}
		/>
	)
}
