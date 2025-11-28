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
import { GripVertical, Trash2, Users } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip"

export interface OrganizerDivisionItemProps {
	id: string
	label: string
	index: number
	registrationCount: number
	isOnly: boolean
	instanceId: symbol
	onLabelChange: (value: string) => void
	onRemove: () => void
	onDrop: (sourceIndex: number, targetIndex: number) => void
	onLabelBlur: () => void
}

export function OrganizerDivisionItem({
	id,
	label,
	index,
	registrationCount,
	isOnly,
	instanceId,
	onLabelChange,
	onRemove,
	onDrop,
	onLabelBlur,
}: OrganizerDivisionItemProps) {
	const ref = useRef<HTMLDivElement>(null)
	const dragHandleRef = useRef<HTMLButtonElement>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [closestEdge, setClosestEdge] = useState<Edge | null>(null)
	const closestEdgeRef = useRef<Edge | null>(null)

	const canDelete = registrationCount === 0 && !isOnly

	useEffect(() => {
		const element = ref.current
		const dragHandle = dragHandleRef.current
		if (!element || !dragHandle) return

		const divisionData = {
			id,
			index,
			instanceId,
		}

		return combine(
			draggable({
				element: dragHandle,
				getInitialData: () => divisionData,
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
							preview.textContent = label || "Division"
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
					return attachClosestEdge(divisionData, {
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
	}, [id, label, index, instanceId, onDrop])

	return (
		<div ref={ref} className="relative">
			{closestEdge && <DropIndicator edge={closestEdge} gap="2px" />}
			<div
				className={`flex items-center gap-2 p-3 border rounded-lg bg-background ${isDragging ? "opacity-50" : ""
					}`}
			>
				<button
					ref={dragHandleRef}
					type="button"
					className="cursor-grab active:cursor-grabbing"
					aria-label="Drag to reorder"
				>
					<GripVertical className="h-4 w-4 text-muted-foreground" />
				</button>
				<span className="text-sm font-mono text-muted-foreground w-8">
					#{index + 1}
				</span>
				<Input
					value={label}
					onChange={(e) => onLabelChange(e.target.value)}
					onBlur={onLabelBlur}
					placeholder="Enter division name"
					className="flex-1"
				/>
				<Badge variant="secondary" className="flex items-center gap-1">
					<Users className="h-3 w-3" />
					{registrationCount}
				</Badge>
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<span>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									onClick={onRemove}
									disabled={!canDelete}
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</span>
						</TooltipTrigger>
						{!canDelete && (
							<TooltipContent>
								{isOnly
									? "Competition must have at least one division"
									: `Cannot delete: ${registrationCount} athlete${registrationCount > 1 ? "s" : ""} registered`}
							</TooltipContent>
						)}
					</Tooltip>
				</TooltipProvider>
			</div>
		</div>
	)
}
