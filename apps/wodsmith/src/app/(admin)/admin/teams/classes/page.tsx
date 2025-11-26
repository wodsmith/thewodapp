import {
	getClassCatalogByTeam,
	getSkillsByTeam,
} from "@/actions/gym-setup-actions"
import { getAdminTeamContext } from "../_utils/get-team-context"
import Classes from "../[teamId]/classes/_components/Classes"

export async function generateMetadata() {
	const { team } = await getAdminTeamContext()

	return {
		title: `${team.name} - Classes`,
		description: `Manage classes for ${team.name}`,
	}
}

export default async function ClassesPage() {
	const { teamId, team } = await getAdminTeamContext()

	const [[classesResult], [skillsResult]] = await Promise.all([
		getClassCatalogByTeam({ teamId }),
		getSkillsByTeam({ teamId }),
	])

	if (!classesResult?.success || !skillsResult?.success) {
		return <div>Error loading classes</div>
	}

	return (
		<Classes
			classes={classesResult.data ?? []}
			availableSkills={skillsResult.data ?? []}
			teamId={teamId}
			teamSlug={team.slug}
		/>
	)
}
