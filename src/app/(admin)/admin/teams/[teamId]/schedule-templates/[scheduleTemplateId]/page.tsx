import { getScheduleTemplateById } from "@/actions/schedule-template-actions"
import ClassTemplateScheduler from "./_components/ClassTemplateScheduler"

export default async function ScheduleTemplatePage({
	params,
}: {
	params: { teamId: string; scheduleTemplateId: string }
}) {
	const { teamId, scheduleTemplateId } = await params
	const [[templateRes]] = await Promise.all([
		getScheduleTemplateById({ teamId, id: scheduleTemplateId }),
	])

	if (!templateRes) {
		return <div>Error loading schedule templates data</div>
	}

	return <ClassTemplateScheduler template={templateRes} />
}
