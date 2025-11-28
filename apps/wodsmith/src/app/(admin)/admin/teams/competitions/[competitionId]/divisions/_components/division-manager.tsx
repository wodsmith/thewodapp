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
import { GripVertical, Plus, Trash2, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useServerAction } from "@repo/zsa-react"
import {
	createScalingLevelAction,
	deleteScalingLevelAction,
	reorderScalingLevelsAction,
	updateScalingLevelAction,
} from "@/actions/scaling-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"

interface Division {
	id: string
	label: string
	position: number
	teamSize: number
}

interface DivisionManagerProps {
	teamId: string
	competitionId: string
	scalingGroupId: string
	scalingGroupTitle: string
	scalingGroupDescription: string | null
	levels: Division[]
}

interface DivisionItemProps {
	division: Division
	index: number
	instanceId: symbol
	onLabelChange: (id: string, label: string) => void
	onTeamSizeChange: (id: string, teamSize: number) => void
	onDelete: (id: string) => void
	onDrop: (sourceIndex: number, targetIndex: number) => void
	isDeleting: boolean
	canDelete: boolean
}

function DivisionItem({
	division,
	index,
	instanceId,
	onLabelChange,
	onTeamSizeChange,
	onDelete,
	onDrop,
	isDeleting,
	canDelete,
}: DivisionItemProps) {
	const ref = useRef<HTMLDivElement>(null)
	const dragHandleRef = useRef<HTMLButtonElement>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [closestEdge, setClosestEdge] = useState<Edge | null>(null)
	const [editingLabel, setEditingLabel] = useState(division.label)
	const [isEditing, setIsEditing] = useState(false)

	useEffect(() => {
		const element = ref.current
		const dragHandle = dragHandleRef.current
		if (!element || !dragHandle) return

		const divisionData = {
			id: division.id,
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
							preview.textContent = division.label || "Division"
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
						setClosestEdge(null)
						return
					}

					setClosestEdge(edge)
				},
				onDragLeave: () => {
					setClosestEdge(null)
				},
				onDrop({ source }) {
					const sourceIndex = source.data.index
					if (typeof sourceIndex === "number" && sourceIndex !== index) {
						const edge = closestEdge
						const targetIndex = edge === "top" ? index : index + 1
						const adjustedTargetIndex =
							sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
						onDrop(sourceIndex, adjustedTargetIndex)
					}
					setClosestEdge(null)
				},
			}),
		)
	}, [division.id, division.label, index, instanceId, onDrop, closestEdge])

	const handleBlur = () => {
		if (editingLabel !== division.label && editingLabel.trim()) {
			onLabelChange(division.id, editingLabel.trim())
		}
		setIsEditing(false)
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleBlur()
		} else if (e.key === "Escape") {
			setEditingLabel(division.label)
			setIsEditing(false)
		}
	}

	return (
		<div ref={ref} className="relative">
			{closestEdge && <DropIndicator edge={closestEdge} gap="2px" />}
			<div
				className={`flex items-center gap-3 p-3 border rounded-lg bg-background ${
					isDragging ? "opacity-50" : ""
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

				<Badge variant="outline" className="font-mono shrink-0">
					#{index + 1}
				</Badge>

				{isEditing ? (
					<Input
						value={editingLabel}
						onChange={(e) => setEditingLabel(e.target.value)}
						onBlur={handleBlur}
						onKeyDown={handleKeyDown}
						className="flex-1"
						autoFocus
					/>
				) : (
					<button
						type="button"
						onClick={() => setIsEditing(true)}
						className="flex-1 text-left font-medium hover:text-primary transition-colors"
					>
						{division.label}
					</button>
				)}

				<div className="flex items-center gap-2 shrink-0">
					<Users className="h-4 w-4 text-muted-foreground" />
					<Select
						value={String(division.teamSize)}
						onValueChange={(value) =>
							onTeamSizeChange(division.id, Number.parseInt(value, 10))
						}
					>
						<SelectTrigger className="w-20">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="1">1</SelectItem>
							<SelectItem value="2">2</SelectItem>
							<SelectItem value="3">3</SelectItem>
							<SelectItem value="4">4</SelectItem>
							<SelectItem value="5">5</SelectItem>
							<SelectItem value="6">6</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<Button
					type="button"
					size="sm"
					variant="ghost"
					onClick={() => onDelete(division.id)}
					disabled={isDeleting || !canDelete}
					className="shrink-0"
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>
		</div>
	)
}

export function DivisionManager({
	teamId,
	competitionId,
	scalingGroupId,
	scalingGroupTitle,
	scalingGroupDescription,
	levels,
}: DivisionManagerProps) {
	const router = useRouter()
	const [divisions, setDivisions] = useState<Division[]>(levels)
	const [instanceId] = useState(() => Symbol("divisions"))
	const [newDivisionLabel, setNewDivisionLabel] = useState("")
	const [newDivisionTeamSize, setNewDivisionTeamSize] = useState(1)

	const { execute: reorderLevels, isPending: isReordering } = useServerAction(
		reorderScalingLevelsAction,
		{
			onError: (error) => {
				toast.error(error.err?.message || "Failed to reorder divisions")
				// Revert to original order
				setDivisions(levels)
			},
		},
	)

	const { execute: createLevel, isPending: isCreating } = useServerAction(
		createScalingLevelAction,
		{
			onError: (error) => {
				toast.error(error.err?.message || "Failed to create division")
			},
			onSuccess: () => {
				toast.success("Division created")
				setNewDivisionLabel("")
				setNewDivisionTeamSize(1)
				router.refresh()
			},
		},
	)

	const { execute: updateLevel, isPending: isUpdating } = useServerAction(
		updateScalingLevelAction,
		{
			onError: (error) => {
				toast.error(error.err?.message || "Failed to update division")
			},
			onSuccess: () => {
				toast.success("Division updated")
				router.refresh()
			},
		},
	)

	const { execute: deleteLevel, isPending: isDeleting } = useServerAction(
		deleteScalingLevelAction,
		{
			onError: (error) => {
				toast.error(error.err?.message || "Failed to delete division")
			},
			onSuccess: () => {
				toast.success("Division deleted")
				router.refresh()
			},
		},
	)

	// Sync divisions when levels prop changes
	useEffect(() => {
		setDivisions(levels)
	}, [levels])

	const handleDrop = async (sourceIndex: number, targetIndex: number) => {
		// Optimistically update UI
		const newDivisions = [...divisions]
		const [movedItem] = newDivisions.splice(sourceIndex, 1)
		if (movedItem) {
			newDivisions.splice(targetIndex, 0, movedItem)

			// Update positions
			const updatedDivisions = newDivisions.map((div, index) => ({
				...div,
				position: index,
			}))

			setDivisions(updatedDivisions)

			// Send to server
			await reorderLevels({
				teamId,
				groupId: scalingGroupId,
				levelIds: updatedDivisions.map((d) => d.id),
			})
		}
	}

	const handleLabelChange = async (id: string, label: string) => {
		// Optimistically update
		setDivisions((prev) =>
			prev.map((d) => (d.id === id ? { ...d, label } : d)),
		)

		await updateLevel({
			teamId,
			scalingLevelId: id,
			label,
		})
	}

	const handleTeamSizeChange = async (id: string, teamSize: number) => {
		// Optimistically update
		setDivisions((prev) =>
			prev.map((d) => (d.id === id ? { ...d, teamSize } : d)),
		)

		await updateLevel({
			teamId,
			scalingLevelId: id,
			teamSize,
		})
	}

	const handleDelete = async (id: string) => {
		if (divisions.length <= 1) {
			toast.error("Cannot delete the last division")
			return
		}

		// Optimistically remove
		setDivisions((prev) => prev.filter((d) => d.id !== id))

		await deleteLevel({
			teamId,
			scalingLevelId: id,
		})
	}

	const handleAddDivision = async () => {
		if (!newDivisionLabel.trim()) {
			toast.error("Please enter a division name")
			return
		}

		await createLevel({
			teamId,
			scalingGroupId,
			label: newDivisionLabel.trim(),
			teamSize: newDivisionTeamSize,
		})
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !isCreating) {
			handleAddDivision()
		}
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>{scalingGroupTitle}</CardTitle>
						<CardDescription>
							{scalingGroupDescription ||
								"Drag to reorder. Click name to edit. Position #1 is the hardest."}
						</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					{divisions
						.sort((a, b) => a.position - b.position)
						.map((division, index) => (
							<DivisionItem
								key={division.id}
								division={division}
								index={index}
								instanceId={instanceId}
								onLabelChange={handleLabelChange}
								onTeamSizeChange={handleTeamSizeChange}
								onDelete={handleDelete}
								onDrop={handleDrop}
								isDeleting={isDeleting}
								canDelete={divisions.length > 1}
							/>
						))}
				</div>

				{divisions.length === 0 && (
					<div className="text-center py-8 text-muted-foreground">
						<p>No divisions configured yet.</p>
						<p className="text-sm mt-1">Add your first division below.</p>
					</div>
				)}

				<div className="flex gap-2 pt-4 border-t">
					<Input
						placeholder="New division name (e.g., RX, Scaled, Masters 40+)"
						value={newDivisionLabel}
						onChange={(e) => setNewDivisionLabel(e.target.value)}
						onKeyDown={handleKeyDown}
						className="flex-1"
					/>
					<div className="flex items-center gap-2 shrink-0">
						<Users className="h-4 w-4 text-muted-foreground" />
						<Select
							value={String(newDivisionTeamSize)}
							onValueChange={(value) =>
								setNewDivisionTeamSize(Number.parseInt(value, 10))
							}
						>
							<SelectTrigger className="w-20">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="1">1</SelectItem>
								<SelectItem value="2">2</SelectItem>
								<SelectItem value="3">3</SelectItem>
								<SelectItem value="4">4</SelectItem>
								<SelectItem value="5">5</SelectItem>
								<SelectItem value="6">6</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<Button
						onClick={handleAddDivision}
						disabled={isCreating || !newDivisionLabel.trim()}
					>
						<Plus className="h-4 w-4 mr-1" />
						{isCreating ? "Adding..." : "Add Division"}
					</Button>
				</div>

				<p className="text-xs text-muted-foreground">
					Team size indicates how many athletes compete together in that division.
					Individual = 1, Pairs = 2, Teams = 3+
				</p>
			</CardContent>
		</Card>
	)
}
