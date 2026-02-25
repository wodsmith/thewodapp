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
import { useRouter } from "@tanstack/react-router"
import { GripVertical, Plus, Trash2, Users } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip"
import {
	addSeriesDivisionFn,
	deleteSeriesDivisionFn,
	reorderSeriesDivisionsFn,
	updateSeriesDivisionFn,
} from "@/server-fns/competition-divisions-fns"
import { SeriesTemplateSelector } from "./series-template-selector"

interface SeriesDivision {
	id: string
	label: string
	position: number
	teamSize: number
}

interface ScalingGroupWithLevels {
	id: string
	title: string
	description: string | null
	isSystem: boolean
	levels: Array<{
		id: string
		label: string
		position: number
	}>
}

interface SeriesDivisionManagerProps {
	groupId: string
	teamId: string
	divisions: SeriesDivision[]
	scalingGroupId: string | null
	scalingGroups: ScalingGroupWithLevels[]
}

export function SeriesDivisionManager({
	groupId,
	teamId,
	divisions: initialDivisions,
	scalingGroupId,
	scalingGroups,
}: SeriesDivisionManagerProps) {
	const router = useRouter()
	const [divisions, setDivisions] = useState(initialDivisions)
	const [showAddDialog, setShowAddDialog] = useState(false)
	const [newDivisionLabel, setNewDivisionLabel] = useState("")
	const [newDivisionTeamSize, setNewDivisionTeamSize] = useState(1)
	const [instanceId] = useState(() => Symbol("series-divisions"))
	const [isAdding, setIsAdding] = useState(false)

	useEffect(() => {
		setDivisions(initialDivisions)
	}, [initialDivisions])

	// If no divisions configured, show template selector
	if (!scalingGroupId || divisions.length === 0) {
		return (
			<SeriesTemplateSelector
				teamId={teamId}
				groupId={groupId}
				scalingGroups={scalingGroups}
				onSuccess={() => router.invalidate()}
			/>
		)
	}

	const handleLabelSave = async (divisionId: string, newLabel: string) => {
		const original = initialDivisions.find((d) => d.id === divisionId)
		if (original && original.label === newLabel) return

		setDivisions((prev) =>
			prev.map((d) => (d.id === divisionId ? { ...d, label: newLabel } : d)),
		)

		try {
			await updateSeriesDivisionFn({
				data: {
					teamId,
					groupId,
					divisionId,
					label: newLabel,
				},
			})
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to update division",
			)
			setDivisions((prev) =>
				prev.map((d) =>
					d.id === divisionId
						? { ...d, label: original?.label ?? newLabel }
						: d,
				),
			)
		}
	}

	const handleRemove = async (divisionId: string) => {
		try {
			await deleteSeriesDivisionFn({
				data: {
					teamId,
					groupId,
					divisionId,
				},
			})
			toast.success("Division deleted")
			setDivisions((prev) => prev.filter((d) => d.id !== divisionId))
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to delete division",
			)
		}
	}

	const handleDrop = async (sourceIndex: number, targetIndex: number) => {
		const newDivisions = [...divisions]
		const [movedItem] = newDivisions.splice(sourceIndex, 1)
		if (movedItem) {
			newDivisions.splice(targetIndex, 0, movedItem)

			const updatedDivisions = newDivisions.map((div, index) => ({
				...div,
				position: index,
			}))

			setDivisions(updatedDivisions)

			try {
				await reorderSeriesDivisionsFn({
					data: {
						teamId,
						groupId,
						orderedDivisionIds: updatedDivisions.map((d) => d.id),
					},
				})
			} catch (error) {
				toast.error(
					error instanceof Error
						? error.message
						: "Failed to reorder divisions",
				)
				setDivisions(initialDivisions)
			}
		}
	}

	const handleAddDivision = async () => {
		if (!newDivisionLabel.trim()) return

		setIsAdding(true)
		try {
			await addSeriesDivisionFn({
				data: {
					teamId,
					groupId,
					label: newDivisionLabel.trim(),
					teamSize: newDivisionTeamSize,
				},
			})

			toast.success("Division added")
			setNewDivisionLabel("")
			setNewDivisionTeamSize(1)
			setShowAddDialog(false)
			router.invalidate()
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to add division",
			)
		} finally {
			setIsAdding(false)
		}
	}

	return (
		<>
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Series Divisions</CardTitle>
							<CardDescription>
								Template divisions inherited by new competitions in this series.
								Drag to reorder.
							</CardDescription>
						</div>
						<Button onClick={() => setShowAddDialog(true)}>
							<Plus className="h-4 w-4 mr-2" />
							Add Division
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						{divisions
							.sort((a, b) => a.position - b.position)
							.map((division, index) => (
								<SeriesDivisionItem
									key={division.id}
									id={division.id}
									label={division.label}
									teamSize={division.teamSize}
									index={index}
									isOnly={divisions.length === 1}
									instanceId={instanceId}
									onLabelSave={(label) => handleLabelSave(division.id, label)}
									onRemove={() => handleRemove(division.id)}
									onDrop={handleDrop}
								/>
							))}
					</div>
					<p className="text-xs text-muted-foreground mt-4">
						Changes to series divisions only affect new competitions. Existing
						competitions keep their own independent divisions.
					</p>
				</CardContent>
			</Card>

			<Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add Series Division</DialogTitle>
						<DialogDescription>
							Add a new division to the series template. New competitions will
							inherit this division.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div>
							<Label htmlFor="seriesDivisionName">Division Name</Label>
							<Input
								id="seriesDivisionName"
								value={newDivisionLabel}
								onChange={(e) => setNewDivisionLabel(e.target.value)}
								placeholder="e.g., Masters 40+, Teen 14-17, RX"
								className="mt-2"
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault()
										handleAddDivision()
									}
								}}
							/>
						</div>
						<div>
							<Label htmlFor="seriesTeamSize">Team Size</Label>
							<Input
								id="seriesTeamSize"
								type="number"
								min={1}
								max={10}
								value={newDivisionTeamSize}
								onChange={(e) => setNewDivisionTeamSize(Number(e.target.value))}
								className="mt-2"
							/>
							<p className="text-muted-foreground text-sm mt-1">
								1 = Individual, 2+ = Team division
							</p>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowAddDialog(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleAddDivision}
							disabled={isAdding || !newDivisionLabel.trim()}
						>
							{isAdding ? "Adding..." : "Add Division"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}

