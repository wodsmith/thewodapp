import {
	getClassCatalogByTeam,
	getLocationsByTeam,
	getSkillsByTeam,
} from "@/actions/gym-setup-actions"
import { getScheduleTemplatesByTeam } from "@/actions/schedule-template-actions"
import { getAdminTeamContext } from "../_utils/get-team-context"
import ScheduleTemplates from "../[teamId]/schedule-templates/_components/ScheduleTemplates"

export async function generateMetadata() {
	const { team } = await getAdminTeamContext()

	return {
		title: `${team.name} - Schedule Templates`,
		description: `Manage schedule templates for ${team.name}`,
	}
}

export default async function ScheduleTemplatesPage() {
	const { teamId, team } = await getAdminTeamContext()

	const [[templatesRes], [classesRes], [locationsRes], [skillsRes]] =
		await Promise.all([
			getScheduleTemplatesByTeam({ teamId }),
			getClassCatalogByTeam({ teamId }),
			getLocationsByTeam({ teamId }),
			getSkillsByTeam({ teamId }),
		])

	if (
		!templatesRes ||
		!classesRes?.success ||
		!locationsRes?.success ||
		!skillsRes?.success
	) {
		return <div>Error loading schedule templates data</div>
	}

	return (
		<ScheduleTemplates
			templates={templatesRes ?? []}
			classCatalog={classesRes.data ?? []}
			locations={locationsRes.data ?? []}
			availableSkills={skillsRes.data ?? []}
			teamId={teamId}
			_teamSlug={team.slug}
		/>
	)
}
