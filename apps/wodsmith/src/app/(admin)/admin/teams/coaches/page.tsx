import { getCoachesByTeam } from "@/actions/coach-actions"
import { getSkillsByTeam } from "@/actions/gym-setup-actions"
import { getTeamMembersAction } from "@/actions/team-membership-actions"
import { getAdminTeamContext } from "../_utils/get-team-context"
import Coaches from "../[teamId]/coaches/_components/Coaches"

export async function generateMetadata() {
	const { team } = await getAdminTeamContext()

	return {
		title: `${team.name} - Coaches`,
		description: `Manage coaches for ${team.name}`,
	}
}

export default async function CoachesPage() {
	const { teamId, team } = await getAdminTeamContext()

	const [[coachesResult], [teamMembersResult], [skillsResult]] =
		await Promise.all([
			getCoachesByTeam({ teamId }),
			getTeamMembersAction({ teamId }),
			getSkillsByTeam({ teamId }),
		])

	if (
		!coachesResult?.success ||
		!teamMembersResult?.success ||
		!skillsResult?.success
	) {
		return <div>Error loading coaches</div>
	}

	return (
		<Coaches
			coaches={coachesResult.data ?? []}
			teamMembers={teamMembersResult.data ?? []}
			teamId={teamId}
			teamSlug={team.slug}
			availableSkills={skillsResult.data ?? []}
		/>
	)
}
