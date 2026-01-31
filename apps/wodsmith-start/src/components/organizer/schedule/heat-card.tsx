"use client"

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine"
import {
	draggable,
	dropTargetForElements,
	type ElementDropTargetEventBasePayload,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview"
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview"
import {
	attachClosestEdge,
	type Edge,
	extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge"
import { DragHandleButton } from "@atlaskit/pragmatic-drag-and-drop-react-accessibility/drag-handle-button"
import { DropIndicator } from "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box"
import {
	ChevronDown,
	ChevronRight,
	Clock,
	GripVertical,
	Loader2,
	MapPin,
	Pencil,
	Plus,
	Trash2,
	X,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	assignToHeatFn,
	bulkAssignToHeatFn,
	type HeatWithAssignments,
	moveAssignmentFn,
	removeFromHeatFn,
	updateHeatFn,
} from "@/server-fns/competition-heats-fns"

interface Registration {
	id: string
	teamName: string | null
	user: {
		id: string
		firstName: string | null
		lastName: string | null
	}
	division: {
		id: string
		label: string
	} | null
}

interface DroppableLaneProps {
	laneNum: number
	onDropUnassigned: (
		registrationIds: string[],
		laneNumber: number,
		divisionName?: string,
	) => void
	onDropAssigned: (
		assignmentId: string,
		sourceHeatId: string,
		laneNumber: number,
		assignment: HeatWithAssignments["assignments"][0],
	) => void
	selectedAthleteIds?: Set<string>
	onTapAssign?: (laneNumber: number) => void
}

function DroppableLane({
	laneNum,
	onDropUnassigned,
	onDropAssigned,
	selectedAthleteIds,
	onTapAssign,
}: DroppableLaneProps) {
	const ref = useRef<HTMLDivElement>(null)
	const [isDraggedOver, setIsDraggedOver] = useState(false)
	const [isDivisionOver, setIsDivisionOver] = useState(false)
	const hasSelection = selectedAthleteIds && selectedAthleteIds.size > 0

	function handleClick() {
		if (hasSelection && onTapAssign) {
			onTapAssign(laneNum)
		}
	}

	useEffect(() => {
		const element = ref.current
		if (!element) return

		return dropTargetForElements({
			element,
			canDrop: ({ source }) =>
				source.data.type === "athlete" ||
				source.data.type === "assigned" ||
				source.data.type === "division",
			onDragEnter: ({ source }) => {
				if (source.data.type === "division") {
					setIsDivisionOver(true)
				} else {
					setIsDraggedOver(true)
				}
			},
			onDragLeave: () => {
				setIsDraggedOver(false)
				setIsDivisionOver(false)
			},
			onDrop: ({ source }) => {
				setIsDraggedOver(false)
				setIsDivisionOver(false)

				if (source.data.type === "division") {
					// Division drop
					const registrationIds = source.data.registrationIds as
						| string[]
						| undefined
					const divisionName = source.data.divisionName as string | undefined
					if (registrationIds && Array.isArray(registrationIds)) {
						onDropUnassigned(registrationIds, laneNum, divisionName)
					}
				} else if (source.data.type === "assigned") {
					// Moving an already assigned athlete
					const assignmentId = source.data.assignmentId as string
					const sourceHeatId = source.data.heatId as string
					const assignment = source.data
						.assignment as HeatWithAssignments["assignments"][0]
					if (assignmentId && sourceHeatId && assignment) {
						onDropAssigned(assignmentId, sourceHeatId, laneNum, assignment)
					}
				} else {
					// Dropping unassigned athlete(s)
					const registrationIds = source.data.registrationIds as
						| string[]
						| undefined
					if (registrationIds && Array.isArray(registrationIds)) {
						onDropUnassigned(registrationIds, laneNum)
					}
				}
			},
		})
	}, [laneNum, onDropUnassigned, onDropAssigned])

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if ((e.key === "Enter" || e.key === " ") && hasSelection) {
			e.preventDefault()
			handleClick()
		}
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: drop target with conditional click handler
		<div
			ref={ref}
			role={hasSelection ? "button" : undefined}
			tabIndex={hasSelection ? 0 : undefined}
			onClick={handleClick}
			onKeyDown={hasSelection ? handleKeyDown : undefined}
			className={`flex items-center gap-3 py-1 border-b border-border/50 last:border-0 transition-colors ${
				isDraggedOver || isDivisionOver
					? "bg-primary/10 border-primary rounded"
					: ""
			} ${hasSelection ? "cursor-pointer hover:bg-primary/5" : ""}`}
		>
			{/* Spacer to align with grip handle in assigned rows - hidden on mobile */}
			<div className="hidden md:block h-3 w-3" />
			<span className="w-6 text-sm text-muted-foreground tabular-nums">
				L{laneNum}
			</span>
			<span
				className={`flex-1 text-sm ${
					isDraggedOver || isDivisionOver
						? "text-primary font-medium"
						: hasSelection
							? "text-primary/70"
							: "text-muted-foreground"
				}`}
			>
				{isDraggedOver || isDivisionOver
					? "Drop here"
					: hasSelection
						? "Tap to assign"
						: "Empty"}
			</span>
		</div>
	)
}

interface DraggableAssignedAthleteProps {
	assignment: HeatWithAssignments["assignments"][0]
	heatId: string
	laneNum: number
	onRemove: () => void
	isRemoving: boolean
}

function DraggableAssignedAthlete({
	assignment,
	heatId,
	laneNum,
	onRemove,
	isRemoving,
}: DraggableAssignedAthleteProps) {
	const ref = useRef<HTMLDivElement>(null)
	const [isDragging, setIsDragging] = useState(false)

	const displayName =
		assignment.registration.teamName ??
		(`${assignment.registration.user.firstName ?? ""} ${assignment.registration.user.lastName ?? ""}`.trim() ||
			"Unknown")

	useEffect(() => {
		const element = ref.current
		if (!element) return

		return draggable({
			element,
			getInitialData: () => ({
				type: "assigned",
				assignmentId: assignment.id,
				heatId,
				registrationId: assignment.registration.id,
				displayName,
				laneNumber: laneNum,
				// Include full assignment for cross-heat moves
				assignment: {
					id: assignment.id,
					laneNumber: laneNum,
					registration: assignment.registration,
				},
			}),
			onDragStart: () => setIsDragging(true),
			onDrop: () => setIsDragging(false),
			onGenerateDragPreview({ nativeSetDragImage }) {
				setCustomNativeDragPreview({
					nativeSetDragImage,
					getOffset: pointerOutsideOfPreview({ x: "16px", y: "8px" }),
					render({ container }) {
						const preview = document.createElement("div")
						preview.style.cssText = `
							background: hsl(var(--background));
							border: 2px solid hsl(var(--primary));
							border-radius: 6px;
							padding: 8px 12px;
							font-size: 14px;
							color: hsl(var(--foreground));
							box-shadow: 0 4px 12px rgba(0,0,0,0.25);
						`
						preview.textContent = displayName
						container.appendChild(preview)
					},
				})
			},
		})
	}, [
		assignment.id,
		heatId,
		assignment.registration.id,
		displayName,
		laneNum,
		assignment.registration,
	])

	return (
		<div
			ref={ref}
			className={`flex items-center gap-3 py-1 border-b border-border/50 last:border-0 ${
				isDragging ? "opacity-50" : ""
			}`}
		>
			<GripVertical className="hidden md:block h-3 w-3 text-muted-foreground cursor-grab active:cursor-grabbing" />
			<span className="w-6 text-sm text-muted-foreground tabular-nums">
				L{laneNum}
			</span>
			<span className="flex-1 text-sm">{displayName}</span>
			{assignment.registration.division && (
				<Badge variant="outline" className="text-xs">
					{assignment.registration.division.label}
				</Badge>
			)}
			<Button
				variant="ghost"
				size="icon"
				className="h-6 w-6"
				onClick={onRemove}
				disabled={isRemoving}
			>
				<X className="h-3 w-3" />
			</Button>
		</div>
	)
}

interface HeatCardProps {
	heat: HeatWithAssignments
	competitionId: string
	organizingTeamId: string
	unassignedRegistrations: Registration[]
	maxLanes: number
	onDelete: () => void
	onAssignmentChange: (assignments: HeatWithAssignments["assignments"]) => void
	onHeatUpdate?: (updates: {
		heatNumber?: number
		scheduledTime?: Date | null
		durationMinutes?: number | null
	}) => void
	onMoveAssignment?: (
		assignmentId: string,
		sourceHeatId: string,
		targetHeatId: string,
		targetLane: number,
		assignment: HeatWithAssignments["assignments"][0],
	) => void
	selectedAthleteIds?: Set<string>
	onClearSelection?: () => void
	index?: number
	instanceId?: symbol
	onReorder?: (sourceIndex: number, targetIndex: number) => void
}

export function HeatCard({
	heat,
	competitionId: _competitionId,
	organizingTeamId: _organizingTeamId,
	unassignedRegistrations,
	maxLanes,
	onDelete,
	onAssignmentChange,
	onHeatUpdate,
	onMoveAssignment,
	selectedAthleteIds,
	onClearSelection,
	index,
	instanceId,
	onReorder,
}: HeatCardProps) {
	const [isAssignOpen, setIsAssignOpen] = useState(false)
	const [selectedRegistrationId, setSelectedRegistrationId] =
		useState<string>("")
	const [selectedLane, setSelectedLane] = useState<number>(1)

	// Edit heat state
	const [isEditOpen, setIsEditOpen] = useState(false)
	const [editHeatNumber, setEditHeatNumber] = useState<string>("")
	const [editScheduledTime, setEditScheduledTime] = useState<string>("")
	const [editDuration, setEditDuration] = useState<string>("")

	// Loading states
	const [isAssigning, setIsAssigning] = useState(false)
	const [isRemoving, setIsRemoving] = useState(false)
	const [_isMoving, setIsMoving] = useState(false)
	const [isUpdating, setIsUpdating] = useState(false)

	// Drag-and-drop refs and state for heat reordering
	const heatRef = useRef<HTMLDivElement>(null)
	const dragHandleRef = useRef<HTMLButtonElement>(null)
	const [isDraggingHeat, setIsDraggingHeat] = useState(false)
	const [closestEdge, setClosestEdge] = useState<Edge | null>(null)
	const closestEdgeRef = useRef<Edge | null>(null)

	// Wrap in useCallback for drag-drop skill pattern
	const updateClosestEdge = useCallback((edge: Edge | null) => {
		closestEdgeRef.current = edge
		setClosestEdge(edge)
	}, [])

	// Get occupied lanes
	const occupiedLanes = new Set(heat.assignments.map((a) => a.laneNumber))

	// Get available lanes
	const availableLanes = Array.from(
		{ length: maxLanes },
		(_, i) => i + 1,
	).filter((lane) => !occupiedLanes.has(lane))

	const isFull = heat.assignments.length >= maxLanes
	const [isExpanded, setIsExpanded] = useState(!isFull)

	// Format time
	function formatTime(date: Date | null): string {
		if (!date) return "No time set"
		return new Date(date).toLocaleString(undefined, {
			dateStyle: "short",
			timeStyle: "short",
		})
	}

	async function handleAssign() {
		if (!selectedRegistrationId || !selectedLane) return

		setIsAssigning(true)
		try {
			// Call server function to persist assignment
			const result = await assignToHeatFn({
				data: {
					heatId: heat.id,
					registrationId: selectedRegistrationId,
					laneNumber: selectedLane,
				},
			})

			// Find the registration data for optimistic update
			const reg = unassignedRegistrations.find(
				(r) => r.id === selectedRegistrationId,
			)
			if (reg && result.assignment) {
				const newAssignment = {
					id: result.assignment.id,
					laneNumber: selectedLane,
					registration: {
						id: reg.id,
						teamName: reg.teamName,
						user: reg.user,
						division: reg.division,
						affiliate: null,
					},
				}
				onAssignmentChange([...heat.assignments, newAssignment])
			}
			setIsAssignOpen(false)
			setSelectedRegistrationId("")
			// Auto-select next available lane
			const nextLane =
				availableLanes.find((l) => l > selectedLane) ?? availableLanes[0]
			setSelectedLane(nextLane ?? 1)
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to assign athlete"
			toast.error(message)
		} finally {
			setIsAssigning(false)
		}
	}

	async function handleRemove(assignmentId: string) {
		setIsRemoving(true)
		try {
			// Call server function to persist removal
			await removeFromHeatFn({
				data: {
					assignmentId,
				},
			})

			onAssignmentChange(heat.assignments.filter((a) => a.id !== assignmentId))
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to remove athlete"
			toast.error(message)
		} finally {
			setIsRemoving(false)
		}
	}

	async function handleDropAssign(
		registrationIds: string[],
		startLane: number,
		divisionName?: string,
	) {
		// Filter to only IDs that exist in unassigned and limit to available lanes
		const validIds = registrationIds.filter((id) =>
			unassignedRegistrations.some((r) => r.id === id),
		)

		if (validIds.length === 0) return

		// Get available lanes starting from startLane
		const lanesToUse = availableLanes
			.filter((l) => l >= startLane)
			.concat(availableLanes.filter((l) => l < startLane))
			.slice(0, validIds.length)

		if (lanesToUse.length === 0) return

		// Limit to available lanes
		const idsToAssign = validIds.slice(0, lanesToUse.length)
		const firstLane = lanesToUse[0]
		if (firstLane === undefined) return

		try {
			// Call server function to persist bulk assignment
			const result = await bulkAssignToHeatFn({
				data: {
					heatId: heat.id,
					registrationIds: idsToAssign,
					startingLane: firstLane,
				},
			})

			// Build new assignments from server response and registrations
			const newAssignments = result.assignments
				.map((serverAssignment) => {
					const reg = unassignedRegistrations.find(
						(r) => r.id === serverAssignment.registrationId,
					)
					if (!reg) return null
					return {
						id: serverAssignment.id,
						laneNumber: serverAssignment.laneNumber,
						registration: {
							id: reg.id,
							teamName: reg.teamName,
							user: reg.user,
							division: reg.division,
							affiliate: null,
						},
					}
				})
				.filter(Boolean) as HeatWithAssignments["assignments"]

			onAssignmentChange([...heat.assignments, ...newAssignments])

			// Show toast for division bulk assignment
			if (divisionName) {
				toast.success(
					`Assigned ${newAssignments.length} athlete${newAssignments.length !== 1 ? "s" : ""} from ${divisionName}`,
				)
			}

			// Clear selection after successful drop
			onClearSelection?.()
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to assign athletes"
			toast.error(message)
		}
	}

	async function handleDropAssigned(
		assignmentId: string,
		sourceHeatId: string,
		targetLane: number,
		assignment: HeatWithAssignments["assignments"][0],
	) {
		// If lane is occupied in this heat by someone else, don't allow
		const existingInLane = heat.assignments.find(
			(a) => a.laneNumber === targetLane && a.id !== assignmentId,
		)
		if (existingInLane) {
			return
		}

		setIsMoving(true)
		try {
			// Call server function to persist the move
			await moveAssignmentFn({
				data: {
					assignmentId,
					targetHeatId: heat.id,
					targetLaneNumber: targetLane,
				},
			})

			// If moving within same heat, just update lane
			if (sourceHeatId === heat.id) {
				// Update local state
				onAssignmentChange(
					heat.assignments.map((a) =>
						a.id === assignmentId ? { ...a, laneNumber: targetLane } : a,
					),
				)
			} else {
				// Cross-heat move
				if (onMoveAssignment) {
					// Let parent handle state updates for both heats
					onMoveAssignment(
						assignmentId,
						sourceHeatId,
						heat.id,
						targetLane,
						assignment,
					)
				}
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to move athlete"
			toast.error(message)
		} finally {
			setIsMoving(false)
		}
	}

	function openEditDialog() {
		setEditHeatNumber(heat.heatNumber.toString())
		// Format the current scheduled time for datetime-local input
		if (heat.scheduledTime) {
			const date = new Date(heat.scheduledTime)
			// Format as YYYY-MM-DDTHH:mm for datetime-local input
			const localDateTime = new Date(
				date.getTime() - date.getTimezoneOffset() * 60000,
			)
				.toISOString()
				.slice(0, 16)
			setEditScheduledTime(localDateTime)
		} else {
			setEditScheduledTime("")
		}
		setEditDuration(heat.durationMinutes?.toString() ?? "")
		setIsEditOpen(true)
	}

	async function handleUpdateHeat() {
		setIsUpdating(true)
		try {
			const heatNumber = editHeatNumber ? Number(editHeatNumber) : undefined
			const scheduledTime = editScheduledTime
				? new Date(editScheduledTime)
				: null
			const durationMinutes = editDuration ? Number(editDuration) : null

			await updateHeatFn({
				data: {
					heatId: heat.id,
					heatNumber,
					scheduledTime,
					durationMinutes,
				},
			})

			// Call parent callback to update local state
			onHeatUpdate?.({ heatNumber, scheduledTime, durationMinutes })
			setIsEditOpen(false)
			toast.success("Heat updated")
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to update heat"
			toast.error(message)
		} finally {
			setIsUpdating(false)
		}
	}

	// Heat reordering drag-drop effect
	useEffect(() => {
		const element = heatRef.current
		const dragHandle = dragHandleRef.current
		if (
			!element ||
			!dragHandle ||
			index === undefined ||
			!instanceId ||
			!onReorder
		)
			return

		const heatData = {
			heatId: heat.id,
			heatNumber: heat.heatNumber,
			index,
			instanceId,
		}

		function onChange({ source, self }: ElementDropTargetEventBasePayload) {
			const isSource = source.element === dragHandle
			if (isSource) {
				updateClosestEdge(null)
				return
			}

			const edge = extractClosestEdge(self.data)
			const sourceIndex = source.data.index
			if (typeof sourceIndex !== "number") return

			const isItemBeforeSource = index === sourceIndex - 1
			const isItemAfterSource = index === sourceIndex + 1

			const isDropIndicatorHidden =
				(isItemBeforeSource && edge === "bottom") ||
				(isItemAfterSource && edge === "top")

			if (isDropIndicatorHidden) {
				updateClosestEdge(null)
				return
			}

			updateClosestEdge(edge)
		}

		return combine(
			draggable({
				element: dragHandle,
				getInitialData: () => heatData,
				onGenerateDragPreview({ nativeSetDragImage }) {
					setCustomNativeDragPreview({
						nativeSetDragImage,
						getOffset: pointerOutsideOfPreview({ x: "16px", y: "8px" }),
						render({ container }) {
							const preview = document.createElement("div")
							preview.style.cssText = `
								background: hsl(var(--background));
								border: 2px solid hsl(var(--primary));
								border-radius: 6px;
								padding: 8px 12px;
								font-size: 14px;
								color: hsl(var(--foreground));
								box-shadow: 0 4px 12px rgba(0,0,0,0.25);
								font-weight: 600;
							`
							preview.textContent = `Heat ${heat.heatNumber}`
							container.appendChild(preview)
						},
					})
				},
				onDragStart: () => setIsDraggingHeat(true),
				onDrop: () => setIsDraggingHeat(false),
			}),
			dropTargetForElements({
				element,
				canDrop: ({ source }) =>
					source.data &&
					"heatId" in source.data &&
					"instanceId" in source.data &&
					source.data.instanceId === instanceId,
				getData({ input }) {
					return attachClosestEdge(heatData, {
						element,
						input,
						allowedEdges: ["top", "bottom"],
					})
				},
				onDragEnter: onChange,
				onDrag: onChange,
				onDragLeave: () => updateClosestEdge(null),
				onDrop: ({ source }) => {
					updateClosestEdge(null)
					const sourceIndex = source.data.index
					if (typeof sourceIndex === "number" && sourceIndex !== index) {
						const edge = closestEdgeRef.current
						const targetIndex = edge === "top" ? index : index + 1
						const adjustedTargetIndex =
							sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
						onReorder(sourceIndex, adjustedTargetIndex)
					}
				},
			}),
		)
	}, [
		heat.id,
		heat.heatNumber,
		index,
		instanceId,
		onReorder,
		updateClosestEdge,
	])

	// Group assignments by division for collapsed view
	const assignmentsByDivision = heat.assignments.reduce(
		(acc, assignment) => {
			const divLabel = assignment.registration.division?.label ?? "No Division"
			acc[divLabel] = (acc[divLabel] ?? 0) + 1
			return acc
		},
		{} as Record<string, number>,
	)

	// Collapsed view for full heats
	if (!isExpanded) {
		return (
			<div ref={heatRef} className="relative">
				{closestEdge && <DropIndicator edge={closestEdge} gap="2px" />}
				<Card
					className={`cursor-pointer hover:bg-muted/50 transition-colors ${
						isDraggingHeat ? "opacity-50" : ""
					}`}
					onClick={() => setIsExpanded(true)}
				>
					<CardHeader className="py-3">
						<div className="flex items-center gap-3">
							{onReorder && (
								// Stop propagation to prevent Card onClick from firing during drag
								// biome-ignore lint/a11y/useKeyWithClickEvents: wrapper only stops propagation
								<div onClick={(e) => e.stopPropagation()}>
									<DragHandleButton
										ref={dragHandleRef}
										label={`Reorder Heat ${heat.heatNumber}`}
									/>
								</div>
							)}
							<ChevronRight className="h-4 w-4 text-muted-foreground" />
							<CardTitle className="text-base">
								Heat <span className="tabular-nums">{heat.heatNumber}</span>
							</CardTitle>
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								{heat.scheduledTime && (
									<span className="flex items-center gap-1">
										<Clock className="h-3 w-3" />
										{formatTime(heat.scheduledTime)}
									</span>
								)}
								{heat.venue && (
									<span className="flex items-center gap-1">
										<MapPin className="h-3 w-3" />
										{heat.venue.name}
									</span>
								)}
							</div>
							<Badge
								variant={isFull ? "default" : "outline"}
								className="text-xs tabular-nums"
							>
								{heat.assignments.length}/{maxLanes}
							</Badge>
							<div className="flex-1" />
							{Object.entries(assignmentsByDivision).map(
								([divLabel, count]) => (
									<Badge key={divLabel} variant="secondary" className="text-xs">
										{divLabel}: {count}
									</Badge>
								),
							)}
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6"
								onClick={(e) => {
									e.stopPropagation()
									openEditDialog()
								}}
							>
								<Pencil className="h-3 w-3" />
							</Button>
						</div>
					</CardHeader>
				</Card>
				{/* Edit Heat Dialog for collapsed view */}
				<Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Edit Heat {heat.heatNumber}</DialogTitle>
						</DialogHeader>
						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="heatNumber-collapsed">Heat Number</Label>
								<Input
									id="heatNumber-collapsed"
									type="number"
									min="1"
									value={editHeatNumber}
									onChange={(e) => setEditHeatNumber(e.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="scheduledTime-collapsed">Scheduled Time</Label>
								<Input
									id="scheduledTime-collapsed"
									type="datetime-local"
									value={editScheduledTime}
									onChange={(e) => setEditScheduledTime(e.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="duration-collapsed">Duration (minutes)</Label>
								<Input
									id="duration-collapsed"
									type="number"
									min="1"
									max="180"
									placeholder="e.g. 10"
									value={editDuration}
									onChange={(e) => setEditDuration(e.target.value)}
								/>
							</div>
							<div className="flex justify-end gap-2">
								<Button
									variant="outline"
									onClick={() => setIsEditOpen(false)}
								>
									Cancel
								</Button>
								<Button onClick={handleUpdateHeat} disabled={isUpdating}>
									{isUpdating && (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									)}
									Save
								</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			</div>
		)
	}

	return (
		<div ref={heatRef} className="relative">
			{closestEdge && <DropIndicator edge={closestEdge} gap="2px" />}
			<Card className={isDraggingHeat ? "opacity-50" : ""}>
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							{onReorder && (
								<DragHandleButton
									ref={dragHandleRef}
									label={`Reorder Heat ${heat.heatNumber}`}
								/>
							)}
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6"
								onClick={() => setIsExpanded(false)}
							>
								<ChevronDown className="h-4 w-4" />
							</Button>
							<CardTitle className="text-base">
								Heat <span className="tabular-nums">{heat.heatNumber}</span>
							</CardTitle>
							<Badge
								variant={isFull ? "default" : "outline"}
								className="text-xs tabular-nums"
							>
								{heat.assignments.length}/{maxLanes}
							</Badge>
						</div>
						<div className="flex items-center gap-2">
							{heat.division && (
								<Badge variant="secondary">{heat.division.label}</Badge>
							)}
							<Button variant="ghost" size="icon" onClick={openEditDialog}>
								<Pencil className="h-4 w-4" />
							</Button>
							<Button variant="ghost" size="icon" onClick={onDelete}>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					</div>
					<div className="flex items-center gap-4 text-sm text-muted-foreground">
						{heat.scheduledTime && (
							<span className="flex items-center gap-1">
								<Clock className="h-3 w-3" />
								{formatTime(heat.scheduledTime)}
							</span>
						)}
						{heat.venue && (
							<span className="flex items-center gap-1">
								<MapPin className="h-3 w-3" />
								{heat.venue.name}
							</span>
						)}
					</div>
				</CardHeader>
				<CardContent>
					{/* Lane Assignments */}
					<div className="space-y-2">
						{Array.from({ length: maxLanes }, (_, i) => i + 1).map(
							(laneNum) => {
								const assignment = heat.assignments.find(
									(a) => a.laneNumber === laneNum,
								)

								if (!assignment) {
									return (
										<DroppableLane
											key={laneNum}
											laneNum={laneNum}
											onDropUnassigned={handleDropAssign}
											onDropAssigned={handleDropAssigned}
											selectedAthleteIds={selectedAthleteIds}
											onTapAssign={(lane) => {
												if (selectedAthleteIds && selectedAthleteIds.size > 0) {
													handleDropAssign(Array.from(selectedAthleteIds), lane)
												}
											}}
										/>
									)
								}

								return (
									<DraggableAssignedAthlete
										key={laneNum}
										assignment={assignment}
										heatId={heat.id}
										laneNum={laneNum}
										onRemove={() => handleRemove(assignment.id)}
										isRemoving={isRemoving}
									/>
								)
							},
						)}
					</div>

					{/* Add Athlete Button */}
					{availableLanes.length > 0 && unassignedRegistrations.length > 0 && (
						<Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
							<DialogTrigger asChild>
								<Button variant="outline" size="sm" className="w-full mt-4">
									<Plus className="h-4 w-4 mr-2" />
									Assign Athlete
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>
										Assign Athlete to Heat {heat.heatNumber}
									</DialogTitle>
								</DialogHeader>
								<div className="space-y-4">
									<div>
										{/* biome-ignore lint/a11y/noLabelWithoutControl: Select component handles its own labeling */}
										<label className="text-sm font-medium">Athlete</label>
										<Select
											value={selectedRegistrationId}
											onValueChange={setSelectedRegistrationId}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select an athlete" />
											</SelectTrigger>
											<SelectContent>
												{unassignedRegistrations.map((reg) => (
													<SelectItem key={reg.id} value={reg.id}>
														{reg.teamName ??
															(`${reg.user.firstName ?? ""} ${reg.user.lastName ?? ""}`.trim() ||
																"Unknown")}{" "}
														{reg.division && `(${reg.division.label})`}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div>
										{/* biome-ignore lint/a11y/noLabelWithoutControl: Select component handles its own labeling */}
										<label className="text-sm font-medium">Lane</label>
										<Select
											value={String(selectedLane)}
											onValueChange={(v) => setSelectedLane(Number(v))}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{availableLanes.map((lane) => (
													<SelectItem key={lane} value={String(lane)}>
														Lane {lane}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div className="flex justify-end gap-2">
										<Button
											variant="outline"
											onClick={() => setIsAssignOpen(false)}
										>
											Cancel
										</Button>
										<Button
											onClick={handleAssign}
											disabled={
												!selectedRegistrationId || !selectedLane || isAssigning
											}
										>
											{isAssigning && (
												<Loader2 className="h-4 w-4 mr-2 animate-spin" />
											)}
											Assign
										</Button>
									</div>
								</div>
							</DialogContent>
						</Dialog>
					)}

					{/* Edit Heat Dialog */}
					<Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Edit Heat {heat.heatNumber}</DialogTitle>
							</DialogHeader>
							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="heatNumber">Heat Number</Label>
									<Input
										id="heatNumber"
										type="number"
										min="1"
										value={editHeatNumber}
										onChange={(e) => setEditHeatNumber(e.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="scheduledTime">Scheduled Time</Label>
									<Input
										id="scheduledTime"
										type="datetime-local"
										value={editScheduledTime}
										onChange={(e) => setEditScheduledTime(e.target.value)}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="duration">Duration (minutes)</Label>
									<Input
										id="duration"
										type="number"
										min="1"
										max="180"
										placeholder="e.g. 10"
										value={editDuration}
										onChange={(e) => setEditDuration(e.target.value)}
									/>
								</div>
								<div className="flex justify-end gap-2">
									<Button
										variant="outline"
										onClick={() => setIsEditOpen(false)}
									>
										Cancel
									</Button>
									<Button onClick={handleUpdateHeat} disabled={isUpdating}>
										{isUpdating && (
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										)}
										Save
									</Button>
								</div>
							</div>
						</DialogContent>
					</Dialog>
				</CardContent>
			</Card>
		</div>
	)
}
