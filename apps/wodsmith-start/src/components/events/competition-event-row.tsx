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
import { DropIndicator } from "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box"
import { Link } from "@tanstack/react-router"
import {
	Eye,
	EyeOff,
	GripVertical,
	Pencil,
	SlidersHorizontal,
	Trash2,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { EVENT_STATUS, type EventStatus, type Sponsor } from "@/db/schema"
import {
	type CompetitionWorkout,
	updateCompetitionWorkoutFn,
	updateWorkoutDivisionDescriptionsFn,
} from "@/server-fns/competition-workouts-fns"

interface Division {
	id: string
	label: string
	position: number
	registrationCount: number
}

interface DivisionDescription {
	divisionId: string
	divisionLabel: string
	description: string | null
}

interface CompetitionEventRowProps {
	event: CompetitionWorkout
	index: number
	instanceId: symbol
	competitionId: string
	organizingTeamId: string
	divisions: Division[]
	divisionDescriptions: DivisionDescription[]
	sponsors: Sponsor[]
	onRemove: () => void
	onDrop: (sourceIndex: number, targetIndex: number) => void
}

export function CompetitionEventRow({
	event,
	index,
	instanceId,
	competitionId,
	organizingTeamId,
	divisions,
	divisionDescriptions,
	sponsors,
	onRemove,
	onDrop,
}: CompetitionEventRowProps) {
	const ref = useRef<HTMLDivElement>(null)
	const dragHandleRef = useRef<HTMLButtonElement>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [closestEdge, setClosestEdge] = useState<Edge | null>(null)
	const closestEdgeRef = useRef<Edge | null>(null)
	const nameRef = useRef(event.workout.name)

	// Division editing state
	const sortedDivisions = [...divisions].sort((a, b) => a.position - b.position)
	const [selectedDivisionId, setSelectedDivisionId] = useState<
		string | undefined
	>(sortedDivisions[0]?.id)
	const [localDescriptions, setLocalDescriptions] = useState<
		Record<string, string>
	>(() => {
		const initial: Record<string, string> = {}
		for (const desc of divisionDescriptions) {
			initial[desc.divisionId] = desc.description || ""
		}
		return initial
	})
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
	const [isDescriptionsOpen, setIsDescriptionsOpen] = useState(false)
	const [isSaving, setIsSaving] = useState(false)

	// Event status state
	const [localEventStatus, setLocalEventStatus] = useState<EventStatus>(
		event.eventStatus ?? EVENT_STATUS.DRAFT,
	)
	const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

	// Sync local status when prop changes
	useEffect(() => {
		setLocalEventStatus(event.eventStatus ?? EVENT_STATUS.DRAFT)
	}, [event.eventStatus])

	const handleEventStatusChange = async (newStatus: EventStatus) => {
		const previousStatus = localEventStatus

		// Optimistic update
		setLocalEventStatus(newStatus)
		setIsUpdatingStatus(true)

		try {
			await updateCompetitionWorkoutFn({
				data: {
					trackWorkoutId: event.id,
					teamId: organizingTeamId,
					eventStatus: newStatus,
				},
			})

			toast.success(
				newStatus === EVENT_STATUS.PUBLISHED
					? "Event published"
					: "Event moved to draft",
			)
		} catch (error) {
			// Revert on error
			setLocalEventStatus(previousStatus)
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to update event status",
			)
		} finally {
			setIsUpdatingStatus(false)
		}
	}

	// Sync name ref when prop changes (for drag preview)
	useEffect(() => {
		nameRef.current = event.workout.name
	}, [event.workout.name])

	// Sync local descriptions when props change
	useEffect(() => {
		const newDescriptions: Record<string, string> = {}
		for (const desc of divisionDescriptions) {
			newDescriptions[desc.divisionId] = desc.description || ""
		}
		setLocalDescriptions(newDescriptions)
		setHasUnsavedChanges(false)
	}, [divisionDescriptions])

	const handleDescriptionChange = (value: string) => {
		if (!selectedDivisionId) return
		setLocalDescriptions((prev) => ({
			...prev,
			[selectedDivisionId]: value,
		}))
		setHasUnsavedChanges(true)
	}

	const handleSaveDescription = async () => {
		if (!selectedDivisionId) return

		const descriptionsToSave = divisions.map((div) => ({
			divisionId: div.id,
			description: localDescriptions[div.id]?.trim() || null,
		}))

		setIsSaving(true)

		try {
			await updateWorkoutDivisionDescriptionsFn({
				data: {
					workoutId: event.workoutId,
					teamId: organizingTeamId,
					descriptions: descriptionsToSave,
				},
			})

			toast.success("Division description saved")
			setHasUnsavedChanges(false)
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to save description",
			)
		} finally {
			setIsSaving(false)
		}
	}

	const handleDivisionChange = (divisionId: string) => {
		// Auto-save when switching divisions if there are unsaved changes
		if (hasUnsavedChanges) {
			handleSaveDescription()
		}
		setSelectedDivisionId(divisionId)
	}

	const handleDescriptionBlur = () => {
		if (hasUnsavedChanges) {
			handleSaveDescription()
		}
	}

	useEffect(() => {
		const element = ref.current
		const dragHandle = dragHandleRef.current
		if (!element || !dragHandle) return

		const eventData = {
			id: event.id,
			index,
			instanceId,
		}

		return combine(
			draggable({
				element: dragHandle,
				getInitialData: () => eventData,
				onDragStart: () => setIsDragging(true),
				onDrop: () => setIsDragging(false),
				onGenerateDragPreview({ nativeSetDragImage }) {
					setCustomNativeDragPreview({
						nativeSetDragImage,
						getOffset: pointerOutsideOfPreview({
							x: "16px",
							y: "8px",
						}),
						render({ container }) {
							const preview = document.createElement("div")
							preview.style.cssText = `
								background: hsl(var(--background));
								border: 2px solid hsl(var(--border));
								border-radius: 6px;
								padding: 8px 12px;
								font-size: 14px;
								color: hsl(var(--foreground));
								box-shadow: 0 2px 8px rgba(0,0,0,0.15);
							`
							preview.textContent = nameRef.current || "Event"
							container.appendChild(preview)
						},
					})
				},
			}),
			dropTargetForElements({
				element,
				canDrop: ({ source }) => {
					return (
						source.data.instanceId === instanceId && source.data.index !== index
					)
				},
				getData({ input }) {
					return attachClosestEdge(eventData, {
						element,
						input,
						allowedEdges: ["top", "bottom"],
					})
				},
				onDrag({ source, self }: ElementDropTargetEventBasePayload) {
					const isSource = source.data.index === index
					if (isSource) {
						closestEdgeRef.current = null
						setClosestEdge(null)
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
						closestEdgeRef.current = null
						setClosestEdge(null)
						return
					}

					closestEdgeRef.current = edge
					setClosestEdge(edge)
				},
				onDragLeave: () => {
					closestEdgeRef.current = null
					setClosestEdge(null)
				},
				onDrop({ source }) {
					const sourceIndex = source.data.index
					if (typeof sourceIndex === "number" && sourceIndex !== index) {
						const edge = closestEdgeRef.current
						const targetIndex = edge === "top" ? index : index + 1
						const adjustedTargetIndex =
							sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
						onDrop(sourceIndex, adjustedTargetIndex)
					}
					closestEdgeRef.current = null
					setClosestEdge(null)
				},
			}),
		)
	}, [event.id, index, instanceId, onDrop])

	return (
		<div ref={ref} className="relative">
			{closestEdge && <DropIndicator edge={closestEdge} gap="2px" />}
			<Card className={`${isDragging ? "opacity-50" : ""} group`}>
				<Collapsible
					open={isDescriptionsOpen}
					onOpenChange={setIsDescriptionsOpen}
				>
					<CardContent className="p-4">
						<div className="flex items-center gap-3">
							{/* Drag Handle - subtle, shows more prominently on hover */}
							<button
								ref={dragHandleRef}
								type="button"
								className="cursor-grab active:cursor-grabbing opacity-30 group-hover:opacity-100 transition-opacity p-1 -m-1"
								aria-label="Drag to reorder"
							>
								<GripVertical className="h-5 w-5 text-muted-foreground" />
							</button>

							{/* Event Number */}
							<span className="text-sm font-mono text-muted-foreground w-6">
								#{index + 1}
							</span>

							{/* Event Name */}
							<span className="flex-1 font-medium truncate">
								{event.workout.name}
							</span>

							{/* Scheme badge */}
							{event.workout.scheme && (
								<span className="text-xs bg-muted px-2 py-1 rounded shrink-0">
									{event.workout.scheme}
								</span>
							)}

							{/* Points multiplier badge */}
							{event.pointsMultiplier && event.pointsMultiplier !== 100 && (
								<span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded shrink-0">
									{event.pointsMultiplier / 100}x
								</span>
							)}

							{/* Presented by sponsor badge */}
							{event.sponsorId && (
								<span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 px-2 py-1 rounded shrink-0">
									Presented by{" "}
									{sponsors.find((s) => s.id === event.sponsorId)?.name ??
										"Sponsor"}
								</span>
							)}

							{/* Event Status Toggle */}
							<Select
								value={localEventStatus}
								onValueChange={(value) =>
									handleEventStatusChange(value as EventStatus)
								}
								disabled={isUpdatingStatus}
							>
								<SelectTrigger className="w-[110px] h-8 text-xs">
									<SelectValue>
										<span className="flex items-center gap-1.5">
											{localEventStatus === EVENT_STATUS.PUBLISHED ? (
												<Eye className="h-3.5 w-3.5 text-green-600" />
											) : (
												<EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
											)}
											{localEventStatus === EVENT_STATUS.PUBLISHED
												? "Published"
												: "Draft"}
										</span>
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={EVENT_STATUS.DRAFT}>
										<span className="flex items-center gap-2">
											<EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
											Draft
										</span>
									</SelectItem>
									<SelectItem value={EVENT_STATUS.PUBLISHED}>
										<span className="flex items-center gap-2">
											<Eye className="h-3.5 w-3.5 text-green-600" />
											Published
										</span>
									</SelectItem>
								</SelectContent>
							</Select>

							{/* Actions */}
							<div className="flex items-center gap-1 shrink-0">
								{/* Division Descriptions Toggle */}
								{sortedDivisions.length > 0 && (
									<CollapsibleTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className={`text-muted-foreground hover:text-foreground ${isDescriptionsOpen ? "bg-muted" : ""}`}
										>
											<SlidersHorizontal className="h-4 w-4" />
										</Button>
									</CollapsibleTrigger>
								)}
								<Button
									variant="ghost"
									size="icon"
									asChild
									className="text-muted-foreground hover:text-foreground"
								>
									<Link
										to="/compete/organizer/$competitionId/events/$eventId"
										params={{
											competitionId: competitionId,
											eventId: event.id,
										}}
									>
										<Pencil className="h-4 w-4" />
									</Link>
								</Button>
								<Button
									variant="ghost"
									size="icon"
									onClick={onRemove}
									className="text-muted-foreground hover:text-destructive"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						</div>

						{/* Division Scaling Descriptions - Collapsible Content */}
						{sortedDivisions.length > 0 && (
							<CollapsibleContent className="pt-4 mt-4 border-t space-y-3 max-w-[75ch]">
								<div className="flex items-center gap-2">
									<Tabs
										value={selectedDivisionId}
										onValueChange={handleDivisionChange}
									>
										<TabsList className="w-fit justify-start flex-wrap h-auto gap-1">
											{sortedDivisions.map((division) => (
												<TabsTrigger
													key={division.id}
													value={division.id}
													className="text-xs"
													disabled={isSaving}
												>
													{division.label}
												</TabsTrigger>
											))}
										</TabsList>
									</Tabs>
									{hasUnsavedChanges && (
										<span className="text-xs text-muted-foreground italic shrink-0">
											Unsaved
										</span>
									)}
									{isSaving && (
										<span className="text-xs text-muted-foreground italic shrink-0">
											Saving...
										</span>
									)}
								</div>
								<Textarea
									value={
										selectedDivisionId
											? localDescriptions[selectedDivisionId] || ""
											: ""
									}
									onChange={(e) => handleDescriptionChange(e.target.value)}
									onBlur={handleDescriptionBlur}
									placeholder={`Enter scaling description for ${sortedDivisions.find((d) => d.id === selectedDivisionId)?.label || "this division"}...`}
									rows={10}
									className="text-sm"
									disabled={!selectedDivisionId}
								/>
							</CollapsibleContent>
						)}
					</CardContent>
				</Collapsible>
			</Card>
		</div>
	)
}
