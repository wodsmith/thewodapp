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
import { zodResolver } from "@hookform/resolvers/zod"
import { GripVertical, Plus, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
	createScalingGroupFn,
	getScalingGroupWithLevelsFn,
	type ScalingGroupWithLevels,
	updateScalingGroupFn,
} from "@/server-fns/scaling-fns"

const formSchema = z.object({
	title: z.string().min(1, "Title is required").max(100),
	description: z.string().max(500).optional(),
	levels: z
		.array(
			z.object({
				id: z.string(),
				label: z.string().min(1, "Label is required").max(100),
				position: z.number(),
			}),
		)
		.min(1, "At least one scaling level is required"),
})

type FormValues = z.infer<typeof formSchema>

interface ScalingGroupDialogProps {
	teamId: string
	group?: ScalingGroupWithLevels | null
	open: boolean
	onClose: () => void
	onSuccess: () => void
}

interface ScalingLevelItemProps {
	id: string
	label: string
	index: number
	onRemove: () => void
	onLabelChange: (value: string) => void
	instanceId: symbol
	onDrop: (sourceIndex: number, targetIndex: number) => void
}

function ScalingLevelItem({
	id,
	label,
	index,
	onRemove,
	onLabelChange,
	instanceId,
	onDrop,
}: ScalingLevelItemProps) {
	const ref = useRef<HTMLDivElement>(null)
	const dragHandleRef = useRef<HTMLButtonElement>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [closestEdge, setClosestEdge] = useState<Edge | null>(null)

	useEffect(() => {
		const element = ref.current
		const dragHandle = dragHandleRef.current
		if (!element || !dragHandle) return

		const levelData = {
			id,
			index,
			instanceId,
		}

		return combine(
			draggable({
				element: dragHandle,
				getInitialData: () => levelData,
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
							preview.textContent = label || "Scaling Level"
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
					return attachClosestEdge(levelData, {
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
	}, [id, label, index, instanceId, onDrop, closestEdge])

	return (
		<div ref={ref} className="relative">
			{closestEdge && <DropIndicator edge={closestEdge} gap="2px" />}
			<div
				className={`flex items-center gap-2 p-3 border rounded-lg bg-background ${
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
				<span className="text-sm font-mono text-muted-foreground w-8">
					#{index + 1}
				</span>
				<Input
					value={label}
					onChange={(e) => onLabelChange(e.target.value)}
					placeholder="Enter level name"
					className="flex-1"
				/>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					onClick={onRemove}
					disabled={index === 0} // Can't remove first level
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>
		</div>
	)
}

export function ScalingGroupDialog({
	teamId,
	group,
	open,
	onClose,
	onSuccess,
}: ScalingGroupDialogProps) {
	const [isLoading, setIsLoading] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [instanceId] = useState(() => Symbol("scaling-levels"))
	const isEditing = !!group

	const form = useForm<FormValues>({
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		resolver: zodResolver(formSchema as any),
		defaultValues: {
			title: "",
			description: "",
			levels: [
				{ id: "default-1", label: "Rx", position: 0 },
				{ id: "default-2", label: "Scaled", position: 1 },
			],
		},
	})

	// Load group data when editing
	useEffect(() => {
		const loadGroupData = async () => {
			if (!group) {
				form.reset({
					title: "",
					description: "",
					levels: [
						{ id: "default-1", label: "Rx", position: 0 },
						{ id: "default-2", label: "Scaled", position: 1 },
					],
				})
				return
			}

			setIsLoading(true)

			try {
				const result = await getScalingGroupWithLevelsFn({
					data: { groupId: group.id, teamId },
				})

				if (result?.scalingGroup) {
					const sortedLevels = result.scalingGroup.levels
						.sort((a, b) => a.position - b.position)
						.map((level, index) => ({
							id: level.id,
							label: level.label,
							position: index,
						}))

					form.reset({
						title: result.scalingGroup.title,
						description: result.scalingGroup.description || "",
						levels: sortedLevels,
					})
				}
			} catch (error) {
				console.error("Failed to load scaling group:", error)
			}

			setIsLoading(false)
		}

		if (open) {
			loadGroupData()
		}
	}, [group, open, teamId, form])

	const handleDrop = (sourceIndex: number, targetIndex: number) => {
		const levels = form.getValues("levels")
		const newLevels = [...levels]
		const [movedItem] = newLevels.splice(sourceIndex, 1)
		if (movedItem) {
			newLevels.splice(targetIndex, 0, movedItem)

			// Update positions
			const updatedLevels = newLevels.map((level, index) => ({
				...level,
				position: index,
			}))

			form.setValue("levels", updatedLevels)
		}
	}

	const addLevel = () => {
		const levels = form.getValues("levels")
		const newId = `new-${Date.now()}`
		form.setValue("levels", [
			...levels,
			{ id: newId, label: "", position: levels.length },
		])
	}

	const removeLevel = (index: number) => {
		const levels = form.getValues("levels")
		if (levels.length <= 1) return // Keep at least one level

		const newLevels = levels
			.filter((_, i) => i !== index)
			.map((level, i) => ({
				...level,
				position: i,
			}))

		form.setValue("levels", newLevels)
	}

	const updateLevelLabel = (index: number, label: string) => {
		const levels = form.getValues("levels")
		const level = levels[index]
		if (level) {
			level.label = label
			form.setValue("levels", [...levels])
		}
	}

	const onSubmit = async (values: FormValues) => {
		setIsSaving(true)

		try {
			if (isEditing && group) {
				// For editing, update the group (levels not currently editable after creation)
				await updateScalingGroupFn({
					data: {
						groupId: group.id,
						teamId,
						title: values.title,
						description: values.description || undefined,
					},
				})
				toast.success("Scaling group updated successfully")
			} else {
				// For creating, send everything together
				const levelsForSubmission = values.levels.map(
					({ label, position }) => ({
						label,
						position,
					}),
				)

				await createScalingGroupFn({
					data: {
						teamId,
						title: values.title,
						description: values.description || undefined,
						levels: levelsForSubmission,
					},
				})
				toast.success("Scaling group created successfully")
			}

			onSuccess()
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: `Failed to ${isEditing ? "update" : "create"} scaling group`,
			)
		} finally {
			setIsSaving(false)
		}
	}

	const levels = form.watch("levels")

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						{isEditing ? "Edit" : "Create"} Scaling Group
					</DialogTitle>
					<DialogDescription>
						Define custom scaling levels for your workouts. The first level is
						the hardest (most challenging), and each subsequent level is easier.
					</DialogDescription>
				</DialogHeader>

				{isLoading ? (
					<div className="flex items-center justify-center py-8">
						<span className="text-muted-foreground">Loading...</span>
					</div>
				) : (
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
							<FormField
								control={form.control}
								name="title"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Title</FormLabel>
										<FormControl>
											<Input
												placeholder="e.g., Competition Levels, Beginner Friendly"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="description"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Description (Optional)</FormLabel>
										<FormControl>
											<Textarea
												placeholder="Describe when to use this scaling group..."
												className="resize-none"
												rows={3}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<div>
										<FormLabel>Scaling Levels</FormLabel>
										<FormDescription>
											Drag to reorder. Top = Hardest, Bottom = Easiest
											{isEditing && (
												<span className="block text-yellow-600 mt-1">
													Note: Level changes are only applied on creation.
												</span>
											)}
										</FormDescription>
									</div>
									{!isEditing && (
										<Button type="button" size="sm" onClick={addLevel}>
											<Plus className="h-4 w-4 mr-1" />
											Add Level
										</Button>
									)}
								</div>

								<div className="space-y-2">
									{levels.map((level, index) => (
										<ScalingLevelItem
											key={level.id}
											id={level.id}
											label={level.label}
											index={index}
											instanceId={instanceId}
											onRemove={() => removeLevel(index)}
											onLabelChange={(value) => updateLevelLabel(index, value)}
											onDrop={handleDrop}
										/>
									))}
								</div>

								<FormMessage />
							</div>

							<DialogFooter>
								<Button type="button" variant="outline" onClick={onClose}>
									Cancel
								</Button>
								<Button type="submit" disabled={isSaving}>
									{isSaving ? "Saving..." : isEditing ? "Update" : "Create"}
								</Button>
							</DialogFooter>
						</form>
					</Form>
				)}
			</DialogContent>
		</Dialog>
	)
}
