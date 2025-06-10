import { getUserTeamsAction } from "@/actions/team-actions"
import { redirect } from "next/navigation"

export default async function TeamsPage() {
	const [result] = await getUserTeamsAction()
	if (!result || result?.success === false) {
		redirect("/settings")
	}
	const teams = result.data || []
	if (!teams.length) {
		return <div className="p-8">You are not a member of any teams.</div>
	}
	redirect(`/settings/teams/${teams[0].slug}`)
}
