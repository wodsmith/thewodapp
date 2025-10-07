"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, X } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { useServerAction } from "@repo/zsa-react"
import { createWorkoutAction } from "@/actions/workout-actions"
import { Button } from "@/components/ui/button"
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
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Movement, Tag, Workout } from "@/db/schema"

const createWorkoutSchema = z.object({
	name: z.string().min(1, "Workout name is required"),
	description: z.string().min(1, "Description is required"),
	scheme: z.enum(
		[
			"time",
			"time-with-cap",
			"rounds-reps",
			"reps",
			"emom",
			"load",
			"calories",
			"meters",
			"pass-fail",
		],
		{
			required_error: "Scheme is required",
		},
	),
	scope: z.enum(["private", "public"]).default("private"),
	roundsToScore: z.number().optional(),
	repsPerRound: z.number().optional(),
	selectedMovements: z.array(z.string()).default([]),
	selectedTags: z.array(z.string()).default([]),
})

type CreateWorkoutFormData = z.infer<typeof createWorkoutSchema>

interface CreateWorkoutModalProps {
	open: boolean
	onCloseAction: () => void
	onWorkoutCreatedAction: (workout: Workout) => void
	teamId: string
	trackId: string
	movements: Movement[]
	tags: Tag[]
}

export function CreateWorkoutModal({
	open,
	onCloseAction,
	onWorkoutCreatedAction,
	teamId,
	movements,
	tags: initialTags,
}: CreateWorkoutModalProps) {
	const [tags, setTags] = useState<Tag[]>(initialTags)
	const [newTag, setNewTag] = useState("")
	const [isSubmitting, setIsSubmitting] = useState(false)

	const form = useForm<CreateWorkoutFormData>({
		resolver: zodResolver(createWorkoutSchema),
		defaultValues: {
			name: "",
			description: "",
			scheme: undefined,
			scope: "private",
			roundsToScore: undefined,
			repsPerRound: undefined,
			selectedMovements: [],
			selectedTags: [],
		},
	})

	const { execute: createWorkout } = useServerAction(createWorkoutAction)

	const handleAddTag = () => {
		if (newTag && !tags.some((t) => t.name === newTag)) {
			const id = crypto.randomUUID()
			const newTagObj = {
				id,
				name: newTag,
				createdAt: null as any, // Temporary UI object
				updatedAt: null as any, // Temporary UI object
				updateCounter: null,
			}
			setTags([...tags, newTagObj])

			const currentSelectedTags = form.getValues("selectedTags")
			form.setValue("selectedTags", [...currentSelectedTags, id])
			setNewTag("")
		}
	}

	const handleSubmit = async (data: CreateWorkoutFormData) => {
		setIsSubmitting(true)
		try {
			const [result, error] = await createWorkout({
				workout: {
					name: data.name,
					description: data.description,
					scheme: data.scheme,
					scope: data.scope,
					repsPerRound: data.repsPerRound || null,
					roundsToScore: data.roundsToScore || null,
					sugarId: null,
					tiebreakScheme: null,
					secondaryScheme: null,
				},
				tagIds: data.selectedTags,
				movementIds: data.selectedMovements,
				teamId,
			})

			if (error || !result) {
				throw new Error(error?.message || "Failed to create workout")
			}

			toast.success("Workout created successfully!")
			onWorkoutCreatedAction(result.data)
			handleClose()
		} catch (error) {
			console.error("Failed to create workout:", error)
			toast.error(
				error instanceof Error ? error.message : "Failed to create workout",
			)
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleClose = () => {
		form.reset()
		setNewTag("")
		onCloseAction()
	}

	return (
		<Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
			<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto border-4 border-primary shadow-[8px_8px_0px_0px] shadow-primary rounded-none">
				<DialogHeader>
					<DialogTitle className="font-mono text-xl tracking-tight">
						Create New Workout
					</DialogTitle>
					<DialogDescription className="font-mono">
						Create a new workout and add it to your programming track.
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(handleSubmit)}
						className="space-y-6"
					>
						{/* Basic Information */}
						<div className="space-y-4">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Workout Name</FormLabel>
										<FormControl>
											<Input
												{...field}
												placeholder="e.g., Fran, Murph, Daily WOD..."
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
										<FormLabel>Description</FormLabel>
										<FormControl>
											<Textarea
												{...field}
												placeholder="Describe the workout format, movements, and structure..."
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="scheme"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Scoring Scheme</FormLabel>
										<Select
											onValueChange={field.onChange}
											defaultValue={field.value}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select scoring method" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="time">Time</SelectItem>
												<SelectItem value="time-with-cap">
													Time with Cap
												</SelectItem>
												<SelectItem value="rounds-reps">
													Rounds + Reps
												</SelectItem>
												<SelectItem value="reps">Reps</SelectItem>
												<SelectItem value="emom">EMOM</SelectItem>
												<SelectItem value="load">Load</SelectItem>
												<SelectItem value="calories">Calories</SelectItem>
												<SelectItem value="meters">Meters</SelectItem>
												<SelectItem value="pass-fail">Pass/Fail</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className="grid grid-cols-2 gap-4">
								<FormField
									control={form.control}
									name="roundsToScore"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Rounds to Score</FormLabel>
											<FormControl>
												<Input
													{...field}
													type="number"
													min="1"
													placeholder="Optional"
													onChange={(e) =>
														field.onChange(
															e.target.value
																? Number(e.target.value)
																: undefined,
														)
													}
												/>
											</FormControl>
											<FormDescription>
												Number of rounds to track for scoring
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="repsPerRound"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Reps per Round</FormLabel>
											<FormControl>
												<Input
													{...field}
													type="number"
													min="1"
													placeholder="Optional"
													onChange={(e) =>
														field.onChange(
															e.target.value
																? Number(e.target.value)
																: undefined,
														)
													}
												/>
											</FormControl>
											<FormDescription>Total reps per round</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<FormField
								control={form.control}
								name="scope"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Visibility</FormLabel>
										<Select
											onValueChange={field.onChange}
											defaultValue={field.value}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="private">
													Private (Only you)
												</SelectItem>
												<SelectItem value="public">
													Public (Everyone)
												</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						{/* Movements Section */}
						<div className="space-y-3">
							<Label>Movements</Label>
							<FormField
								control={form.control}
								name="selectedMovements"
								render={({ field }) => (
									<FormItem>
										<div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border-2 border-primary p-3 rounded-none">
											{movements.map((movement) => (
												<Label
													key={movement.id}
													className="flex items-center space-x-2 cursor-pointer font-mono text-sm"
												>
													<Checkbox
														checked={field.value.includes(movement.id)}
														onCheckedChange={(checked) => {
															const newValue = checked
																? [...field.value, movement.id]
																: field.value.filter((id) => id !== movement.id)
															field.onChange(newValue)
														}}
													/>
													<span>{movement.name}</span>
												</Label>
											))}
										</div>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						{/* Tags Section */}
						<div className="space-y-3">
							<Label>Tags</Label>

							{/* Add New Tag */}
							<div className="flex gap-2">
								<Input
									value={newTag}
									onChange={(e) => setNewTag(e.target.value)}
									placeholder="Add new tag..."
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault()
											handleAddTag()
										}
									}}
								/>
								<Button type="button" onClick={handleAddTag} size="icon">
									<Plus className="h-4 w-4" />
								</Button>
							</div>

							{/* Tag Selection */}
							<FormField
								control={form.control}
								name="selectedTags"
								render={({ field }) => (
									<FormItem>
										<div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border-2 border-primary p-3 rounded-none">
											{tags.map((tag) => (
												<Button
													key={tag.id}
													type="button"
													onClick={() => {
														const newValue = field.value.includes(tag.id)
															? field.value.filter((id) => id !== tag.id)
															: [...field.value, tag.id]
														field.onChange(newValue)
													}}
													variant={
														field.value.includes(tag.id) ? "default" : "outline"
													}
												>
													{tag.name}
													{field.value.includes(tag.id) && (
														<X className="inline ml-1 h-3 w-3" />
													)}
												</Button>
											))}
										</div>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<DialogFooter className="flex gap-2">
							<Button type="button" variant="outline" onClick={handleClose}>
								Cancel
							</Button>
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting ? "Creating..." : "Create Workout"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
