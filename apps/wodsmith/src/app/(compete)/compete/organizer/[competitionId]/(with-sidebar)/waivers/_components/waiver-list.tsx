"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
import { useServerAction } from "@repo/zsa-react"
import {
	AlertTriangle,
	CheckCircle2,
	ClipboardSignature,
	Edit2,
	GripVertical,
	Plus,
	Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { deleteWaiverAction, reorderWaiversAction } from "@/actions/waivers"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import type { Waiver } from "@/db/schemas/waivers"
import { WaiverFormDialog } from "./waiver-form-dialog"

interface WaiverListProps {
	competitionId: string
	teamId: string
	waivers: Waiver[]
}

interface WaiverItemProps {
	waiver: Waiver
	index: number
	instanceId: symbol
	teamId: string
	competitionId: string
	onEdit: (waiver: Waiver) => void
	onDelete: (waiverId: string) => void
	onDrop: (sourceIndex: number, targetIndex: number) => void
}

function WaiverItem({
	waiver,
	index,
	instanceId,
	onEdit,
	onDelete,
	onDrop,
}: WaiverItemProps) {
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

		const itemData = { id: waiver.id, index, instanceId }

		return combine(
			draggable({
				element: dragHandle,
				getInitialData: () => itemData,
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
								border: 2px solid hsl(var(--border));
								border-radius: 6px;
								padding: 8px 12px;
								font-size: 14px;
								color: hsl(var(--foreground));
								box-shadow: 0 2px 8px rgba(0,0,0,0.15);
							`
							preview.textContent = waiver.title
							container.appendChild(preview)
						},
					})
				},
			}),
			dropTargetForElements({
				element,
				canDrop: ({ source }) =>
					source.data.instanceId === instanceId && source.data.index !== index,
				getData({ input }) {
					return attachClosestEdge(itemData, {
						element,
						input,
						allowedEdges: ["top", "bottom"],
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

					// Hide indicator when it would be redundant
					const isItemBeforeSource = index === sourceIndex - 1
					const isItemAfterSource = index === sourceIndex + 1
					const isDropIndicatorHidden =
						(isItemBeforeSource && edge === "bottom") ||
						(isItemAfterSource && edge === "top")

					updateClosestEdge(isDropIndicatorHidden ? null : edge)
				},
				onDragLeave: () => updateClosestEdge(null),
				onDrop({ source }) {
					const sourceIndex = source.data.index
					if (typeof sourceIndex === "number" && sourceIndex !== index) {
						const edge = closestEdgeRef.current // Read from ref!
						const targetIndex = edge === "top" ? index : index + 1
						const adjustedTargetIndex =
							sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
						onDrop(sourceIndex, adjustedTargetIndex)
					}
					updateClosestEdge(null)
				},
			}),
		)
	}, [waiver.id, waiver.title, index, instanceId, onDrop, updateClosestEdge])

	return (
		<div ref={ref} className="relative">
			{closestEdge && <DropIndicator edge={closestEdge} gap="2px" />}
			<Card className={isDragging ? "opacity-50" : ""}>
				<CardHeader className="pb-3">
					<div className="flex items-start gap-3">
						<button
							ref={dragHandleRef}
							type="button"
							aria-label="Drag to reorder"
							className="mt-1 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
						>
							<GripVertical className="h-5 w-5" />
						</button>
						<div className="flex-1">
							<div className="flex items-center gap-2">
								<CardTitle>{waiver.title}</CardTitle>
								{waiver.required ? (
									<span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
										<AlertTriangle className="h-3 w-3" />
										Required
									</span>
								) : (
									<span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
										<CheckCircle2 className="h-3 w-3" />
										Optional
									</span>
								)}
							</div>
							<CardDescription>Position {waiver.position + 1}</CardDescription>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onEdit(waiver)}
								aria-label={`Edit ${waiver.title}`}
							>
								<Edit2 className="h-4 w-4" />
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onDelete(waiver.id)}
								aria-label={`Delete ${waiver.title}`}
							>
								<Trash2 className="h-4 w-4 text-destructive" />
							</Button>
						</div>
					</div>
				</CardHeader>
			</Card>
		</div>
	)
}

export function WaiverList({
	competitionId,
	teamId,
	waivers: initialWaivers,
}: WaiverListProps) {
	const [waivers, setWaivers] = useState(initialWaivers)
	const [instanceId] = useState(() => Symbol("waiver-list"))
	const [editingWaiver, setEditingWaiver] = useState<Waiver | null>(null)
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

	const { execute: executeReorder } = useServerAction(reorderWaiversAction)
	const { execute: executeDelete } = useServerAction(deleteWaiverAction)

	const handleDrop = async (sourceIndex: number, targetIndex: number) => {
		const newWaivers = [...waivers]
		const [movedWaiver] = newWaivers.splice(sourceIndex, 1)
		if (movedWaiver) {
			newWaivers.splice(targetIndex, 0, movedWaiver)
			const updatedWaivers = newWaivers.map((waiver, i) => ({
				...waiver,
				position: i,
			}))

			// Optimistic update
			setWaivers(updatedWaivers)

			// Persist to server
			const [, error] = await executeReorder({
				competitionId,
				teamId,
				waivers: updatedWaivers.map((w) => ({
					id: w.id,
					position: w.position,
				})),
			})

			if (error) {
				toast.error("Failed to reorder waivers")
				// Revert on error
				setWaivers(waivers)
			}
		}
	}

	const handleDelete = async (waiverId: string) => {
		// TODO: Replace with confirmation dialog component
		// eslint-disable-next-line no-alert
		if (!window.confirm("Are you sure you want to delete this waiver?")) {
			return
		}

		const [, error] = await executeDelete({
			waiverId,
			competitionId,
			teamId,
		})

		if (error) {
			toast.error("Failed to delete waiver")
		} else {
			toast.success("Waiver deleted")
			// Remove from local state
			setWaivers((prev) => prev.filter((w) => w.id !== waiverId))
		}
	}

	const handleWaiverCreated = (waiver: Waiver) => {
		setWaivers((prev) => [...prev, waiver])
		setIsCreateDialogOpen(false)
	}

	const handleWaiverUpdated = (waiver: Waiver) => {
		setWaivers((prev) => prev.map((w) => (w.id === waiver.id ? waiver : w)))
		setEditingWaiver(null)
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold tracking-tight">Waivers</h2>
					<p className="text-muted-foreground">
						Manage competition waivers and liability agreements
					</p>
				</div>
				<Button onClick={() => setIsCreateDialogOpen(true)}>
					<Plus className="mr-2 h-4 w-4" />
					Add Waiver
				</Button>
			</div>

			{waivers.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12 text-center">
						<ClipboardSignature className="mb-4 h-12 w-12 text-muted-foreground" />
						<h3 className="mb-2 text-lg font-semibold">No waivers yet</h3>
						<p className="mb-4 text-sm text-muted-foreground">
							Create your first waiver to require athletes to sign liability
							agreements
						</p>
						<Button onClick={() => setIsCreateDialogOpen(true)}>
							<Plus className="mr-2 h-4 w-4" />
							Add Waiver
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-3">
					{waivers.map((waiver, index) => (
						<WaiverItem
							key={waiver.id}
							waiver={waiver}
							index={index}
							instanceId={instanceId}
							teamId={teamId}
							competitionId={competitionId}
							onEdit={setEditingWaiver}
							onDelete={handleDelete}
							onDrop={handleDrop}
						/>
					))}
				</div>
			)}

			{/* Create Dialog */}
			<WaiverFormDialog
				open={isCreateDialogOpen}
				onOpenChange={setIsCreateDialogOpen}
				competitionId={competitionId}
				teamId={teamId}
				onSuccess={handleWaiverCreated}
			/>

			{/* Edit Dialog */}
			{editingWaiver && (
				<WaiverFormDialog
					open={true}
					onOpenChange={(open) => !open && setEditingWaiver(null)}
					competitionId={competitionId}
					teamId={teamId}
					waiver={editingWaiver}
					onSuccess={handleWaiverUpdated}
				/>
			)}
		</div>
	)
}
