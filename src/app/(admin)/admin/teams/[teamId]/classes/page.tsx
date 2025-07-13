"use server"
import {
	getClassCatalogByTeam,
	getSkillsByTeam,
} from "@/actions/gym-setup-actions"
import { getTeamAction } from "@/actions/team-actions"
import Classes from "./_components/Classes"

interface ClassesPageProps {
	params: {
		teamId: string
	}
}

const ClassesPage = async ({ params }: ClassesPageProps) => {
	const [[classesResult], [skillsResult], [teamResult]] = await Promise.all([
		getClassCatalogByTeam({ teamId: params.teamId }),
		getSkillsByTeam({ teamId: params.teamId }),
		getTeamAction({ teamId: params.teamId }),
	])

	if (
		!classesResult?.success ||
		!skillsResult?.success ||
		!teamResult?.success
	) {
		return <div>Error loading classes</div>
	}

	return (
		<Classes
			classes={classesResult.data ?? []}
			availableSkills={skillsResult.data ?? []}
			teamId={params.teamId}
			teamSlug={teamResult.data.slug}
		/>
	)
}

export default ClassesPage
