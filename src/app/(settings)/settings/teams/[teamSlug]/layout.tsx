import { getUserTeamsAction } from "@/actions/team-actions"
import { getSessionFromCookie } from "@/utils/auth"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { TeamsClient } from "../_components/teams"

interface TeamsLayoutProps {
	children: ReactNode
	params: Promise<{ teamSlug: string }>
}

export default async function TeamsLayout({
	children,
	params: paramsPromise,
}: TeamsLayoutProps) {
	const params = await paramsPromise
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

	return (
		<div className="flex flex-col gap-8">
			<aside className="w-full">
				<TeamsClient teams={teams} selectedTeamSlug={params.teamSlug} />
			</aside>
			<main className="flex-1">{children}</main>
		</div>
	)
}
