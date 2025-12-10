import "server-only"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSessionFromCookie } from "@/utils/auth"
import { getUserTeams } from "@/server/teams"
import {
	getOrganizerRequest,
	isApprovedOrganizer,
	hasPendingOrganizerRequest,
} from "@/server/organizer-onboarding"
import { OnboardForm } from "./_components/onboard-form"

export const metadata: Metadata = {
	title: "Become an Organizer - Compete",
	description: "Apply to host competitions on WODsmith",
}

export default async function OrganizerOnboardPage() {
	const session = await getSessionFromCookie()

	if (!session?.user) {
		redirect("/sign-in?redirect=/compete/organizer/onboard")
	}

	// Get user's teams
	const teams = await getUserTeams(session.user.id)
	const gymTeams = teams.filter(
		(t) => t.type === "gym" && !t.isPersonalTeam,
	)

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
		<div className="container mx-auto px-4 py-12">
			<div className="mx-auto max-w-2xl">
				{/* Header */}
				<div className="mb-8 text-center">
					<h1 className="text-3xl font-bold">Host Your Competition</h1>
					<p className="mt-2 text-muted-foreground">
						Join our community of competition organizers and bring your event
						to life on WODsmith Compete.
					</p>
				</div>

				{/* Benefits */}
				<div className="mb-8 rounded-lg border bg-card p-6">
					<h2 className="mb-4 font-semibold">What you get as an organizer:</h2>
					<ul className="space-y-2 text-sm text-muted-foreground">
						<li className="flex items-start gap-2">
							<span className="text-primary">✓</span>
							Heat scheduling with venues and lane assignments
						</li>
						<li className="flex items-start gap-2">
							<span className="text-primary">✓</span>
							Real-time score entry and live leaderboards
						</li>
						<li className="flex items-start gap-2">
							<span className="text-primary">✓</span>
							Online athlete registration with Stripe payments
						</li>
						<li className="flex items-start gap-2">
							<span className="text-primary">✓</span>
							Revenue tracking and platform fee transparency
						</li>
					</ul>
				</div>

				{/* Form */}
				<OnboardForm teams={availableTeams} />
			</div>
		</div>
	)
}
