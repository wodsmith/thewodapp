import {
	getLocationsByTeam,
	getSkillsByTeam,
} from "@/actions/gym-setup-actions"
import { getAdminTeamContext } from "../_utils/get-team-context"
import GymSetup from "../[teamId]/gym-setup/_components/GymSetup"

export async function generateMetadata() {
	const { team } = await getAdminTeamContext()

	return {
		title: `${team.name} - Gym Setup`,
		description: `Manage gym setup for ${team.name}`,
	}
}

export default async function GymSetupPage() {
	const { teamId, team } = await getAdminTeamContext()

	const [[locationsRes], [skillsRes]] = await Promise.all([
		getLocationsByTeam({ teamId }),
		getSkillsByTeam({ teamId }),
	])

	if (!locationsRes?.success || !skillsRes?.success) {
		return <div>Error loading gym setup data</div>
	}

	return (
		<GymSetup
			locations={locationsRes.data}
			skills={skillsRes.data}
			team={team}
			teamId={teamId}
		/>
	)
}
