/**
 * Organizer Onboard Page
 * Public page for teams to apply to become competition organizers.
 * Unauthenticated users are redirected to sign-in.
 * Authenticated users can select a team and submit an organizer request.
 *
 * Port from apps/wodsmith/src/app/(compete)/compete/(organizer-public)/organizer/onboard/page.tsx
 */

import { zodResolver } from "@hookform/resolvers/zod"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
	Calendar,
	ChartNoAxesColumn,
	ClipboardList,
	CreditCard,
	Plus,
	Trophy,
	Users,
} from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
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
	getOrganizerRequest,
	hasPendingOrganizerRequest,
	isApprovedOrganizer,
	submitOrganizerRequestFn,
} from "@/server-fns/organizer-onboarding-fns"
import { createTeamFn } from "@/server-fns/team-settings-fns"

const features = [
	{
		icon: Calendar,
		title: "Heat Scheduling",
		description:
			"Organize heats across venues with lane assignments and timing",
	},
	{
		icon: ClipboardList,
		title: "Live Scoring",
		description: "Real-time score entry with instant leaderboard updates",
	},
	{
		icon: Users,
		title: "Athlete Registration",
		description: "Online registration with division selection and waivers",
	},
	{
		icon: CreditCard,
		title: "Payment Processing",
		description: "Accept entry fees via Stripe with automatic payouts",
	},
	{
		icon: ChartNoAxesColumn,
		title: "Revenue Tracking",
		description: "Track registrations, revenue, and platform fees in real-time",
	},
	{
		icon: Trophy,
		title: "Public Competition Page",
		description:
			"Professional event page with schedule, results, and registration",
	},
]

const steps = [
	{
		number: "1",
		title: "Submit Application",
		description: "Tell us about your team and the competitions you want to run",
	},
	{
		number: "2",
		title: "Create Draft Competitions",
		description: "Start building your event immediately while we review",
	},
	{
		number: "3",
		title: "Get Approved",
		description:
			"Once approved, publish your competition and open registration",
	},
]

// Types
interface TeamInfo {
	id: string
	name: string
	type: string
	isPersonalTeam: boolean
}

interface LoaderData {
	isAuthenticated: boolean
	availableTeams: TeamInfo[]
}

// Form schema
const CREATE_NEW_TEAM = "__create_new__"

const formSchema = z.object({
	teamId: z.string().min(1, "Please select a team"),
	newTeamName: z.string().optional(),
	reason: z
		.string()
		.min(10, "Please provide more detail about why you want to organize")
		.max(2000, "Reason is too long"),
})

type FormValues = z.infer<typeof formSchema>

export const Route = createFileRoute("/compete/organizer/onboard/")({
	component: OrganizerOnboardPage,
	loader: async ({ context }): Promise<LoaderData> => {
		const session = context.session
		const isAuthenticated = !!session?.user

		// If not authenticated, redirect to sign-in
		if (!isAuthenticated) {
			throw redirect({
				to: "/sign-in",
				search: { redirect: "/compete/organizer/onboard" },
			})
		}

		// Get user's teams
		const userTeams = session.teams || []
		const gymTeams = userTeams.filter(
			(t) => t.type === "gym" && !t.isPersonalTeam,
		)

		// Check if any of the user's teams are already approved or have pending requests
		const teamStatuses = await Promise.all(
			gymTeams.map(async (team) => {
				const [approved, pending, request] = await Promise.all([
					isApprovedOrganizer(team.id),
					hasPendingOrganizerRequest(team.id),
					getOrganizerRequest(team.id),
				])
				return { team, isApproved: approved, isPending: pending, request }
			}),
		)

		// Check if any team is approved - redirect to organizer dashboard
		const approvedTeam = teamStatuses.find((s) => s.isApproved)
		if (approvedTeam) {
			throw redirect({ to: "/compete/organizer" })
		}

		// Check if any team has a pending request - redirect to pending page
		const pendingTeam = teamStatuses.find((s) => s.isPending)
		if (pendingTeam) {
			throw redirect({ to: "/compete/organizer/onboard/pending" })
		}

		// Filter to teams that haven't submitted a request yet
		const availableTeams: TeamInfo[] = teamStatuses
			.filter((s) => !s.isApproved && !s.isPending)
			.map((s) => ({
				id: s.team.id,
				name: s.team.name,
				type: s.team.type || "gym",
				isPersonalTeam: s.team.isPersonalTeam || false,
			}))

		return {
			isAuthenticated,
			availableTeams,
		}
	},
})