// ============================================================================
// SeriesDivisionItem — simplified version without fee/capacity/description
// ============================================================================

interface SeriesDivisionItemProps {
	id: string
	label: string
	teamSize: number
	index: number
	isOnly: boolean
	instanceId: symbol
	onLabelSave: (value: string) => void
	onRemove: () => void
	onDrop: (sourceIndex: number, targetIndex: number) => void
}

function SeriesDivisionItem({
	id,
	label,
	teamSize,
	index,
	isOnly,
	instanceId,
	onLabelSave,
	onRemove,
	onDrop,
}: SeriesDivisionItemProps) {
	const ref = useRef<HTMLDivElement>(null)
	const dragHandleRef = useRef<HTMLButtonElement>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [closestEdge, setClosestEdge] = useState<Edge | null>(null)
	const closestEdgeRef = useRef<Edge | null>(null)
	const [localLabel, setLocalLabel] = useState(label)
	const labelRef = useRef(label)

	useEffect(() => {
		setLocalLabel(label)
		labelRef.current = label
	}, [label])

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
							preview.textContent = labelRef.current || "Division"
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
	}, [id, index, instanceId, onDrop])

	return (
		<div ref={ref} className="relative">
			{closestEdge && <DropIndicator edge={closestEdge} gap="2px" />}
			<div
				className={`border rounded-lg bg-background ${isDragging ? "opacity-50" : ""}`}
			>
				<div className="flex items-center gap-2 p-3">
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
						value={localLabel}
						onChange={(e) => setLocalLabel(e.target.value)}
						onBlur={() => {
							if (localLabel !== label) {
								onLabelSave(localLabel)
							}
						}}
						placeholder="Enter division name"
						className="flex-1"
					/>
					{teamSize > 1 && (
						<Badge variant="outline" className="flex items-center gap-1">
							<Users className="h-3 w-3" />
							{teamSize}
						</Badge>
					)}
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<span>
									<Button
										type="button"
										size="sm"
										variant="ghost"
										onClick={onRemove}
										disabled={isOnly}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</span>
							</TooltipTrigger>
							{isOnly && (
								<TooltipContent>
									Series must have at least one division
								</TooltipContent>
							)}
						</Tooltip>
					</TooltipProvider>
				</div>
			</div>
		</div>
	)
}
