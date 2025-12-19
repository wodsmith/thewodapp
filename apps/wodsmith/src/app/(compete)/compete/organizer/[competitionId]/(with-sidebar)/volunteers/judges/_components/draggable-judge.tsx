"use client"

import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview"
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview"
import { Check, GripVertical } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { JudgeVolunteerInfo } from "@/server/judge-scheduling"
import { CredentialBadge } from "./credential-badge"

interface DraggableJudgeProps {
	volunteer: JudgeVolunteerInfo
	isSelected?: boolean
	onToggleSelect?: (id: string, shiftKey: boolean) => void
	selectedCount?: number
	selectedIds?: Set<string>
	/** Number of heats this judge is assigned to */
	assignmentCount?: number
	/** Whether judge is already assigned to the currently selected event */
	isAssignedToCurrentEvent?: boolean
}

/**
 * Draggable judge card for drag-and-drop assignment.
 * Shows credential level instead of registration date.
 * Supports multi-select with shift+click.
 */
export function DraggableJudge({
	volunteer,
	isSelected = false,
	onToggleSelect,
	selectedIds,
	assignmentCount,
	isAssignedToCurrentEvent = false,
}: DraggableJudgeProps) {
	const ref = useRef<HTMLDivElement>(null)
	const [isDragging, setIsDragging] = useState(false)

	const displayName =
		`${volunteer.firstName ?? ""} ${volunteer.lastName ?? ""}`.trim() ||
		"Unknown"

	useEffect(() => {
		const element = ref.current
		if (!element) return

		return draggable({
			element,
			getInitialData: () => {
				// If this item is selected and there are multiple selections, include all
				const isDraggingMultiple =
					isSelected && selectedIds && selectedIds.size > 1
				const membershipIds = isDraggingMultiple
					? Array.from(selectedIds)
					: [volunteer.membershipId]

				return {
					type: "judge",
					membershipId: volunteer.membershipId,
					membershipIds, // Array of all IDs being dragged
					displayName,
					credentials: volunteer.credentials,
					count: membershipIds.length,
				}
			},
			onDragStart: () => setIsDragging(true),
			onDrop: () => setIsDragging(false),
			onGenerateDragPreview({ nativeSetDragImage }) {
				const isDraggingMultiple =
					isSelected && selectedIds && selectedIds.size > 1
				const count = isDraggingMultiple ? selectedIds.size : 1

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
							display: flex;
							align-items: center;
							gap: 8px;
						`
						if (count > 1) {
							const badge = document.createElement("span")
							badge.style.cssText = `
								background: hsl(var(--primary));
								color: hsl(var(--primary-foreground));
								border-radius: 9999px;
								padding: 2px 8px;
								font-size: 12px;
								font-weight: 600;
							`
							badge.textContent = String(count)
							preview.appendChild(badge)
							preview.appendChild(document.createTextNode("judges"))
						} else {
							preview.textContent = displayName
						}
						container.appendChild(preview)
					},
				})
			},
		})
	}, [
		volunteer.membershipId,
		displayName,
		volunteer.credentials,
		isSelected,
		selectedIds,
	])

	function handleClick(e: React.MouseEvent) {
		if (onToggleSelect) {
			e.preventDefault()
			onToggleSelect(volunteer.membershipId, e.shiftKey)
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault()
			if (onToggleSelect) {
				onToggleSelect(volunteer.membershipId, e.shiftKey)
			}
		}
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop element with conditional click handler
		<div
			ref={ref}
			role={onToggleSelect ? "button" : undefined}
			tabIndex={onToggleSelect ? 0 : undefined}
			onClick={handleClick}
			onKeyDown={onToggleSelect ? handleKeyDown : undefined}
			className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded cursor-grab active:cursor-grabbing transition-colors ${
				isDragging ? "opacity-50" : ""
			} ${
				isSelected
					? "bg-primary/20 ring-1 ring-primary"
					: isAssignedToCurrentEvent
						? "bg-muted/50 opacity-60"
						: "bg-muted hover:bg-muted/80"
			}`}
		>
			{onToggleSelect ? (
				<div
					className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 ${
						isSelected
							? "bg-primary border-primary text-primary-foreground"
							: "border-muted-foreground/50"
					}`}
				>
					{isSelected && <Check className="h-3 w-3" />}
				</div>
			) : (
				<GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
			)}
			<span className="flex-1 truncate">{displayName}</span>
			{assignmentCount !== undefined && (
				<span
					className="text-xs text-muted-foreground tabular-nums flex-shrink-0"
					title={`Assigned to ${assignmentCount} heat${assignmentCount === 1 ? "" : "s"}`}
				>
					{assignmentCount}
				</span>
			)}
			<CredentialBadge
				credentials={volunteer.credentials}
				className="text-xs flex-shrink-0"
			/>
		</div>
	)
}