function OrganizerOnboardPage() {
	const { availableTeams } = Route.useLoaderData()

	return (
		<div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
			{/* Hero Section */}
			<div className="container mx-auto px-4 pt-12 pb-8">
				<div className="mx-auto max-w-3xl text-center">
					<div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
						<Trophy className="h-4 w-4" />
						WODsmith Compete
					</div>
					<h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
						Host Your Next Competition
					</h1>
					<p className="mt-4 text-lg text-muted-foreground">
						Everything you need to run professional CrossFit competitions. From
						registration to results, we've got you covered.
					</p>
				</div>
			</div>

			{/* Features Grid */}
			<div className="container mx-auto px-4 py-8">
				<div className="mx-auto max-w-5xl">
					<h2 className="mb-6 text-center text-xl font-semibold">
						What's included
					</h2>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{features.map((feature) => (
							<div
								key={feature.title}
								className="rounded-lg border bg-card p-5 transition-colors hover:bg-accent/50"
							>
								<feature.icon className="mb-3 h-6 w-6 text-primary" />
								<h3 className="font-semibold">{feature.title}</h3>
								<p className="mt-1 text-sm text-muted-foreground">
									{feature.description}
								</p>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* How It Works */}
			<div className="container mx-auto px-4 py-8">
				<div className="mx-auto max-w-3xl">
					<h2 className="mb-6 text-center text-xl font-semibold">
						How it works
					</h2>
					<div className="mx-auto flex w-fit flex-col gap-2">
						{steps.map((step, i) => (
							<div key={step.number}>
								<div className="flex items-start gap-3">
									<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
										{step.number}
									</div>
									<div>
										<h3 className="font-semibold">{step.title}</h3>
										<p className="mt-1 text-sm text-muted-foreground">
											{step.description}
										</p>
									</div>
								</div>
								{i < steps.length - 1 && (
									<div className="ml-4 h-6 border-l-2 border-dashed border-border" />
								)}
							</div>
						))}
					</div>
				</div>
			</div>

			{/* Application Form */}
			<div className="container mx-auto px-4 py-8 pb-16">
				<div className="mx-auto max-w-xl">
					<div className="rounded-xl border bg-card p-6 shadow-sm">
						<h2 className="mb-2 text-xl font-semibold">Apply Now</h2>
						<p className="mb-6 text-sm text-muted-foreground">
							Applications are typically reviewed within 24-48 hours. You can
							start creating draft competitions immediately after applying.
						</p>
						<OrganizerRequestForm teams={availableTeams} />
					</div>
				</div>
			</div>
		</div>
	)
}

/**
 * The organizer request form for authenticated users.
 * Allows selecting a team and submitting an application to become an organizer.
 */
function OrganizerRequestForm({ teams }: { teams: TeamInfo[] }) {
	const navigate = useNavigate()
	const [isCreatingTeam, setIsCreatingTeam] = useState(false)

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			teamId: teams.length === 1 ? teams[0]?.id : "",
			newTeamName: "",
			reason: "",
		},
	})

	const watchTeamId = form.watch("teamId")
	const showNewTeamFields = watchTeamId === CREATE_NEW_TEAM

	// Server function hooks
	const submitRequest = useServerFn(submitOrganizerRequestFn)
	const createTeam = useServerFn(createTeamFn)

	const [isSubmitting, setIsSubmitting] = useState(false)

	const onSubmit = async (data: FormValues) => {
		setIsSubmitting(true)

		try {
			if (data.teamId === CREATE_NEW_TEAM) {
				if (!data.newTeamName?.trim()) {
					form.setError("newTeamName", { message: "Team name is required" })
					setIsSubmitting(false)
					return
				}
				setIsCreatingTeam(true)

				// Create the team first
				const teamResult = await createTeam({
					data: { name: data.newTeamName.trim() },
				})

				if (teamResult?.data?.teamId) {
					// Submit the organizer request with the new team
					await submitRequest({
						data: {
							teamId: teamResult.data.teamId,
							reason: data.reason,
						},
					})
					toast.success("Application submitted successfully!")
					navigate({ to: "/compete/organizer/onboard/pending" })
				}
			} else {
				await submitRequest({
					data: {
						teamId: data.teamId,
						reason: data.reason,
					},
				})
				toast.success("Application submitted successfully!")
				navigate({ to: "/compete/organizer/onboard/pending" })
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to submit application"
			toast.error(errorMessage)
			setIsCreatingTeam(false)
		} finally {
			setIsSubmitting(false)
		}
	}

	const isPending = isSubmitting || isCreatingTeam

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
				{/* Team Selection */}
				<FormField
					control={form.control}
					name="teamId"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Organizing Team</FormLabel>
							<Select onValueChange={field.onChange} value={field.value}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select a team" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{teams.map((team) => (
										<SelectItem key={team.id} value={team.id}>
											{team.name}
										</SelectItem>
									))}
									<SelectItem value={CREATE_NEW_TEAM}>
										<span className="flex items-center gap-2">
											<Plus className="h-4 w-4" />
											Create new team
										</span>
									</SelectItem>
								</SelectContent>
							</Select>
							<FormDescription>
								The team that will be listed as the competition organizer
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* New Team Name (conditional) */}
				{showNewTeamFields && (
					<FormField
						control={form.control}
						name="newTeamName"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Team Name</FormLabel>
								<FormControl>
									<Input placeholder="e.g., CrossFit Downtown" {...field} />
								</FormControl>
								<FormDescription>
									This will be your organizing team's name
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
				)}

				{/* Reason */}
				<FormField
					control={form.control}
					name="reason"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Why do you want to organize competitions?</FormLabel>
							<FormControl>
								<Textarea
									placeholder="Tell us about the competitions you plan to host, your experience organizing events, and what draws you to the WODsmith platform..."
									className="min-h-[120px]"
									{...field}
								/>
							</FormControl>
							<FormDescription>
								This helps us understand your needs and approve your application
								faster
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				{/* Submit */}
				<div className="flex justify-end gap-4 pt-4">
					<Button
						type="button"
						variant="outline"
						onClick={() => navigate({ to: "/compete" })}
						disabled={isPending}
					>
						Cancel
					</Button>
					<Button type="submit" disabled={isPending}>
						{isPending ? "Submitting..." : "Submit Application"}
					</Button>
				</div>
			</form>
		</Form>
	)
}
