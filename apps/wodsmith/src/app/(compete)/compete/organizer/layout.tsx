import "server-only"
import type { Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
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
						<Link href="/compete/organizer/onboard">
							Apply to Become an Organizer
						</Link>
					</Button>
				</div>
			</div>
		)
	}

	// Note: PendingOrganizerBanner is rendered by child layouts/pages that need it:
	// - Competition pages: [competitionId]/(with-sidebar)/layout.tsx
	// - Other pages render it directly in their page components
	return <>{children}</>
}
