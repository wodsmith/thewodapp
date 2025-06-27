"use client"

import { Badge } from "@/components/ui/badge"
import type { Workout } from "@/db/schema"
import type { TrackWorkout } from "@/db/schema"
import {
	type Edge,
	attachClosestEdge,
	extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge"
import { DragHandleButton } from "@atlaskit/pragmatic-drag-and-drop-react-accessibility/drag-handle-button"
import { DropIndicator } from "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box"
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine"
import {
	type ElementDropTargetEventBasePayload,
	draggable,
	dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview"
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview"
import { ChevronRight, GripVertical } from "lucide-react"
import { Fragment, useEffect, useRef, useState } from "react"
import { getTrackWorkoutData, isTrackWorkoutData } from "./drag-drop-types"

interface TrackWorkoutRowProps {
	teamId: string
	trackId: string
	trackWorkout: TrackWorkout & {
		isScheduled?: boolean
		lastScheduledAt?: Date | null
	}
	workoutDetails?: Workout & {
		tags: { id: string; name: string }[]
		movements: { id: string; name: string }[]
	}
	index: number
	instanceId: symbol
}

export function TrackWorkoutRow({
	teamId,
	trackId,
	trackWorkout,
	workoutDetails,
	index,
	instanceId,
}: TrackWorkoutRowProps) {
	const ref = useRef<HTMLDivElement>(null)
	const dragHandleRef = useRef<HTMLButtonElement>(null)

	const [isDragging, setIsDragging] = useState(false)
	const [closestEdge, setClosestEdge] = useState<Edge | null>(null)

	useEffect(() => {
		const element = ref.current
		const dragHandle = dragHandleRef.current
		if (!element || !dragHandle) return

		// Simplified data structure
		const simplifiedData = {
			trackWorkoutId: trackWorkout.id,
			index,
			instanceId,
			dayNumber: trackWorkout.dayNumber,
		}

		function onChange({ source, self }: ElementDropTargetEventBasePayload) {
			const isSource = source.element === dragHandle
			if (isSource) {
				setClosestEdge(null)
				return
			}

			const closestEdge = extractClosestEdge(self.data)

			const sourceIndex = source.data.index
			if (typeof sourceIndex !== "number") return

			const isItemBeforeSource = index === sourceIndex - 1
			const isItemAfterSource = index === sourceIndex + 1

			const isDropIndicatorHidden =
				(isItemBeforeSource && closestEdge === "bottom") ||
				(isItemAfterSource && closestEdge === "top")

			if (isDropIndicatorHidden) {
				setClosestEdge(null)
				return
			}

			setClosestEdge(closestEdge)
		}

		return combine(
			draggable({
				element: dragHandle,
				getInitialData: () => {
					return simplifiedData
				},
				onGenerateDragPreview({ nativeSetDragImage }) {
					// Create a custom drag preview with the workout title
					setCustomNativeDragPreview({
						nativeSetDragImage,
						getOffset: pointerOutsideOfPreview({
							x: "16px",
							y: "8px",
						}),
						render({ container }) {
							const preview = document.createElement("div")
							preview.style.cssText = `
                background: white;
                border: 4px solid hsl(var(--primary));
                border-radius: 0;
                padding: 12px 16px;
                font-family: 'JetBrains Mono', monospace;
                font-weight: bold;
                font-size: 14px;
                color: hsl(var(--foreground));
                box-shadow: 6px 6px 0px 0px hsl(var(--primary));
                max-width: 300px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              `
							preview.textContent = `Day ${trackWorkout.dayNumber}: ${
								workoutDetails?.name || "Workout"
							}`
							container.appendChild(preview)
						},
					})
				},
				onDragStart() {
					setIsDragging(true)
				},
				onDrop() {
					setIsDragging(false)
				},
			}),
			dropTargetForElements({
				element,
				canDrop({ source }) {
					return (
						source.data &&
						"trackWorkoutId" in source.data &&
						"instanceId" in source.data &&
						source.data.instanceId === instanceId
					)
				},
				getData({ input }) {
					return attachClosestEdge(simplifiedData, {
						element,
						input,
						allowedEdges: ["top", "bottom"],
					})
				},
				onDragEnter: onChange,
				onDrag: onChange,
				onDragLeave() {
					setClosestEdge(null)
				},
				onDrop() {
					setClosestEdge(null)
				},
			}),
		)
	}, [instanceId, trackWorkout, index, workoutDetails?.name])

	if (!workoutDetails) {
		return null // Or a loading/placeholder state
	}

	return (
		<Fragment>
			<div
				ref={ref}
				className={`relative block bg-surface rounded-none border-4 hover:border-primary border-transparent transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary p-2 ${
					isDragging ? "opacity-50" : ""
				}`}
			>
				<div className="flex items-center justify-between gap-4">
					{/* Drag Handle */}
					<DragHandleButton
						ref={dragHandleRef}
						label={`Reorder ${workoutDetails.name}`}
					/>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-grow items-center">
						{/* Column 1: Day, Name and Scheme */}
						<div className="md:col-span-1">
							<div className="flex flex-row gap-2 items-center">
								<div className="flex items-center gap-3 mb-1 opacity-70">
									<div className="text-primary px-2 py-1 text-xs font-mono font-bold">
										{trackWorkout.dayNumber}
									</div>
								</div>
								<h3 className="text-lg font-mono tracking-tight font-bold">
									{workoutDetails.name}
								</h3>
								<p className="text-sm text-muted-foreground font-mono">
									{workoutDetails.scheme}
								</p>
							</div>
						</div>

						{/* Column 2: Description */}
						<div className="md:col-span-1">
							{workoutDetails.description && (
								<p className="text-sm text-muted-foreground font-mono line-clamp-2">
									{workoutDetails.description}
								</p>
							)}
						</div>

						{/* Column 3: Status */}
						<div className="md:col-span-1 flex items-center justify-start md:justify-end">
							{trackWorkout.isScheduled && (
								<Badge className="bg-green-500 text-white border-2 border-green-700 font-mono">
									Scheduled
								</Badge>
							)}
						</div>
					</div>

					{/* Arrow Icon */}
					<div className="flex-shrink-0">
						<ChevronRight className="h-6 w-6 text-primary" />
					</div>
				</div>
				{closestEdge && <DropIndicator edge={closestEdge} gap="1px" />}
			</div>
		</Fragment>
	)
}
