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
import { useServerFn } from "@tanstack/react-start"
import {
	CheckCircle2,
	Edit2,
	GripVertical,
	Plus,
	Trash2,
	Users,
	XCircle,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
	createQuestionFn,
	deleteQuestionFn,
	QUESTION_TYPES,
	type RegistrationQuestion,
	reorderQuestionsFn,
	updateQuestionFn,
} from "@/server-fns/registration-questions-fns"

// ============================================================================
// Types & Schema
// ============================================================================

const questionFormSchema = z.object({
	type: z.enum(QUESTION_TYPES),
	label: z.string().min(1, "Label is required").max(500),
	helpText: z.string().max(1000).optional(),
	options: z.array(z.string().max(200).min(1)).max(20).optional(),
	required: z.boolean(),
	forTeammates: z.boolean(),
})

type QuestionFormValues = z.infer<typeof questionFormSchema>

interface RegistrationQuestionsEditorProps {
	competitionId: string
	teamId: string
	questions: RegistrationQuestion[]
	onQuestionsChange: () => void
}

interface QuestionItemProps {
	question: RegistrationQuestion
	index: number
	instanceId: symbol
	onEdit: () => void
	onDelete: () => void
	onDrop: (sourceIndex: number, targetIndex: number) => void
}

// ============================================================================
// Question Type Badge Component
// ============================================================================

function QuestionTypeBadge({ type }: { type: string }) {
	const variants: Record<
		string,
		{ label: string; variant: "default" | "secondary" | "outline" }
	> = {
		text: { label: "Text", variant: "secondary" },
		select: { label: "Select", variant: "default" },
		number: { label: "Number", variant: "outline" },
	}

	const config = variants[type] || variants.text

	return <Badge variant={config.variant}>{config.label}</Badge>
}

// ============================================================================
// Draggable Question Item Component
// ============================================================================

