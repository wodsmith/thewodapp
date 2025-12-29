import { zodResolver } from "@hookform/resolvers/zod"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowLeft } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
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
import { createTeamFn } from "@/server-fns/team-settings-fns"

const formSchema = z.object({
	name: z
		.string()
		.min(1, "Team name is required")
		.max(100, "Team name is too long"),
	description: z.string().max(1000, "Description is too long").optional(),
})

type FormValues = z.infer<typeof formSchema>

export const Route = createFileRoute("/_protected/settings/teams/create/")({
	component: CreateTeamPage,
})

function CreateTeamPage() {
	const navigate = useNavigate()
	const createTeam = useServerFn(createTeamFn)

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			description: "",
		},
	})

	const onSubmit = async (data: FormValues) => {
		try {
			toast.loading("Creating team...")

			const result = await createTeam({
				data: {
					name: data.name,
					description: data.description,
				},
			})

			toast.dismiss()

			if (result.success && result.data) {
				toast.success("Team created successfully")
				const teamSlug = result.data.slug
				if (teamSlug) {
					navigate({
						to: "/settings/teams/$teamSlug",
						params: { teamSlug },
					})
				} else {
					navigate({ to: "/settings/teams" })
				}
			}
		} catch (error) {
			toast.dismiss()
			const message =
				error instanceof Error ? error.message : "Failed to create team"
			toast.error(message)
		}
	}

	return (
		<div className="space-y-6">
			{/* Header with back button */}
			<div className="flex items-center gap-3">
				<Button variant="outline" size="icon" asChild>
					<Link to="/settings/teams">
						<ArrowLeft className="h-5 w-5" />
					</Link>
				</Button>
				<div>
					<h1 className="text-2xl font-bold">Create a new team</h1>
					<p className="text-muted-foreground">
						Create a team to collaborate with others on projects and share
						resources.
					</p>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Team Details</CardTitle>
					<CardDescription>
						Enter the details for your new team.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Team Name</FormLabel>
										<FormControl>
											<Input placeholder="Enter team name" {...field} />
										</FormControl>
										<FormDescription>
											A unique name for your team
										</FormDescription>
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
												placeholder="Enter a brief description of your team"
												{...field}
												value={field.value || ""}
											/>
										</FormControl>
										<FormDescription>
											Optional description of your team's purpose
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className="flex gap-3">
								<Button type="button" variant="outline" asChild>
									<Link to="/settings/teams">Cancel</Link>
								</Button>
								<Button type="submit" disabled={form.formState.isSubmitting}>
									{form.formState.isSubmitting ? "Creating..." : "Create Team"}
								</Button>
							</div>
						</form>
					</Form>
				</CardContent>
			</Card>
		</div>
	)
}
