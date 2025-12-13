import "server-only"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import {
	CalendarDaysIcon,
	ChartBarIcon,
	CreditCardIcon,
	TrophyIcon,
	UserGroupIcon,
	ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline"
import { getSessionFromCookie } from "@/utils/auth"
import { getUserTeams } from "@/server/teams"
import {
	getOrganizerRequest,
	isApprovedOrganizer,
	hasPendingOrganizerRequest,
} from "@/server/organizer-onboarding"
import { OnboardForm } from "./_components/onboard-form"

export const metadata: Metadata = {
	title: "Become an Organizer - WODsmith Compete",
	description: "Apply to host CrossFit competitions on WODsmith",
}

const features = [
	{
		icon: CalendarDaysIcon,
		title: "Heat Scheduling",
		description: "Organize heats across venues with lane assignments and timing",
	},
	{
		icon: ClipboardDocumentListIcon,
		title: "Live Scoring",
		description: "Real-time score entry with instant leaderboard updates",
	},
	{
		icon: UserGroupIcon,
		title: "Athlete Registration",
		description: "Online registration with division selection and waivers",
	},
	{
		icon: CreditCardIcon,
		title: "Payment Processing",
		description: "Accept entry fees via Stripe with automatic payouts",
	},
	{
		icon: ChartBarIcon,
		title: "Revenue Tracking",
		description: "Track registrations, revenue, and platform fees in real-time",
	},
	{
		icon: TrophyIcon,
		title: "Public Competition Page",
		description: "Professional event page with schedule, results, and registration",
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
		description: "Once approved, publish your competition and open registration",
	},
]

export default async function OrganizerOnboardPage() {
	const session = await getSessionFromCookie()

	if (!session?.user) {
		redirect("/sign-in?redirect=/compete/organizer/onboard")
	}

	// Get user's teams
	const teams = await getUserTeams()
	const gymTeams = teams.filter((t) => t.type === "gym" && !t.isPersonalTeam)

	// Check if any of the user's teams are already approved or have pending requests
	const teamStatuses = await Promise.all(
		gymTeams.map(async (team) => {
			const [isApproved, isPending, request] = await Promise.all([
				isApprovedOrganizer(team.id),
				hasPendingOrganizerRequest(team.id),
				getOrganizerRequest(team.id),
			])
			return { team, isApproved, isPending, request }
		}),
	)

	// Check if any team is approved - redirect to organizer dashboard
	const approvedTeam = teamStatuses.find((s) => s.isApproved)
	if (approvedTeam) {
		redirect("/compete/organizer")
	}

	// Check if any team has a pending request - redirect to pending page
	const pendingTeam = teamStatuses.find((s) => s.isPending)
	if (pendingTeam) {
		redirect("/compete/organizer/onboard/pending")
	}

	// Filter to teams that haven't submitted a request yet
	const availableTeams = teamStatuses
		.filter((s) => !s.isApproved && !s.isPending)
		.map((s) => s.team)

	return (
		<div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
			{/* Hero Section */}
			<div className="container mx-auto px-4 pt-12 pb-8">
				<div className="mx-auto max-w-3xl text-center">
					<div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
						<TrophyIcon className="h-4 w-4" />
						WODsmith Compete
					</div>
					<h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
						Host Your Next Competition
					</h1>
					<p className="mt-4 text-lg text-muted-foreground">
						Everything you need to run professional CrossFit competitions.
						From registration to results, we've got you covered.
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
						<OnboardForm teams={availableTeams} />
					</div>
				</div>
			</div>
		</div>
	)
}
