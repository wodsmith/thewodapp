import { getScheduleTemplateById } from "@/actions/schedule-template-actions"
import { getAdminTeamContext } from "../../_utils/get-team-context"
import ClassTemplateScheduler from "../../[teamId]/schedule-templates/[scheduleTemplateId]/_components/ClassTemplateScheduler"

export async function generateMetadata() {
	const { team } = await getAdminTeamContext()

	return {
		title: `${team.name} - Schedule Template`,
		description: `Edit schedule template for ${team.name}`,
	}
}

export default async function ScheduleTemplatePage({
	params,
}: {
	params: Promise<{ scheduleTemplateId: string }>
}) {
	const { teamId } = await getAdminTeamContext()
	const { scheduleTemplateId } = await params

	const [[templateRes]] = await Promise.all([
		getScheduleTemplateById({ teamId, id: scheduleTemplateId }),
	])

	if (!templateRes) {
		return <div>Error loading schedule templates data</div>
	}

	return <ClassTemplateScheduler template={templateRes} />
}
