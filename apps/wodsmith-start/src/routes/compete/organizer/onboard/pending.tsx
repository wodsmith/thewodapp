/**
 * Organizer Onboard Pending Page
 * Shown when a team has a pending organizer request under review.
 * Users can see their application status and start creating private competitions.
 *
 * Port from apps/wodsmith/src/app/(compete)/compete/(organizer-public)/organizer/onboard/pending/page.tsx
 *
 * NOTE: This page must fetch session directly via getOptionalSession() because
 * the parent /compete/organizer route returns session: null for all onboard routes
 * to allow the onboard index page to handle inline auth. This caused a redirect
 * loop when using context.session (which was always null for onboard routes).
 */

import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { formatDistanceToNow } from "date-fns"
import { CheckCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getOptionalSession } from "@/server-fns/middleware/auth"
import {
	getOrganizerRequest,
	hasPendingOrganizerRequest,
	isApprovedOrganizer,
} from "@/server-fns/organizer-onboarding-fns"

// Server function callers for use in loader
const fetchIsApprovedOrganizer = (teamId: string) =>
	isApprovedOrganizer({ data: { teamId } })
const fetchHasPendingOrganizerRequest = (teamId: string) =>
	hasPendingOrganizerRequest({ data: { teamId } })
const fetchGetOrganizerRequest = (teamId: string) =>
	getOrganizerRequest({ data: { teamId } })

// Types
interface TeamInfo {
	id: string
	name: string
}

interface PendingRequestInfo {
	reason: string
	createdAt: Date
}

interface LoaderData {
	pendingTeam: TeamInfo
	pendingRequest: PendingRequestInfo
}

export const Route = createFileRoute("/compete/organizer/onboard/pending")({
	component: OrganizerOnboardPendingPage,
	loader: async (): Promise<LoaderData> => {
		// Fetch session directly - parent route returns session: null for onboard paths
		// to avoid import chain issues and to allow inline auth on the onboard index page.
		// Using context.session here would always be null, causing a redirect loop.
		const session = await getOptionalSession()

		// If not authenticated, redirect to sign-in
		if (!session?.user) {
			throw redirect({
				to: "/sign-in",
				search: { redirect: "/compete/organizer/onboard/pending" },
			})
		}

		// Get user's teams and find one with pending request
		const userTeams = session.teams || []
		const gymTeams = userTeams.filter(
			(t) => t.type === "gym" && !t.isPersonalTeam,
		)

		let pendingRequest: PendingRequestInfo | null = null
		let pendingTeam: TeamInfo | null = null

		for (const team of gymTeams) {
			const approved = await fetchIsApprovedOrganizer(team.id)
			if (approved) {
				// If approved, redirect to organizer dashboard
				throw redirect({ to: "/compete/organizer" })
			}

			const isPending = await fetchHasPendingOrganizerRequest(team.id)
			if (isPending) {
				const request = await fetchGetOrganizerRequest(team.id)
				if (request) {
					pendingRequest = {
						reason: request.reason,
						createdAt: request.createdAt,
					}
					pendingTeam = {
						id: team.id,
						name: team.name,
					}
					break
				}
			}
		}

		// No pending request, redirect to onboard
		if (!pendingRequest || !pendingTeam) {
			throw redirect({ to: "/compete/organizer/onboard" })
		}

		return {
			pendingTeam,
			pendingRequest,
		}
	},
})

function OrganizerOnboardPendingPage() {
	const { pendingTeam, pendingRequest } = Route.useLoaderData()

	return (
		<div className="container mx-auto px-4 py-12">
			<div className="mx-auto max-w-2xl text-center">
				{/* Status Icon */}
				<div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
					<Clock className="h-10 w-10 text-amber-600 dark:text-amber-400" />
				</div>

				{/* Header */}
				<h1 className="mb-2 text-3xl font-bold">Application Under Review</h1>
				<p className="mb-8 text-muted-foreground">
					We're reviewing your application for{" "}
					<span className="font-medium text-foreground">
						{pendingTeam.name}
					</span>
					. You'll receive an email once we've made a decision.
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
								{formatDistanceToNow(new Date(pendingRequest.createdAt), {
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
						<CheckCircle className="h-5 w-5 text-primary" />
						<h2 className="font-semibold">What you can do now</h2>
					</div>
					<p className="mb-4 text-sm text-muted-foreground">
						While your application is pending, you can still create private
						competitions to get familiar with the platform. Private competitions
						are only visible to you and people you share the link with.
					</p>
					<Button asChild>
						<Link to="/compete/organizer">Create Private Competition</Link>
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
