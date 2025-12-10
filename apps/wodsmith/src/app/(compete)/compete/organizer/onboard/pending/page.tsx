import "server-only"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ClockIcon, CheckCircleIcon } from "@heroicons/react/24/outline"
import { getSessionFromCookie } from "@/utils/auth"
import { getUserTeams } from "@/server/teams"
import {
	getOrganizerRequest,
	isApprovedOrganizer,
	hasPendingOrganizerRequest,
} from "@/server/organizer-onboarding"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow } from "date-fns"

export const metadata: Metadata = {
	title: "Application Under Review - Compete",
	description: "Your organizer application is being reviewed",
}

export default async function OrganizerOnboardPendingPage() {
	const session = await getSessionFromCookie()

	if (!session?.user) {
		redirect("/sign-in?redirect=/compete/organizer/onboard")
	}

	// Get user's teams and find one with pending request
	const teams = await getUserTeams()
	const gymTeams = teams.filter((t) => t.type === "gym" && !t.isPersonalTeam)

	let pendingRequest = null
	let pendingTeam = null

	for (const team of gymTeams) {
		const isApproved = await isApprovedOrganizer(team.id)
		if (isApproved) {
			// If approved, redirect to organizer dashboard
			redirect("/compete/organizer")
		}

		const isPending = await hasPendingOrganizerRequest(team.id)
		if (isPending) {
			pendingRequest = await getOrganizerRequest(team.id)
			pendingTeam = team
			break
		}
	}

	// No pending request, redirect to onboard
	if (!pendingRequest || !pendingTeam) {
		redirect("/compete/organizer/onboard")
	}

	return (
		<div className="container mx-auto px-4 py-12">
			<div className="mx-auto max-w-2xl text-center">
				{/* Status Icon */}
				<div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
					<ClockIcon className="h-10 w-10 text-amber-600 dark:text-amber-400" />
				</div>

				{/* Header */}
				<h1 className="mb-2 text-3xl font-bold">Application Under Review</h1>
				<p className="mb-8 text-muted-foreground">
					We're reviewing your application for{" "}
					<span className="font-medium text-foreground">{pendingTeam.name}</span>.
					You'll receive an email once we've made a decision.
				</p>

				{/* Request Details */}
				<div className="mb-8 rounded-lg border bg-card p-6 text-left">
					<h2 className="mb-4 font-semibold">Your Application</h2>

					<div className="space-y-4">
						<div>
							<p className="text-sm font-medium text-muted-foreground">
								Submitted
							</p>
							<p className="text-sm">
								{formatDistanceToNow(pendingRequest.createdAt, {
									addSuffix: true,
								})}
							</p>
						</div>

						<div>
							<p className="text-sm font-medium text-muted-foreground">
								Reason for organizing
							</p>
							<p className="text-sm">{pendingRequest.reason}</p>
						</div>
					</div>
				</div>

				{/* What you can do now */}
				<div className="mb-8 rounded-lg border border-primary/20 bg-primary/5 p-6 text-left">
					<div className="mb-3 flex items-center gap-2">
						<CheckCircleIcon className="h-5 w-5 text-primary" />
						<h2 className="font-semibold">What you can do now</h2>
					</div>
					<p className="mb-4 text-sm text-muted-foreground">
						While your application is pending, you can still create private
						competitions to get familiar with the platform. Private competitions
						are only visible to you and people you share the link with.
					</p>
					<Button asChild>
						<Link href="/compete/organizer">Create Private Competition</Link>
					</Button>
				</div>

				{/* Contact */}
				<p className="text-sm text-muted-foreground">
					Questions about your application?{" "}
					<a
						href="mailto:support@wodsmith.com"
						className="font-medium text-primary hover:underline"
					>
						Contact support
					</a>
				</p>
			</div>
		</div>
	)
}
