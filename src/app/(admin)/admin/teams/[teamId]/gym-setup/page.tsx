import {
	getLocationsByTeam,
	getSkillsByTeam,
} from "@/actions/gym-setup-actions"
import { getTeamAction } from "@/actions/team-actions"
import GymSetup from "./_components/GymSetup"

async function Page({ params }: { params: { teamId: string } }) {
	const teamId = params.teamId

	const [[locationsRes], [skillsRes], [teamRes]] = await Promise.all([
		getLocationsByTeam({ teamId }),
		getSkillsByTeam({ teamId }),
		getTeamAction({ teamId }),
	])

	if (!locationsRes?.success || !skillsRes?.success || !teamRes?.success) {
		return <div>Error loading gym setup data</div>
	}

	return (
		<GymSetup
			locations={locationsRes.data}
			skills={skillsRes.data}
			team={teamRes.data}
			teamId={teamId}
		/>
	)
}

export default Page
