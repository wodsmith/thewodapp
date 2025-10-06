"use client"
import { zodResolver } from "@hookform/resolvers/zod"
import { Clock, Mail, Plus, Trash2, User, Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import type { inferServerActionReturnData } from "zsa"
import { useServerAction } from "zsa-react"
import type { getCoachesByTeam } from "@/actions/coach-actions"
import { createCoach, deleteCoach } from "@/actions/coach-actions"
import type { getSkillsByTeam } from "@/actions/gym-setup-actions"
import type { getTeamMembersAction } from "@/actions/team-membership-actions"
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
	DialogTrigger,
} from "@/components/ui/dialog"
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
import type { Coach } from "@/db/schema"

interface CoachesProps {
	coaches: inferServerActionReturnData<typeof getCoachesByTeam>["data"]
	teamMembers: inferServerActionReturnData<typeof getTeamMembersAction>["data"]
	availableSkills: inferServerActionReturnData<typeof getSkillsByTeam>["data"]
	teamId: string
	teamSlug: string
}

// Form schema for creating a coach
const createCoachFormSchema = z.object({
	userId: z.string().min(1, "Please select a team member"),
	weeklyClassLimit: z.coerce
		.number()
		.int()
		.min(0, "Weekly limit must be 0 or greater")
		.optional(),
	schedulingPreference: z
		.enum(["morning", "afternoon", "night", "any"])
		.optional(),
	skillIds: z.array(z.string()).optional(),
})

type CreateCoachFormData = z.infer<typeof createCoachFormSchema>

