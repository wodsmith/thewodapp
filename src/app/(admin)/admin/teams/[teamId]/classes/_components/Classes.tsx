"use client"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useServerAction } from "zsa-react"
import {
	createClassCatalog,
	deleteClassCatalog,
} from "@/actions/gym-setup-actions"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { toast } from "sonner"
import { BookOpen, Plus, Trash2, Clock, Users } from "lucide-react"
import type { getClassCatalogByTeam } from "@/actions/gym-setup-actions"
import type { getSkillsByTeam } from "@/actions/gym-setup-actions"
import type { inferServerActionReturnData } from "zsa"
import { useRouter } from "next/navigation"

interface ClassesProps {
	classes: inferServerActionReturnData<typeof getClassCatalogByTeam>["data"]
	availableSkills: inferServerActionReturnData<typeof getSkillsByTeam>["data"]
	teamId: string
	teamSlug: string
}

const createClassFormSchema = z.object({
	name: z.string().min(1, "Class name is required"),
	description: z.string().optional(),
	durationMinutes: z.coerce
		.number()
		.int()
		.min(1, "Duration must be at least 1 minute"),
	maxParticipants: z.coerce
		.number()
		.int()
		.min(1, "Max participants must be at least 1"),
	skillIds: z.array(z.string()).optional(),
})

type CreateClassFormData = z.infer<typeof createClassFormSchema>

