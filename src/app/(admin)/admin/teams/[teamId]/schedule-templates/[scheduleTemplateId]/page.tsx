import { notFound } from "next/navigation"
import {
	getScheduleTemplateById,
	getScheduleTemplatesByTeam,
} from "@/actions/schedule-template-actions" // Assume this action exists
import {
	getClassCatalogByTeam,
	getLocationsByTeam,
	getSkillsByTeam,
} from "@/actions/gym-setup-actions"
import ScheduleTemplateDetails from "./_components/ScheduleTemplateDetails" // New component for details
import { getTeamAction } from "@/actions/team-actions"
export default async function ScheduleTemplatePage({
	params,
}: {
	params: { teamId: string; scheduleTemplateId: string }
}) {
	const { teamId, scheduleTemplateId } = await params
	const [[templateRes], [classesRes], [locationsRes], [skillsRes]] =
		await Promise.all([
			getScheduleTemplateById({ teamId, id: scheduleTemplateId }),
			getClassCatalogByTeam({ teamId }),
			getLocationsByTeam({ teamId }),
			getSkillsByTeam({ teamId }),
			getTeamAction({ teamId }),
		])

	if (
		!templateRes ||
		!classesRes?.success ||
		!locationsRes?.success ||
		!skillsRes?.success
	) {
		return <div>Error loading schedule templates data</div>
	}

	return (
		<ScheduleTemplateDetails
			template={templateRes}
			classCatalog={classesRes.data}
			locations={locationsRes.data}
			availableSkills={skillsRes.data}
			teamId={params.teamId}
		/>
	)
}
