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
import { ExternalLink, GripVertical, Pencil, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import type { EventResource } from "@/db/schemas/event-resources"

interface EventResourceRowProps {
	resource: EventResource
	index: number
	instanceId: symbol
	onEdit: () => void
	onDelete: () => void
	onDrop: (sourceIndex: number, targetIndex: number) => void
}

export function EventResourceRow({
	resource,
	index,
	instanceId,
	onEdit,
	onDelete,
	onDrop,
}: EventResourceRowProps) {
	const ref = useRef<HTMLDivElement>(null)
	const dragHandleRef = useRef<HTMLButtonElement>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [closestEdge, setClosestEdge] = useState<Edge | null>(null)
	const closestEdgeRef = useRef<Edge | null>(null)
	const titleRef = useRef(resource.title)

	// Sync title ref when prop changes (for drag preview)
	useEffect(() => {
		titleRef.current = resource.title
	}, [resource.title])

	useEffect(() => {
		const element = ref.current
		const dragHandle = dragHandleRef.current
		if (!element || !dragHandle) return

		const resourceData = {
			id: resource.id,
			index,
			instanceId,
		}

		return combine(
			draggable({
				element: dragHandle,
				getInitialData: () => resourceData,
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
							preview.textContent = titleRef.current || "Resource"
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
					return attachClosestEdge(resourceData, {
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
	}, [resource.id, index, instanceId, onDrop])

	return (
		<div ref={ref} className="relative">
			{closestEdge && <DropIndicator edge={closestEdge} gap="2px" />}
			<div
				className={`flex items-center gap-3 p-3 rounded-lg border bg-card ${isDragging ? "opacity-50" : ""} group`}
			>
				{/* Drag Handle */}
				<button
					ref={dragHandleRef}
					type="button"
					className="cursor-grab active:cursor-grabbing opacity-30 group-hover:opacity-100 transition-opacity p-1 -m-1"
					aria-label="Drag to reorder"
				>
					<GripVertical className="h-4 w-4 text-muted-foreground" />
				</button>

				{/* Resource Info */}
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="font-medium truncate">{resource.title}</span>
						{resource.url && (
							<a
								href={resource.url}
								target="_blank"
								rel="noopener noreferrer"
								className="text-muted-foreground hover:text-foreground"
								onClick={(e) => e.stopPropagation()}
							>
								<ExternalLink className="h-3.5 w-3.5" />
							</a>
						)}
					</div>
					{resource.description && (
						<p className="text-sm text-muted-foreground truncate mt-0.5">
							{resource.description}
						</p>
					)}
				</div>

				{/* Actions */}
				<div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
					<Button
						variant="ghost"
						size="icon"
						onClick={onEdit}
						className="h-8 w-8 text-muted-foreground hover:text-foreground"
					>
						<Pencil className="h-4 w-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={onDelete}
						className="h-8 w-8 text-muted-foreground hover:text-destructive"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</div>
		</div>
	)
}