const Classes = ({
	classes,
	availableSkills,
	teamId,
	teamSlug,
}: ClassesProps) => {
	const router = useRouter()

	const { execute: createExecute, isPending } =
		useServerAction(createClassCatalog)
	const { execute: deleteExecute, isPending: isDeleting } =
		useServerAction(deleteClassCatalog)

	const form = useForm<CreateClassFormData>({
		resolver: zodResolver(createClassFormSchema),
		defaultValues: {
			name: "",
			description: "",
			durationMinutes: 60,
			maxParticipants: 15,
			skillIds: [],
		},
	})

	const selectedSkills = form.watch("skillIds") ?? []

	const onSubmit = async (data: CreateClassFormData) => {
		try {
			const [result, error] = await createExecute({
				...data,
				teamId,
			})

			if (error) {
				console.error("Failed to create class:", error)
				toast.error("Failed to create class. Please try again.")
				return
			}

			if (result?.success) {
				toast.success("Class created successfully!")
				form.reset()
				router.refresh()
			}
		} catch (error) {
			console.error("Error creating class:", error)
			toast.error("An unexpected error occurred. Please try again.")
		}
	}

	const handleSkillSelect = (skillId: string) => {
		const current = form.getValues("skillIds") ?? []
		if (!current.includes(skillId)) {
			form.setValue("skillIds", [...current, skillId])
		}
	}

	const handleSkillRemove = (skillId: string) => {
		const current = form.getValues("skillIds") ?? []
		form.setValue(
			"skillIds",
			current.filter((id) => id !== skillId),
		)
	}

	return (
		<div className="min-h-screen">
			<header className="border-b">
				<div className="container mx-auto px-6 py-4">
					<div className="flex items-center space-x-3">
						<BookOpen className="h-6 w-6" />
						<div>
							<h1 className="text-2xl font-bold">Class Catalog</h1>
							<p className="text-sm text-muted-foreground">
								Manage your gym's class offerings
							</p>
						</div>
					</div>
				</div>
			</header>

			<main className="container mx-auto px-6 py-8">
				{/* Add New Class */}
				<Card className="mb-8">
					<CardHeader>
						<CardTitle>Add New Class</CardTitle>
						<CardDescription>
							Create a new class type for your schedule
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Form {...form}>
							<form
								onSubmit={form.handleSubmit(onSubmit)}
								className="space-y-4"
							>
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Class Name</FormLabel>
											<FormControl>
												<Input placeholder="e.g., CrossFit WOD" {...field} />
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
												<Input
													placeholder="Brief class description..."
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<FormField
										control={form.control}
										name="durationMinutes"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Duration (minutes)</FormLabel>
												<FormControl>
													<Input
														type="number"
														placeholder="60"
														{...field}
														value={field.value || ""}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="maxParticipants"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Max Participants</FormLabel>
												<FormControl>
													<Input
														type="number"
														placeholder="15"
														{...field}
														value={field.value || ""}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<div>
									<Label>Required Skills & Certifications</Label>
									<Select onValueChange={handleSkillSelect}>
										<SelectTrigger>
											<SelectValue placeholder="Add skill..." />
										</SelectTrigger>
										<SelectContent>
											{availableSkills
												.filter((skill) => !selectedSkills.includes(skill.id))
												.map((skill) => (
													<SelectItem key={skill.id} value={skill.id}>
														{skill.name}
													</SelectItem>
												))}
										</SelectContent>
									</Select>

									{selectedSkills.length > 0 && (
										<div className="flex flex-wrap gap-2 mt-2">
											{selectedSkills.map((skillId) => {
												const skill = availableSkills.find(
													(s) => s.id === skillId,
												)
												return (
													<Badge
														key={skillId}
														variant="secondary"
														className="cursor-pointer hover:bg-red-100"
														onClick={() => handleSkillRemove(skillId)}
													>
														{skill?.name}
														<span className="ml-1 text-xs">×</span>
													</Badge>
												)
											})}
										</div>
									)}
									{availableSkills.length === 0 && (
										<p className="text-sm text-slate-600 mt-2">
											No skills available.{" "}
											<a
												href={`/admin/teams/${teamSlug}/gym-setup`}
												className="text-blue-600 hover:text-blue-800 underline"
											>
												Add skills
											</a>{" "}
											to assign requirements.
										</p>
									)}
								</div>

								<Button
									type="submit"
									className="w-full md:w-auto"
									disabled={isPending}
								>
									<Plus className="h-4 w-4 mr-2" />
									{isPending ? "Adding Class..." : "Add Class"}
								</Button>
							</form>
						</Form>
					</CardContent>
				</Card>

				{/* Existing Classes */}
				<div className="grid gap-6">
					{classes.length === 0 ? (
						<Card>
							<CardContent className="p-6 text-center">
								<BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
								<h3 className="text-lg font-medium mb-2">No classes yet</h3>
								<p className="text-muted-foreground">
									Add your first class to get started with scheduling.
								</p>
							</CardContent>
						</Card>
					) : (
						classes.map((classItem) => (
							<Card key={classItem.id}>
								<CardContent className="p-6">
									<div className="flex items-start justify-between">
										<div className="flex-1">
											<div className="flex items-center space-x-3 mb-3">
												<BookOpen className="h-5 w-5" />
												<div>
													<h3 className="text-xl font-semibold">
														{classItem.name}
													</h3>
													<p className="text-sm text-muted-foreground">
														{classItem.description}
													</p>
												</div>
											</div>

											<div className="flex flex-wrap items-center gap-4 mb-4">
												<div className="flex items-center space-x-1 text-sm text-muted-foreground">
													<Clock className="h-4 w-4" />
													<span>{classItem.durationMinutes} minutes</span>
												</div>
												<div className="flex items-center space-x-1 text-sm text-muted-foreground">
													<Users className="h-4 w-4" />
													<span>
														Max {classItem.maxParticipants} participants
													</span>
												</div>
											</div>

											<div>
												<Label className="text-sm font-medium mb-2 block">
													Required Skills:
												</Label>
												<div className="flex flex-wrap gap-2">
													{classItem.classToSkills.length > 0 ? (
														classItem.classToSkills.map((relation) => (
															<Badge
																key={relation.skill.id}
																variant="secondary"
															>
																{relation.skill.name}
															</Badge>
														))
													) : (
														<span className="text-sm text-muted-foreground">
															No skills assigned
														</span>
													)}
												</div>
											</div>
										</div>

										<Button
											variant="ghost"
											size="sm"
											className="ml-4"
											onClick={async () => {
												const [_result, err] = await deleteExecute({
													id: classItem.id,
													teamId,
												})
												if (err) {
													toast.error(err.message || "Failed to delete class.")
												} else {
													toast.success("Class deleted successfully!")
													router.refresh()
												}
											}}
											disabled={isDeleting}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</CardContent>
							</Card>
						))
					)}
				</div>
			</main>
		</div>
	)
}

export default Classes