function QuestionItem({
	question,
	index,
	instanceId,
	onEdit,
	onDelete,
	onDrop,
}: QuestionItemProps) {
	const ref = useRef<HTMLDivElement>(null)
	const dragHandleRef = useRef<HTMLButtonElement>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [closestEdge, setClosestEdge] = useState<Edge | null>(null)
	const closestEdgeRef = useRef<Edge | null>(null)

	useEffect(() => {
		const element = ref.current
		const dragHandle = dragHandleRef.current
		if (!element || !dragHandle) return

		const questionData = {
			id: question.id,
			index,
			instanceId,
		}

		return combine(
			draggable({
				element: dragHandle,
				getInitialData: () => questionData,
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
							preview.textContent = question.label || "Question"
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
					return attachClosestEdge(questionData, {
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
	}, [question.id, question.label, index, instanceId, onDrop])

	return (
		<div ref={ref} className="relative">
			{closestEdge && <DropIndicator edge={closestEdge} gap="2px" />}
			<div
				className={`flex items-start gap-3 p-4 border rounded-lg bg-background ${
					isDragging ? "opacity-50" : ""
				}`}
			>
				<button
					ref={dragHandleRef}
					type="button"
					className="cursor-grab active:cursor-grabbing mt-1"
					aria-label="Drag to reorder"
				>
					<GripVertical className="h-5 w-5 text-muted-foreground" />
				</button>

				<div className="flex-1 space-y-2">
					<div className="flex items-start justify-between gap-2">
						<div className="flex-1">
							<h4 className="font-medium">{question.label}</h4>
							{question.helpText && (
								<p className="text-sm text-muted-foreground mt-1">
									{question.helpText}
								</p>
							)}
						</div>
						<div className="flex items-center gap-2">
							<Button type="button" size="sm" variant="ghost" onClick={onEdit}>
								<Edit2 className="h-4 w-4" />
							</Button>
							<Button
								type="button"
								size="sm"
								variant="ghost"
								onClick={onDelete}
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					</div>

					<div className="flex items-center gap-2 flex-wrap">
						<QuestionTypeBadge type={question.type} />
						{question.required ? (
							<Badge variant="destructive" className="flex items-center gap-1">
								<CheckCircle2 className="h-3 w-3" />
								Required
							</Badge>
						) : (
							<Badge variant="outline" className="flex items-center gap-1">
								<XCircle className="h-3 w-3" />
								Optional
							</Badge>
						)}
						{question.forTeammates && (
							<Badge variant="secondary" className="flex items-center gap-1">
								<Users className="h-3 w-3" />
								For Teammates
							</Badge>
						)}
					</div>

					{question.type === "select" && question.options && (
						<div className="text-sm text-muted-foreground">
							<span className="font-medium">Options:</span>{" "}
							{question.options.join(", ")}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

// ============================================================================
// Question Form Dialog Component
// ============================================================================

interface QuestionFormDialogProps {
	competitionId: string
	teamId: string
	question: RegistrationQuestion | null
	open: boolean
	onClose: () => void
	onSuccess: () => void
}

function QuestionFormDialog({
	competitionId,
	teamId,
	question,
	open,
	onClose,
	onSuccess,
}: QuestionFormDialogProps) {
	const [isSaving, setIsSaving] = useState(false)
	const [optionInput, setOptionInput] = useState("")
	const isEditing = !!question

	const createQuestion = useServerFn(createQuestionFn)
	const updateQuestion = useServerFn(updateQuestionFn)

	const form = useForm<QuestionFormValues>({
		resolver: zodResolver(questionFormSchema),
		defaultValues: {
			type: "text",
			label: "",
			helpText: "",
			options: [],
			required: true,
			forTeammates: false,
		},
	})

	// Reset form when dialog opens/closes or question changes
	useEffect(() => {
		if (open) {
			if (question) {
				form.reset({
					type: question.type,
					label: question.label,
					helpText: question.helpText || "",
					options: question.options || [],
					required: question.required,
					forTeammates: question.forTeammates,
				})
			} else {
				form.reset({
					type: "text",
					label: "",
					helpText: "",
					options: [],
					required: true,
					forTeammates: false,
				})
			}
			setOptionInput("")
		}
	}, [open, question, form])

	const selectedType = form.watch("type")
	const options = form.watch("options") || []

	const addOption = () => {
		if (!optionInput.trim()) return
		if (options.includes(optionInput.trim())) {
			toast.error("Option already exists")
			return
		}
		form.setValue("options", [...options, optionInput.trim()])
		setOptionInput("")
	}

	const removeOption = (index: number) => {
		form.setValue(
			"options",
			options.filter((_, i) => i !== index),
		)
	}

	const onSubmit = async (values: QuestionFormValues) => {
		if (
			values.type === "select" &&
			(!values.options || values.options.length === 0)
		) {
			toast.error("Select questions must have at least one option")
			return
		}

		setIsSaving(true)

		try {
			if (isEditing && question) {
				await updateQuestion({
					data: {
						questionId: question.id,
						teamId,
						type: values.type,
						label: values.label,
						helpText: values.helpText || null,
						options: values.type === "select" ? values.options : null,
						required: values.required,
						forTeammates: values.forTeammates,
					},
				})
				toast.success("Question updated successfully")
			} else {
				await createQuestion({
					data: {
						competitionId,
						teamId,
						type: values.type,
						label: values.label,
						helpText: values.helpText || null,
						options: values.type === "select" ? values.options : null,
						required: values.required,
						forTeammates: values.forTeammates,
					},
				})
				toast.success("Question created successfully")
			}

			onSuccess()
			onClose()
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: `Failed to ${isEditing ? "update" : "create"} question`,
			)
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						{isEditing ? "Edit" : "Add"} Registration Question
					</DialogTitle>
					<DialogDescription>
						Custom questions that athletes must answer during registration.
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="type"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Question Type</FormLabel>
									<Select
										onValueChange={field.onChange}
										defaultValue={field.value}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select a type" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value="text">Text</SelectItem>
											<SelectItem value="select">Select (Dropdown)</SelectItem>
											<SelectItem value="number">Number</SelectItem>
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="label"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Question Label</FormLabel>
									<FormControl>
										<Input
											placeholder="e.g., What is your t-shirt size?"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="helpText"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Help Text (Optional)</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Additional instructions or context for athletes..."
											rows={2}
											{...field}
										/>
									</FormControl>
									<FormDescription>
										Shown below the question to provide additional guidance.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						{selectedType === "select" && (
							<div className="space-y-2">
								<FormLabel>Options</FormLabel>
								<div className="flex gap-2">
									<Input
										value={optionInput}
										onChange={(e) => setOptionInput(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault()
												addOption()
											}
										}}
										placeholder="Enter an option"
									/>
									<Button type="button" onClick={addOption}>
										<Plus className="h-4 w-4" />
									</Button>
								</div>
								{options.length > 0 && (
									<div className="space-y-1 mt-2">
										{/* biome-ignore lint/suspicious/noArrayIndexKey: options are user-editable strings, index is the stable key */}
										{options.map((option, index) => (
											<div
												key={index}
												className="flex items-center justify-between p-2 border rounded"
											>
												<span className="text-sm">{option}</span>
												<Button
													type="button"
													size="sm"
													variant="ghost"
													onClick={() => removeOption(index)}
												>
													<Trash2 className="h-3 w-3" />
												</Button>
											</div>
										))}
									</div>
								)}
								{options.length === 0 && (
									<p className="text-sm text-muted-foreground">
										No options added yet. Add at least one option.
									</p>
								)}
							</div>
						)}

						<FormField
							control={form.control}
							name="required"
							render={({ field }) => (
								<FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
									<FormControl>
										<Checkbox
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
									<div className="space-y-1 leading-none">
										<FormLabel>Required Question</FormLabel>
										<FormDescription>
											Athletes must answer this question to complete
											registration.
										</FormDescription>
									</div>
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="forTeammates"
							render={({ field }) => (
								<FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
									<FormControl>
										<Checkbox
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
									<div className="space-y-1 leading-none">
										<FormLabel>Ask Teammates Separately</FormLabel>
										<FormDescription>
											For team registrations, ask this question for each
											teammate individually.
										</FormDescription>
									</div>
								</FormItem>
							)}
						/>

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
			</DialogContent>
		</Dialog>
	)
}

// ============================================================================
// Main Editor Component
// ============================================================================

export function RegistrationQuestionsEditor({
	competitionId,
	teamId,
	questions: initialQuestions,
	onQuestionsChange,
}: RegistrationQuestionsEditorProps) {
	const [questions, setQuestions] = useState(initialQuestions)
	const [instanceId] = useState(() => Symbol("registration-questions"))
	const [editingQuestion, setEditingQuestion] =
		useState<RegistrationQuestion | null>(null)
	const [deletingQuestion, setDeletingQuestion] =
		useState<RegistrationQuestion | null>(null)
	const [isFormOpen, setIsFormOpen] = useState(false)

	const reorderQuestions = useServerFn(reorderQuestionsFn)
	const deleteQuestion = useServerFn(deleteQuestionFn)

	// Update local state when prop changes
	useEffect(() => {
		setQuestions(initialQuestions)
	}, [initialQuestions])

	const handleDrop = async (sourceIndex: number, targetIndex: number) => {
		const newQuestions = [...questions]
		const [movedItem] = newQuestions.splice(sourceIndex, 1)
		if (movedItem) {
			newQuestions.splice(targetIndex, 0, movedItem)
			setQuestions(newQuestions)

			try {
				await reorderQuestions({
					data: {
						competitionId,
						teamId,
						orderedQuestionIds: newQuestions.map((q) => q.id),
					},
				})
				onQuestionsChange()
			} catch (_error) {
				toast.error("Failed to reorder questions")
				setQuestions(questions) // Revert on error
			}
		}
	}

	const handleEdit = (question: RegistrationQuestion) => {
		setEditingQuestion(question)
		setIsFormOpen(true)
	}

	const handleDelete = async () => {
		if (!deletingQuestion) return

		try {
			await deleteQuestion({
				data: {
					questionId: deletingQuestion.id,
					teamId,
				},
			})
			toast.success("Question deleted successfully")
			setDeletingQuestion(null)
			onQuestionsChange()
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to delete question",
			)
		}
	}

	const handleAddNew = () => {
		setEditingQuestion(null)
		setIsFormOpen(true)
	}

	const handleFormClose = () => {
		setIsFormOpen(false)
		setEditingQuestion(null)
	}

	const handleFormSuccess = () => {
		onQuestionsChange()
	}

	return (
		<>
			<Card>
				<CardHeader>
					<div className="flex items-start justify-between">
						<div>
							<CardTitle>Registration Questions</CardTitle>
							<CardDescription>
								Custom questions athletes must answer during registration
							</CardDescription>
						</div>
						<Button onClick={handleAddNew}>
							<Plus className="h-4 w-4 mr-2" />
							Add Question
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{questions.length === 0 ? (
						<div className="text-center py-12 text-muted-foreground">
							<p className="text-lg font-medium mb-2">No questions yet</p>
							<p className="text-sm">
								Add custom questions to gather information from athletes during
								registration.
							</p>
						</div>
					) : (
						<div className="space-y-2">
							{questions.map((question, index) => (
								<QuestionItem
									key={question.id}
									question={question}
									index={index}
									instanceId={instanceId}
									onEdit={() => handleEdit(question)}
									onDelete={() => setDeletingQuestion(question)}
									onDrop={handleDrop}
								/>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			<QuestionFormDialog
				competitionId={competitionId}
				teamId={teamId}
				question={editingQuestion}
				open={isFormOpen}
				onClose={handleFormClose}
				onSuccess={handleFormSuccess}
			/>

			<AlertDialog
				open={!!deletingQuestion}
				onOpenChange={(open) => !open && setDeletingQuestion(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Question</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete "{deletingQuestion?.label}"? This
							will also delete all athlete answers to this question. This action
							cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}
