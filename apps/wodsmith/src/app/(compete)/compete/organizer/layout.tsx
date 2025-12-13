import "server-only"
import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { ClockIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { LIMITS } from "@/config/limits"
import { getTeamLimit } from "@/server/entitlements"
import { getSessionFromCookie } from "@/utils/auth"
import { getUserOrganizingTeams } from "@/utils/get-user-organizing-teams"

export const metadata: Metadata = {
	title: "Organizer Dashboard - Compete",
	description: "Manage your competitions",
}

export default async function OrganizerLayout({
	children,
}: {
	children: React.ReactNode
}) {
	const session = await getSessionFromCookie()

	if (!session?.userId) {
		redirect("/sign-in")
	}

	// Get current pathname to allow onboard routes through
	const headersList = await headers()
	const pathname = headersList.get("x-pathname") || ""
	const isOnboardRoute = pathname.startsWith("/compete/organizer/onboard")

	// Check if user can organize competitions
	const organizingTeams = await getUserOrganizingTeams()

	// Allow onboard routes through even if user has no organizing teams
	if (organizingTeams.length === 0 && !isOnboardRoute) {
		return (
			<div className="container mx-auto px-4 py-16">
				<div className="max-w-md mx-auto text-center">
					<h1 className="text-2xl font-bold mb-4">No Organizing Access</h1>
					<p className="text-muted-foreground mb-6">
						You don't have permission to organize competitions yet.
					</p>
					<Button asChild>
						<Link href="/compete/organizer/onboard">Apply to Become an Organizer</Link>
					</Button>
				</div>
			</div>
		)
	}

	// Check if any organizing team is pending approval (limit = 0)
	const teamLimits = await Promise.all(
		organizingTeams.map(async (team) => ({
			team,
			limit: await getTeamLimit(team.id, LIMITS.MAX_PUBLISHED_COMPETITIONS),
		})),
	)

	const hasPendingTeam = teamLimits.some((t) => t.limit === 0)

	return (
		<>
			{hasPendingTeam && (
				<div className="border-b border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
					<div className="container mx-auto flex items-center gap-3 px-4 py-3">
						<ClockIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
						<p className="text-sm text-amber-800 dark:text-amber-200">
							<strong>Application pending:</strong> You can create draft
							competitions while your application is being reviewed. Drafts
							won't be visible until published after approval.
						</p>
					</div>
				</div>
			)}
			{children}
		</>
	)
}
