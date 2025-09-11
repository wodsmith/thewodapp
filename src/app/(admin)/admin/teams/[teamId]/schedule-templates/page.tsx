import { getScheduleTemplatesByTeam } from "@/actions/schedule-template-actions"
import {
	getClassCatalogByTeam,
	getLocationsByTeam,
	getSkillsByTeam,
} from "@/actions/gym-setup-actions"
import { getTeamAction } from "@/actions/team-actions"
import ScheduleTemplates from "./_components/ScheduleTemplates"

interface ScheduleTemplatesPageProps {
	params: { teamId: string }
}

const ScheduleTemplatesPage = async (props: ScheduleTemplatesPageProps) => {
	const { teamId } = await props.params

	const [[templatesRes], [classesRes], [locationsRes], [skillsRes], [teamRes]] =
		await Promise.all([
			getScheduleTemplatesByTeam({ teamId }),
			getClassCatalogByTeam({ teamId }),
			getLocationsByTeam({ teamId }),
			getSkillsByTeam({ teamId }),
			getTeamAction({ teamId }),
		])

	if (
		!templatesRes ||
		!classesRes?.success ||
		!locationsRes?.success ||
		!skillsRes?.success ||
		!teamRes?.success
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
			teamSlug={teamRes.data?.slug ?? ""}
		/>
	)
}

export default ScheduleTemplatesPage
