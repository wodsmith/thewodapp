"use client"

import { createWorkoutAction } from "@/actions/workout-actions"
import {
	type CreateWorkoutSchema,
	createWorkoutSchema,
} from "@/app/(main)/workouts/new/_components/create-workout.schema"
import { Button } from "@/components/ui/button"
import {
	Form,
	FormControl,
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
import type { Movement } from "@/db/schema"
import type { Tag } from "@/db/schema"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import React from "react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { useServerAction } from "zsa-react"

interface Props {
	movements: Movement[]
	tags: Tag[]
	userId: string
	createWorkoutAction?: typeof createWorkoutAction
}

export default function CreateWorkoutClient({
	movements,
	tags: initialTags,
	userId,
	createWorkoutAction: createWorkoutActionProp,
}: Props) {
	const [tags, setTags] = useState<Tag[]>(initialTags)
	const [newTag, setNewTag] = useState("")
	const router = useRouter()

	const form = useForm<CreateWorkoutSchema>({
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

	const { execute: executeCreateWorkout } = useServerAction(
		createWorkoutActionProp || createWorkoutAction,
		{
			onError: (error) => {
				console.error("Server action error:", error)
				toast.error(
					error.err?.message || "An error occurred creating the workout",
				)
			},
			onSuccess: (result) => {
				toast.success("Workout created successfully")
				router.push(`/workouts/${result.data.id}`)
			},
		},
	)

	const handleAddTag = () => {
		if (newTag && !tags.some((t) => t.name === newTag)) {
			const id = crypto.randomUUID()
			const newTagObj = {
				id,
				name: newTag,
				createdAt: new Date(),
				updatedAt: new Date(),
				updateCounter: null,
			}
			setTags([...tags, newTagObj])

			const currentSelectedTags = form.getValues("selectedTags")
			form.setValue("selectedTags", [...currentSelectedTags, id])
			setNewTag("")
		}
	}

	const handleMovementToggle = (movementId: string) => {
		const currentSelectedMovements = form.getValues("selectedMovements")
		if (currentSelectedMovements.includes(movementId)) {
			form.setValue(
				"selectedMovements",
				currentSelectedMovements.filter((id) => id !== movementId),
			)
		} else {
			form.setValue("selectedMovements", [
				...currentSelectedMovements,
				movementId,
			])
		}
	}

	const handleTagToggle = (tagId: string) => {
		const currentSelectedTags = form.getValues("selectedTags")
		if (currentSelectedTags.includes(tagId)) {
			form.setValue(
				"selectedTags",
				currentSelectedTags.filter((id) => id !== tagId),
			)
		} else {
			form.setValue("selectedTags", [...currentSelectedTags, tagId])
		}
	}

	const onSubmit = async (data: CreateWorkoutSchema) => {
		const workoutId = `workout_${crypto.randomUUID()}`

		await executeCreateWorkout({
			workout: {
				id: workoutId,
				name: data.name,
				description: data.description,
				scheme: data.scheme,
				scope: data.scope,
				roundsToScore: data.roundsToScore ?? null,
				repsPerRound: data.repsPerRound ?? null,
				sugarId: null,
				tiebreakScheme: null,
				secondaryScheme: null,
			},
			tagIds: data.selectedTags,
			movementIds: data.selectedMovements,
			userId,
		})
	}

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Button asChild variant="outline" size="icon">
						<Link href="/workouts">
							<ArrowLeft className="h-5 w-5" />
						</Link>
					</Button>
					<h1>CREATE WORKOUT</h1>
				</div>
			</div>

			<Form {...form}>
				<form
					className="border-2 border-black p-6"
					onSubmit={form.handleSubmit(onSubmit)}
				>
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div className="space-y-6">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="font-bold uppercase">
											Workout Name
										</FormLabel>
										<FormControl>
											<Input
												placeholder="e.g., Fran, Cindy, Custom WOD"
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
										<FormLabel className="font-bold uppercase">
											Description
										</FormLabel>
										<FormControl>
											<Textarea
												rows={4}
												placeholder="Describe the workout (e.g., 21-15-9 reps for time of Thrusters and Pull-ups)"
												{...field}
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
										<FormLabel className="font-bold uppercase">
											Scheme
										</FormLabel>
										<Select onValueChange={field.onChange} value={field.value}>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select a scheme" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="time">For Time</SelectItem>
												<SelectItem value="time-with-cap">
													For Time (with cap)
												</SelectItem>
												<SelectItem value="rounds-reps">
													AMRAP (Rounds + Reps)
												</SelectItem>
												<SelectItem value="reps">Max Reps</SelectItem>
												<SelectItem value="emom">EMOM</SelectItem>
												<SelectItem value="load">Max Load</SelectItem>
												<SelectItem value="calories">Calories</SelectItem>
												<SelectItem value="meters">Meters</SelectItem>
												<SelectItem value="pass-fail">Pass/Fail</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="scope"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="font-bold uppercase">Scope</FormLabel>
										<Select onValueChange={field.onChange} value={field.value}>
											<FormControl>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="private">Private</SelectItem>
												<SelectItem value="public">Public</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="roundsToScore"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="font-bold uppercase">
											Rounds to Score
										</FormLabel>
										<FormControl>
											<Input
												type="number"
												placeholder="e.g., 4 (default is 1)"
												value={field.value === undefined ? "" : field.value}
												onChange={(e) =>
													field.onChange(
														e.target.value
															? Number.parseInt(e.target.value)
															: undefined,
													)
												}
												min="0"
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="repsPerRound"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="font-bold uppercase">
											Reps per Round (if applicable)
										</FormLabel>
										<FormControl>
											<Input
												type="number"
												placeholder="e.g., 10"
												value={field.value === undefined ? "" : field.value}
												onChange={(e) =>
													field.onChange(
														e.target.value
															? Number.parseInt(e.target.value)
															: undefined,
													)
												}
												min="0"
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div>
								<Label
									htmlFor="add-tag-input"
									className="mb-2 block font-bold uppercase"
								>
									Tags
								</Label>
								<div className="mb-2 flex gap-2">
									<Input
										id="add-tag-input"
										type="text"
										className="flex-1"
										placeholder="Add a tag"
										value={newTag}
										onChange={(e) => setNewTag(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault()
												handleAddTag()
											}
										}}
									/>
									<Button type="button" onClick={handleAddTag}>
										<Plus className="h-5 w-5" />
									</Button>
								</div>

								<div className="mt-2 flex flex-wrap gap-2">
									{tags.map((tag) => {
										const selectedTags = form.watch("selectedTags")
										const isSelected = selectedTags.includes(tag.id)
										return (
											<button
												type="button"
												key={tag.id}
												onClick={() => handleTagToggle(tag.id)}
												onKeyDown={(e) => {
													if (e.key === "Enter" || e.key === " ") {
														e.preventDefault()
														handleTagToggle(tag.id)
													}
												}}
												aria-pressed={isSelected}
												className={`flex cursor-pointer items-center border-2 border-black px-2 py-1 ${
													isSelected ? "bg-black text-white" : ""
												}`}
											>
												<span className="mr-2">{tag.name}</span>
												{isSelected && <span className="text-xs">✓</span>}
											</button>
										)
									})}
								</div>
							</div>
						</div>

						<div>
							<Label
								htmlFor="movements-list"
								className="mb-2 block font-bold uppercase"
							>
								Movements
							</Label>
							<div
								id="movements-list"
								className="h-[500px] overflow-y-auto border-2 border-black p-4"
							>
								<div className="space-y-2">
									{movements.map((movement) => {
										const selectedMovements = form.watch("selectedMovements")
										const isSelected = selectedMovements.includes(movement.id)
										return (
											<button
												type="button"
												key={movement.id}
												onClick={() => handleMovementToggle(movement.id)}
												onKeyDown={(e) => {
													if (e.key === "Enter" || e.key === " ") {
														e.preventDefault()
														handleMovementToggle(movement.id)
													}
												}}
												aria-pressed={isSelected}
												className={`flex cursor-pointer items-center border-2 border-black px-2 py-1 ${
													isSelected ? "bg-black text-white" : ""
												}`}
											>
												<div className="flex items-center justify-between">
													<span className="font-bold">{movement.name}</span>
													{isSelected && <span className="text-xs">✓</span>}
												</div>
											</button>
										)
									})}
								</div>
							</div>
						</div>
					</div>

					<div className="mt-6 flex justify-end gap-4">
						<Button asChild variant="outline">
							<Link href="/workouts">Cancel</Link>
						</Button>
						<Button type="submit" disabled={form.formState.isSubmitting}>
							{form.formState.isSubmitting ? "Creating..." : "Create Workout"}
						</Button>
					</div>
				</form>
			</Form>
		</div>
	)
}
