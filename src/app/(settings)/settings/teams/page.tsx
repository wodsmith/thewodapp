import { getUserTeamsAction } from "@/actions/team-actions"
import type { Team } from "@/db/schema"
import { redirect } from "next/navigation"

export default async function TeamsPage() {
	const [result] = await getUserTeamsAction()
	if (!result || result.success === false) {
		redirect("/settings")
	}
	const teams: Team[] = (
		Array.isArray(result.data) ? result.data.flat() : [result.data]
	).filter((t): t is Team => typeof t === "object" && t !== null && "slug" in t)
	if (!teams.length) {
		return <div className="p-8">You are not a member of any teams.</div>
	}
	redirect(`/settings/teams/${teams[0].slug}`)
}
