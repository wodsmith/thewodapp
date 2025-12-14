import "server-only"
import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { isTeamPendingOrganizer } from "@/server/organizer-pending"
import { getActiveTeamFromCookie, getSessionFromCookie } from "@/utils/auth"
import { getUserOrganizingTeams } from "@/utils/get-user-organizing-teams"
import { PendingOrganizerBanner } from "./_components/pending-organizer-banner"

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
						<Link href="/compete/organizer/onboard">
							Apply to Become an Organizer
						</Link>
					</Button>
				</div>
			</div>
		)
	}

	// Determine active team ID using same logic as page.tsx
	// Priority: active team cookie (if valid organizing team) > first organizing team
	const activeTeamFromCookie = await getActiveTeamFromCookie()
	let activeTeamId: string | undefined
	if (
		activeTeamFromCookie &&
		organizingTeams.some((t) => t.id === activeTeamFromCookie)
	) {
		activeTeamId = activeTeamFromCookie
	} else if (organizingTeams.length > 0) {
		activeTeamId = organizingTeams[0]?.id
	}

	// Banner is rendered in sidebar-inset for competition routes to respect sidebar.
	// Only show banner in parent layout for specific non-competition routes.
	// Check if the ACTIVE team is pending (not any team the user has access to)
	const hasPendingTeam = activeTeamId
		? await isTeamPendingOrganizer(activeTeamId)
		: false
	const showBannerInLayout =
		pathname === "/compete/organizer" ||
		pathname.startsWith("/compete/organizer/onboard") ||
		pathname.startsWith("/compete/organizer/series") ||
		pathname.startsWith("/compete/organizer/new") ||
		pathname.startsWith("/compete/organizer/settings")

	return (
		<>
			{hasPendingTeam && showBannerInLayout && (
				<PendingOrganizerBanner variant="page-container" />
			)}
			{children}
		</>
	)
}
