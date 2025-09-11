import {
	getClassCatalogByTeam,
	getSkillsByTeam,
} from "@/actions/gym-setup-actions"
import { getTeamAction } from "@/actions/team-actions"
import Classes from "./_components/Classes"

interface ClassesPageProps {
	params: Promise<{
		teamId: string
	}>
}

const ClassesPage = async ({ params }: ClassesPageProps) => {
	const { teamId } = await params
	const [[classesResult], [skillsResult], [teamResult]] = await Promise.all([
		getClassCatalogByTeam({ teamId }),
		getSkillsByTeam({ teamId }),
		getTeamAction({ teamId }),
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
			teamId={teamId}
			teamSlug={teamResult.data.slug}
		/>
	)
}

export default ClassesPage
