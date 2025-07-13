import { getCoachesByTeam } from "@/actions/coach-actions"
import Coaches from "./_components/Coaches"
import { getTeamMembersAction } from "@/actions/team-membership-actions"
import { getTeamAction } from "@/actions/team-actions"
import { getSkillsByTeam } from "@/actions/gym-setup-actions"

interface CoachesPageProps {
	params: { teamId: string }
}

const CoachesPage = async ({ params }: CoachesPageProps) => {
	const [[coachesResult], [teamMembersResult], [teamResult], [skillsResult]] =
		await Promise.all([
			getCoachesByTeam({ teamId: params.teamId }),
			getTeamMembersAction({ teamId: params.teamId }),
			getTeamAction({ teamId: params.teamId }),
			getSkillsByTeam({ teamId: params.teamId }),
		])

	if (
		!coachesResult?.success ||
		!teamMembersResult?.success ||
		!teamResult?.success ||
		!skillsResult?.success
	) {
		return <div>Error loading coaches</div>
	}

	return (
		<Coaches
			coaches={coachesResult.data ?? []}
			teamMembers={teamMembersResult.data ?? []}
			teamId={params.teamId}
			teamSlug={teamResult.data?.slug ?? ""}
			availableSkills={skillsResult.data ?? []}
		/>
	)
}

export default CoachesPage
