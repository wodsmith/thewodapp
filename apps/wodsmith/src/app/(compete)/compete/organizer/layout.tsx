import "server-only"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
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

	// Check if user can organize competitions
	const organizingTeams = await getUserOrganizingTeams()

	if (organizingTeams.length === 0) {
		return (
			<div className="container mx-auto px-4 py-16">
				<div className="max-w-md mx-auto text-center">
					<h1 className="text-2xl font-bold mb-4">No Organizing Access</h1>
					<p className="text-muted-foreground mb-6">
						You don't have permission to organize competitions. Contact your
						team administrator to get access.
					</p>
				</div>
			</div>
		)
	}

	return <>{children}</>
}
