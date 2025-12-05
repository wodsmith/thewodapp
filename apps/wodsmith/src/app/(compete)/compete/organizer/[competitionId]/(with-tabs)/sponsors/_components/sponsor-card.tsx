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
import {
	ExternalLink,
	GripVertical,
	MoreHorizontal,
	Pencil,
	Trash2,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Sponsor } from "@/db/schema"
import { cn } from "@/lib/utils"

interface SponsorCardProps {
	sponsor: Sponsor
	featured?: boolean
	onEdit: () => void
	onDelete: () => void
}

/**
 * Non-draggable sponsor card for ungrouped sponsors display
 */
export function SponsorCard({
	sponsor,
	featured,
	onEdit,
	onDelete,
}: SponsorCardProps) {
	return (
		<SponsorCardContent
			sponsor={sponsor}
			featured={featured}
			onEdit={onEdit}
			onDelete={onDelete}
		/>
	)
}

interface DraggableSponsorCardProps extends SponsorCardProps {
	index: number
	instanceId: symbol
	groupId: string
	onDrop: (sourceIndex: number, targetIndex: number) => void
}

/**
 * Draggable sponsor card for reordering within groups
 */
export function DraggableSponsorCard({
	sponsor,
	index,
	instanceId,
	groupId,
	featured,
	onEdit,
	onDelete,
	onDrop,
}: DraggableSponsorCardProps) {
	const ref = useRef<HTMLDivElement>(null)
	const dragHandleRef = useRef<HTMLButtonElement>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [closestEdge, setClosestEdge] = useState<Edge | null>(null)
	const closestEdgeRef = useRef<Edge | null>(null)

	const updateClosestEdge = useCallback((edge: Edge | null) => {
		closestEdgeRef.current = edge
		setClosestEdge(edge)
	}, [])

	useEffect(() => {
		const element = ref.current
		const dragHandle = dragHandleRef.current
		if (!element || !dragHandle) return

		const sponsorData = {
			id: sponsor.id,
			index,
			instanceId,
			groupId,
			type: "sponsor" as const,
		}

		return combine(
			draggable({
				element: dragHandle,
				getInitialData: () => sponsorData,
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
							preview.textContent = sponsor.name
							container.appendChild(preview)
						},
					})
				},
			}),
			dropTargetForElements({
				element,
				canDrop: ({ source }) => {
					return (
						source.data.type === "sponsor" &&
						source.data.instanceId === instanceId &&
						source.data.groupId === groupId &&
						source.data.index !== index
					)
				},
				getData({ input }) {
					return attachClosestEdge(sponsorData, {
						element,
						input,
						allowedEdges: ["left", "right"],
					})
				},
				onDrag({ source, self }: ElementDropTargetEventBasePayload) {
					if (source.data.index === index) {
						updateClosestEdge(null)
						return
					}

					const edge = extractClosestEdge(self.data)
					const sourceIndex = source.data.index

					if (typeof sourceIndex !== "number") return

					const isItemBeforeSource = index === sourceIndex - 1
					const isItemAfterSource = index === sourceIndex + 1

					const isDropIndicatorHidden =
						(isItemBeforeSource && edge === "right") ||
						(isItemAfterSource && edge === "left")

					updateClosestEdge(isDropIndicatorHidden ? null : edge)
				},
				onDragLeave: () => updateClosestEdge(null),
				onDrop({ source }) {
					const sourceIndex = source.data.index
					if (typeof sourceIndex === "number" && sourceIndex !== index) {
						const edge = closestEdgeRef.current
						const targetIndex = edge === "left" ? index : index + 1
						const adjustedTargetIndex =
							sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
						onDrop(sourceIndex, adjustedTargetIndex)
					}
					updateClosestEdge(null)
				},
			}),
		)
	}, [
		sponsor.id,
		sponsor.name,
		index,
		instanceId,
		groupId,
		onDrop,
		updateClosestEdge,
	])

	return (
		<div ref={ref} className="relative">
			{closestEdge && <DropIndicator edge={closestEdge} gap="4px" />}
			<SponsorCardContent
				sponsor={sponsor}
				featured={featured}
				isDragging={isDragging}
				dragHandleRef={dragHandleRef}
				onEdit={onEdit}
				onDelete={onDelete}
			/>
		</div>
	)
}

interface SponsorCardContentProps {
	sponsor: Sponsor
	featured?: boolean
	isDragging?: boolean
	dragHandleRef?: React.RefObject<HTMLButtonElement | null>
	onEdit: () => void
	onDelete: () => void
}

function SponsorCardContent({
	sponsor,
	featured,
	isDragging,
	dragHandleRef,
	onEdit,
	onDelete,
}: SponsorCardContentProps) {
	return (
		<div
			className={cn(
				"group relative flex flex-col items-center rounded-lg border p-4 transition-colors hover:bg-muted/50",
				featured && "border-primary bg-primary/5",
				isDragging && "opacity-50",
			)}
		>
			{/* Drag handle */}
			{dragHandleRef && (
				<button
					ref={dragHandleRef}
					type="button"
					className="absolute left-2 top-2 cursor-grab opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
					aria-label="Drag to reorder sponsor"
				>
					<GripVertical className="h-4 w-4 text-muted-foreground" />
				</button>
			)}

			{/* Actions menu */}
			<div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" className="h-8 w-8">
							<MoreHorizontal className="h-4 w-4" />
							<span className="sr-only">Sponsor actions</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={onEdit}>
							<Pencil className="mr-2 h-4 w-4" />
							Edit
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={onDelete} className="text-destructive">
							<Trash2 className="mr-2 h-4 w-4" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Logo or name */}
			{sponsor.logoUrl ? (
				<div className="flex h-20 w-full items-center justify-center">
					<Image
						src={sponsor.logoUrl}
						alt={sponsor.name}
						width={160}
						height={80}
						className="max-h-20 w-auto object-contain"
					/>
				</div>
			) : (
				<div className="flex h-20 items-center justify-center">
					<p className="text-center font-semibold">{sponsor.name}</p>
				</div>
			)}

			{/* Name (shown below logo) */}
			{sponsor.logoUrl && (
				<p className="mt-2 text-center text-sm text-muted-foreground">
					{sponsor.name}
				</p>
			)}

			{/* Website link */}
			{sponsor.website && (
				<Button asChild variant="link" size="sm" className="mt-2 h-auto p-0">
					<Link
						href={sponsor.website}
						target="_blank"
						rel="noopener noreferrer"
						className="text-xs"
					>
						<ExternalLink className="mr-1 h-3 w-3" />
						Website
					</Link>
				</Button>
			)}

			{/* Featured badge */}
			{featured && (
				<span className="mt-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
					Featured
				</span>
			)}
		</div>
	)
}
