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
import { useServerAction } from "@repo/zsa-react"
import {
	createScalingGroupAction,
	getScalingGroupWithLevelsAction,
	updateScalingGroupAction,
} from "@/actions/scaling-actions"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
	group?: {
		id: string
		title: string
		description: string | null
		levels?: Array<{
			id: string
			label: string
			position: number
		}>
	} | null
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
	const [instanceId] = useState(() => Symbol("scaling-levels"))
	const [showLevelChangeWarning, setShowLevelChangeWarning] = useState(false)
	const [pendingFormData, setPendingFormData] = useState<FormValues | null>(
		null,
	)
	const isEditing = !!group

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			title: "",
			description: "",
			levels: [
				{ id: "default-1", label: "Rx", position: 0 },
				{ id: "default-2", label: "Scaled", position: 1 },
			],
		},
	})

	const { execute: createGroup, isPending: isCreating } = useServerAction(
		createScalingGroupAction,
	)

	const { execute: updateGroup, isPending: isUpdating } = useServerAction(
		updateScalingGroupAction,
	)

	const { execute: getGroupWithLevels } = useServerAction(
		getScalingGroupWithLevelsAction,
	)

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

			const [result] = await getGroupWithLevels({
				groupId: group.id,
				teamId,
			})

			if (result?.data) {
				const sortedLevels = result.data.levels
					.sort((a, b) => a.position - b.position)
					.map((level, index) => ({
						id: level.id,
						label: level.label,
						position: index,
					}))

				form.reset({
					title: result.data.title,
					description: result.data.description || "",
					levels: sortedLevels,
				})
			}

			setIsLoading(false)
		}

		if (open) {
			loadGroupData()
		}
	}, [group, open, teamId, form, getGroupWithLevels])

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

	// Function to detect if levels have changed compared to original group
	const haveLevelsChanged = (
		formLevels: FormValues["levels"],
		originalGroup?: typeof group,
	) => {
		if (!originalGroup?.levels) return false

		// Check if lengths differ
		if (formLevels.length !== originalGroup.levels.length) return true

		// Sort both arrays by position for comparison
		const sortedFormLevels = [...formLevels].sort(
			(a, b) => a.position - b.position,
		)
		const sortedOriginalLevels = [...originalGroup.levels].sort(
			(a, b) => a.position - b.position,
		)

		// Check if any level has different label or position
		for (let i = 0; i < sortedFormLevels.length; i++) {
			const formLevel = sortedFormLevels[i]
			const originalLevel = sortedOriginalLevels[i]

			if (
				formLevel &&
				originalLevel &&
				(formLevel.label !== originalLevel.label ||
					formLevel.position !== originalLevel.position)
			) {
				return true
			}
		}

		return false
	}

	const onSubmit = async (values: FormValues) => {
		// Remove the id field from levels for creation
		const levelsForSubmission = values.levels.map(({ label, position }) => ({
			label,
			position,
		}))

		if (isEditing && group) {
			// Check if levels have changed and warn user
			if (haveLevelsChanged(values.levels, group)) {
				setPendingFormData(values)
				setShowLevelChangeWarning(true)
				return
			}

			// For editing, we'll update the group and handle levels separately
			const [_result, error] = await updateGroup({
				groupId: group.id,
				teamId,
				title: values.title,
				description: values.description || undefined,
			})

			if (error) {
				toast.error(error.message || "Failed to update scaling group")
			} else {
				toast.success("Scaling group updated successfully")
				onSuccess()
			}
		} else {
			// For creating, send everything together
			const [_result, error] = await createGroup({
				teamId,
				title: values.title,
				description: values.description || undefined,
				levels: levelsForSubmission,
			})

			if (error) {
				toast.error(error.message || "Failed to create scaling group")
			} else {
				toast.success("Scaling group created successfully")
				onSuccess()
			}
		}
	}

	const handleConfirmWithoutLevels = async () => {
		if (!pendingFormData || !group) return

		setShowLevelChangeWarning(false)

		// Proceed with update without level changes
		const [_result, error] = await updateGroup({
			groupId: group.id,
			teamId,
			title: pendingFormData.title,
			description: pendingFormData.description || undefined,
		})

		if (error) {
			toast.error(error.message || "Failed to update scaling group")
		} else {
			toast.success(
				"Scaling group updated successfully (level changes ignored)",
			)
			onSuccess()
		}

		setPendingFormData(null)
	}

	const handleCancelLevelWarning = () => {
		setShowLevelChangeWarning(false)
		setPendingFormData(null)
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
										</FormDescription>
									</div>
									<Button type="button" size="sm" onClick={addLevel}>
										<Plus className="h-4 w-4 mr-1" />
										Add Level
									</Button>
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
								<Button type="submit" disabled={isCreating || isUpdating}>
									{isCreating || isUpdating
										? "Saving..."
										: isEditing
											? "Update"
											: "Create"}
								</Button>
							</DialogFooter>
						</form>
					</Form>
				)}
			</DialogContent>

			<AlertDialog
				open={showLevelChangeWarning}
				onOpenChange={setShowLevelChangeWarning}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Level Changes Detected</AlertDialogTitle>
						<AlertDialogDescription>
							You have made changes to the scaling levels (reordering or label
							edits), but these changes cannot be saved with the current update.
							<br />
							<br />
							If you continue, only the title and description will be updated.
							The level changes will be lost.
							<br />
							<br />
							Do you want to continue without saving the level changes, or
							cancel to keep editing?
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={handleCancelLevelWarning}>
							Cancel (Keep Editing)
						</AlertDialogCancel>
						<AlertDialogAction onClick={handleConfirmWithoutLevels}>
							Continue Without Level Changes
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Dialog>
	)
}
