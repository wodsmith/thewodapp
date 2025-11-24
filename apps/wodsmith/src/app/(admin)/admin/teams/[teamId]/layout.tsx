import { redirect } from "next/navigation"
import { getActiveOrPersonalTeamId, getSessionFromCookie } from "@/utils/auth"
import { AdminSidebar } from "../../_components/admin-sidebar"

interface TeamAdminLayoutProps {
	children: React.ReactNode
	params: Promise<{
		teamId: string
	}>
}

export default async function TeamAdminLayout({
	children,
	params,
}: TeamAdminLayoutProps) {
	const { teamId } = await params

	// Get session and active team
	const session = await getSessionFromCookie()
	if (!session?.userId) {
		redirect("/sign-in")
	}

	const activeTeamId = await getActiveOrPersonalTeamId(session.userId)

	// If URL teamId doesn't match active team, redirect to active team URL
	if (teamId !== activeTeamId) {
		// Get current path and replace teamId
		const currentPath = `/admin/teams/${activeTeamId}`
		redirect(currentPath)
	}

	return (
		<div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0 bg-background dark:bg-dark-background">
			<aside className="lg:w-64 lg:flex-shrink-0 overflow-visible">
				<AdminSidebar currentTeamId={teamId} />
			</aside>
			<div className="flex-1">{children}</div>
		</div>
	)
}
