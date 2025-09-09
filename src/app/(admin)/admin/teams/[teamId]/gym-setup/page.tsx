import {
	getLocationsByTeam,
	getSkillsByTeam,
} from "@/actions/gym-setup-actions"
import { getTeamAction } from "@/actions/team-actions"
import GymSetup from "./_components/GymSetup"

interface GymSetupPageProps {
	params: Promise<{ teamId: string }>
}

async function Page({ params }: GymSetupPageProps) {
	const { teamId } = await params

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
