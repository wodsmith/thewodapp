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
import { GripVertical, Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { CompetitionWorkout } from "@/server/competition-workouts"

interface CompetitionEventRowProps {
	event: CompetitionWorkout
	index: number
	instanceId: symbol
	competitionId: string
	onNameSave: (name: string) => void
	onRemove: () => void
	onDrop: (sourceIndex: number, targetIndex: number) => void
}

export function CompetitionEventRow({
	event,
	index,
	instanceId,
	competitionId,
	onNameSave,
	onRemove,
	onDrop,
}: CompetitionEventRowProps) {
	const ref = useRef<HTMLDivElement>(null)
	const dragHandleRef = useRef<HTMLButtonElement>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [closestEdge, setClosestEdge] = useState<Edge | null>(null)
	const closestEdgeRef = useRef<Edge | null>(null)
	const [localName, setLocalName] = useState(event.workout.name)
	const nameRef = useRef(event.workout.name)

	// Sync local state when prop changes
	useEffect(() => {
		setLocalName(event.workout.name)
		nameRef.current = event.workout.name
	}, [event.workout.name])

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

	const handleNameBlur = () => {
		if (localName !== event.workout.name && localName.trim()) {
			onNameSave(localName.trim())
		} else if (!localName.trim()) {
			setLocalName(event.workout.name)
		}
	}

	return (
		<div ref={ref} className="relative">
			{closestEdge && <DropIndicator edge={closestEdge} gap="2px" />}
			<Card className={isDragging ? "opacity-50" : ""}>
				<CardContent className="p-4">
					<div className="flex items-center gap-4">
						{/* Drag Handle */}
						<button
							ref={dragHandleRef}
							type="button"
							className="cursor-grab active:cursor-grabbing"
							aria-label="Drag to reorder"
						>
							<GripVertical className="h-4 w-4 text-muted-foreground" />
						</button>

						{/* Event Number */}
						<div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0">
							{index + 1}
						</div>

						{/* Editable Name */}
						<Input
							value={localName}
							onChange={(e) => setLocalName(e.target.value)}
							onBlur={handleNameBlur}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.currentTarget.blur()
								}
							}}
							className="flex-1 font-medium"
							placeholder="Event name"
						/>

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

						{/* Actions */}
						<div className="flex items-center gap-1 shrink-0">
							<Button
								variant="ghost"
								size="icon"
								asChild
								className="text-muted-foreground hover:text-foreground"
							>
								<Link href={`/compete/organizer/${competitionId}/events/${event.id}`}>
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
				</CardContent>
			</Card>
		</div>
	)
}