const Coaches = ({
	coaches,
	teamMembers,
	teamId,
	teamSlug,
	availableSkills,
}: CoachesProps) => {
	const [selectedSkills, setSelectedSkills] = useState<string[]>([])
	const [deletingCoaches, setDeletingCoaches] = useState<Set<string>>(new Set())
	const [coachToDelete, setCoachToDelete] = useState<string | null>(null)
	const router = useRouter()

	// Filter out team members who are already coaches
	const availableMembers = teamMembers.filter(
		(member) => !coaches.some((coach) => coach.userId === member.userId),
	)

	const timePreferences = [
		"morning",
		"afternoon",
		"night",
		"any",
	] satisfies Coach["schedulingPreference"][]

	// Server action hook
	const { execute: createCoachExecute, isPending } =
		useServerAction(createCoach)
	const { execute: deleteCoachExecute } = useServerAction(deleteCoach)

	// Form setup
	const form = useForm<CreateCoachFormData>({
		resolver: zodResolver(createCoachFormSchema),
		defaultValues: {
			userId: "",
			weeklyClassLimit: undefined,
			schedulingPreference: undefined,
			skillIds: [],
		},
	})

	// Form submission handler
	const onSubmit = async (data: CreateCoachFormData) => {
		try {
			const [result, error] = await createCoachExecute({
				...data,
				teamId,
				skillIds: selectedSkills,
				isActive: true,
			})

			if (error) {
				console.error("Failed to create coach:", error)
				toast.error("Failed to create coach. Please try again.")
				return
			}

			if (result?.success) {
				toast.success("Coach created successfully!")
				form.reset()
				setSelectedSkills([])
				router.refresh()
			}
		} catch (error) {
			console.error("Error creating coach:", error)
			toast.error("An unexpected error occurred. Please try again.")
		}
	}

	// Handle skill selection
	const handleSkillSelect = (skillId: string) => {
		if (!selectedSkills.includes(skillId)) {
			setSelectedSkills([...selectedSkills, skillId])
		}
	}

	// Handle skill removal
	const handleSkillRemove = (skillId: string) => {
		setSelectedSkills(selectedSkills.filter((id) => id !== skillId))
	}

	// Handle confirmed coach deletion
	const handleConfirmedDelete = async () => {
		if (!coachToDelete) return

		setDeletingCoaches((prev) => new Set(prev).add(coachToDelete))
		const [, err] = await deleteCoachExecute({
			id: coachToDelete,
			teamId,
		})
		setDeletingCoaches((prev) => {
			const updated = new Set(prev)
			updated.delete(coachToDelete)
			return updated
		})
		setCoachToDelete(null)

		if (err) {
			toast.error("Failed to delete coach.")
		} else {
			toast.success("Coach deleted successfully!")
			router.refresh()
		}
	}

	return (
		<div className="min-h-screen">
			<header className="border-b">
				<div className="container mx-auto px-6 py-4">
					<div className="flex items-center space-x-3">
						<Users className="h-6 w-6" />
						<div>
							<h1 className="text-2xl font-bold">Coach Management</h1>
							<p className="text-sm text-muted-foreground">
								Manage your coaching staff and their availability
							</p>
						</div>
					</div>
				</div>
			</header>

			<main className="container mx-auto px-6 py-8">
				{/* Add New Coach */}
				<Card className="mb-8">
					<CardHeader>
						<CardTitle>Add New Coach</CardTitle>
						<CardDescription>Add a new coach to your team</CardDescription>
					</CardHeader>
					<CardContent>
						<Form {...form}>
							<form
								onSubmit={form.handleSubmit(onSubmit)}
								className="space-y-4"
							>
								<FormField
									control={form.control}
									name="userId"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Select Team Member</FormLabel>
											<Select
												onValueChange={field.onChange}
												value={field.value}
											>
												<FormControl>
													<SelectTrigger>
														<SelectValue placeholder="Select a team member to make coach" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{availableMembers.map((member) => (
														<SelectItem key={member.id} value={member.userId}>
															{member.user.firstName} {member.user.lastName}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<FormMessage />
											{availableMembers.length === 0 && (
												<p className="text-sm text-muted-foreground mt-2">
													No available team members to assign as coaches.{" "}
													<Link
														href={`/settings/teams/${teamSlug}`}
														className="text-primary hover:underline"
													>
														Invite new team members
													</Link>{" "}
													if you don't see the person you're looking for.
												</p>
											)}
										</FormItem>
									)}
								/>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<FormField
										control={form.control}
										name="weeklyClassLimit"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Weekly Class Limit</FormLabel>
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

									<FormField
										control={form.control}
										name="schedulingPreference"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Time Preference</FormLabel>
												<Select
													onValueChange={field.onChange}
													value={field.value}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select time preference" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														{timePreferences.map((time) => (
															<SelectItem key={time} value={time}>
																{time.charAt(0).toUpperCase() + time.slice(1)}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<div>
									<Label>Skills & Certifications</Label>
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
								</div>

								<Button
									type="submit"
									className="w-full md:w-auto"
									disabled={isPending || availableMembers.length === 0}
								>
									<Plus className="h-4 w-4 mr-2" />
									{isPending ? "Adding Coach..." : "Add Coach"}
								</Button>
							</form>
						</Form>
					</CardContent>
				</Card>

				{/* Existing Coaches */}
				<div className="grid gap-6">
					{coaches.length === 0 ? (
						<Card>
							<CardContent className="p-6 text-center">
								<Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
								<h3 className="text-lg font-medium mb-2">No coaches yet</h3>
								<p className="text-muted-foreground">
									Add your first coach to get started with scheduling.
								</p>
							</CardContent>
						</Card>
					) : (
						coaches.map((coach) => (
							<Card key={coach.id}>
								<CardContent className="p-6">
									<div className="flex items-start justify-between">
										<div className="flex-1">
											<div className="flex items-center space-x-3 mb-4">
												<User className="h-6 w-6" />
												<div>
													<h3 className="text-xl font-semibold">
														{coach.user.firstName} {coach.user.lastName}
													</h3>
													<div className="flex items-center space-x-4 text-sm text-muted-foreground">
														<div className="flex items-center space-x-1">
															<Mail className="h-3 w-3" />
															<span>{coach.user.email}</span>
														</div>
													</div>
												</div>
											</div>

											<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
												<div>
													<Label className="text-sm font-medium mb-2 block">
														Weekly Limit:
													</Label>
													<div className="flex items-center space-x-1 text-sm text-muted-foreground">
														<Clock className="h-4 w-4" />
														<span>
															{coach.weeklyClassLimit || "N/A"} classes per week
														</span>
													</div>
												</div>
												<div>
													<Label className="text-sm font-medium mb-2 block">
														Time Preference:
													</Label>
													<Badge variant="outline">
														{coach.schedulingPreference
															? coach.schedulingPreference
																	.charAt(0)
																	.toUpperCase() +
																coach.schedulingPreference.slice(1)
															: "Any"}
													</Badge>
												</div>
											</div>

											<div>
												<Label className="text-sm font-medium mb-2 block">
													Skills & Certifications:
												</Label>
												<div className="flex flex-wrap gap-2">
													{coach.skills.length > 0 ? (
														coach.skills.map((skillRelation) => (
															<Badge
																key={skillRelation.skill.id}
																variant="secondary"
															>
																{skillRelation.skill.name}
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

										<Dialog
											open={coachToDelete === coach.id}
											onOpenChange={(open) => {
												if (!open) setCoachToDelete(null)
											}}
										>
											<DialogTrigger asChild>
												<Button
													variant="ghost"
													size="sm"
													className="ml-4"
													onClick={() => setCoachToDelete(coach.id)}
													disabled={deletingCoaches.has(coach.id)}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</DialogTrigger>
											<DialogContent>
												<DialogHeader>
													<DialogTitle>Delete Coach</DialogTitle>
													<DialogDescription>
														Are you sure you want to delete{" "}
														<strong>
															{coach.user.firstName} {coach.user.lastName}
														</strong>
														? This action cannot be undone.
													</DialogDescription>
												</DialogHeader>
												<DialogFooter>
													<Button
														variant="outline"
														onClick={() => setCoachToDelete(null)}
													>
														Cancel
													</Button>
													<Button
														variant="destructive"
														onClick={handleConfirmedDelete}
														disabled={deletingCoaches.has(coach.id)}
													>
														{deletingCoaches.has(coach.id)
															? "Deleting..."
															: "Delete"}
													</Button>
												</DialogFooter>
											</DialogContent>
										</Dialog>
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

export default Coaches
