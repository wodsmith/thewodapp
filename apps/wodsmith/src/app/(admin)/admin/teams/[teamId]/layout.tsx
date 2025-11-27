import { redirect } from "next/navigation"
import { getActiveOrPersonalTeamId, getSessionFromCookie } from "@/utils/auth"

interface TeamAdminLayoutProps {
	children: React.ReactNode
	params: Promise<{
		teamId: string
	}>
}

/**
 * @deprecated This layout is being removed. The sidebar is now handled by
 * teams/layout.tsx. This layout only redirects mismatched teamIds.
 * Will be deleted after all pages are migrated out of [teamId]/.
 */
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

	// If URL teamId doesn't match active team, redirect to new URL structure
	if (teamId !== activeTeamId) {
		redirect("/admin/teams")
	}

	// Just pass through children - sidebar is handled by parent teams/layout.tsx
	return <>{children}</>
}
