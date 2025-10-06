import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { getUserTeamsAction } from "@/actions/team-actions"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getSessionFromCookie } from "@/utils/auth"
import { hasTeamPermission } from "@/utils/team-auth"
import { TeamsClient } from "../_components/teams"

interface TeamsLayoutProps {
	children: ReactNode
	params: Promise<{ teamSlug: string }>
}

export default async function TeamsLayout({
	children,
	params: teamParams,
}: TeamsLayoutProps) {
	const params = await teamParams
	const session = await getSessionFromCookie()
	if (!session) {
		redirect("/sign-in")
	}

	const [result] = await getUserTeamsAction()
	if (!result || result?.success === false) {
		redirect("/settings")
	}
	const teams = result.data || []
	if (!teams.length) {
		return <div className="p-8">You are not a member of any teams.</div>
	}

	// Check permissions for each team
	const teamPermissions = await Promise.all(
		teams.map(async (team) => ({
			teamId: team.id,
			canManageProgramming: await hasTeamPermission(
				team.id,
				TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
			),
		})),
	)

	return (
		<div className="flex flex-col gap-8">
			<aside className="w-full">
				<TeamsClient
					teams={teams}
					selectedTeamSlug={params.teamSlug}
					teamPermissions={teamPermissions}
				/>
			</aside>
			<main className="flex-1">{children}</main>
		</div>
	)
}
