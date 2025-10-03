import { getCoachesByTeam } from "@/actions/coach-actions"
import Coaches from "./_components/Coaches"
import { getTeamMembersAction } from "@/actions/team-membership-actions"
import { getTeamAction } from "@/actions/team-actions"
import { getSkillsByTeam } from "@/actions/gym-setup-actions"

interface CoachesPageProps {
	params: Promise<{ teamId: string }>
}

const CoachesPage = async ({ params }: CoachesPageProps) => {
	const { teamId } = await params
	const [[coachesResult], [teamMembersResult], [teamResult], [skillsResult]] =
		await Promise.all([
			getCoachesByTeam({ teamId }),
			getTeamMembersAction({ teamId }),
			getTeamAction({ teamId }),
			getSkillsByTeam({ teamId }),
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
			teamId={teamId}
			teamSlug={teamResult.data?.slug ?? ""}
			availableSkills={skillsResult.data ?? []}
		/>
	)
}

export default CoachesPage
