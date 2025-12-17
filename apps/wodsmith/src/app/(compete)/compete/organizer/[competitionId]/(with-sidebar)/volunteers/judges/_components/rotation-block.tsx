"use client"

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine"
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview"
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview"
import { GripVertical, Pencil } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import type { CompetitionJudgeRotation } from "@/db/schema"

interface RotationBlockProps {
	rotation: CompetitionJudgeRotation
	judgeName: string
	laneCount: number
	onEdit: (rotation: CompetitionJudgeRotation) => void
	/** Horizontal position in grid (0-based heat index) */
	startCol: number
	/** Vertical position in grid (0-based lane index) */
	startRow: number
	/** Width in grid columns */
	span: number
}

/**
 * Draggable rotation block for Gantt timeline.
 * Shows judge name and heat range, allows horizontal drag to change starting heat.
 */
export function RotationBlock({
	rotation,
	judgeName,
	laneCount,
	onEdit,
	startCol,
	startRow,
	span,
}: RotationBlockProps) {
	const ref = useRef<HTMLDivElement>(null)
	const [isDragging, setIsDragging] = useState(false)

	const endHeat = rotation.startingHeat + rotation.heatsCount - 1

	// Calculate lane path based on shift pattern
	const getLaneDisplay = useCallback(() => {
		if (rotation.laneShiftPattern === "stay") {
			return `L${rotation.startingLane}`
		}
		if (rotation.laneShiftPattern === "shift_right") {
			const endLane =
				((rotation.startingLane - 1 + rotation.heatsCount - 1) % laneCount) + 1
			return `L${rotation.startingLane}→${endLane}`
		}
		if (rotation.laneShiftPattern === "shift_left") {
			const endLane =
				((rotation.startingLane - 1 - (rotation.heatsCount - 1) + laneCount * 100) %
					laneCount) +
				1
			return `L${rotation.startingLane}→${endLane}`
		}
		return `L${rotation.startingLane}`
	}, [rotation, laneCount])

	useEffect(() => {
		const element = ref.current
		if (!element) return

		return combine(
			draggable({
				element,
				getInitialData: () => ({
					type: "rotation",
					rotationId: rotation.id,
					rotation,
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
                background: hsl(var(--primary));
                color: hsl(var(--primary-foreground));
                border: 2px solid hsl(var(--primary));
                border-radius: 6px;
                padding: 6px 12px;
                font-size: 13px;
                font-weight: 500;
                box-shadow: 0 4px 12px rgba(0,0,0,0.25);
                white-space: nowrap;
              `
							preview.textContent = `${judgeName} • H${rotation.startingHeat}-${endHeat} • ${getLaneDisplay()}`
							container.appendChild(preview)
						},
					})
				},
			}),
		)
	}, [rotation, judgeName, endHeat, getLaneDisplay])

	return (
		<div
			ref={ref}
			className={`group absolute flex items-center gap-1.5 px-2 py-1.5 bg-primary text-primary-foreground rounded-md shadow-sm border border-primary hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${
				isDragging ? "opacity-50 scale-95" : ""
			}`}
			style={{
				gridColumnStart: startCol + 1,
				gridColumnEnd: startCol + span + 1,
				gridRowStart: startRow + 1,
				height: "32px",
				zIndex: isDragging ? 50 : 10,
			}}
		>
			<GripVertical className="h-3 w-3 flex-shrink-0 opacity-60 group-hover:opacity-100" />
			<div className="flex-1 min-w-0 flex items-center gap-2 text-xs font-medium">
				<span className="truncate">{judgeName}</span>
				<span className="text-primary-foreground/80 whitespace-nowrap tabular-nums">
					H{rotation.startingHeat}-{endHeat}
				</span>
				<span className="text-primary-foreground/70 whitespace-nowrap tabular-nums text-[10px]">
					{getLaneDisplay()}
				</span>
			</div>
			<Button
				variant="ghost"
				size="icon"
				className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
				onClick={(e) => {
					e.stopPropagation()
					onEdit(rotation)
				}}
			>
				<Pencil className="h-3 w-3" />
			</Button>
		</div>
	)
}
