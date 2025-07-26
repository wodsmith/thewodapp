import { getGeneratedSchedulesByTeamAction } from "@/actions/generate-schedule-actions"
import { getScheduleTemplatesByTeam } from "@/actions/schedule-template-actions"
import { getLocationsByTeam } from "@/actions/gym-setup-actions"
import { getCoachesByTeam } from "@/actions/coach-actions"
import { getTeamAction } from "@/actions/team-actions"
import Schedule from "./_components/Schedule"

interface SchedulePageProps {
	params: { teamId: string }
}

const SchedulePage = async (props: SchedulePageProps) => {
	const { teamId } = await props.params

	const [[schedulesRes], [templatesRes], [locationsRes], [coachesRes], [teamRes]] =
		await Promise.all([
			getGeneratedSchedulesByTeamAction({ teamId }),
			getScheduleTemplatesByTeam({ teamId }),
			getLocationsByTeam({ teamId }),
			getCoachesByTeam({ teamId }),
			getTeamAction({ teamId }),
		])

	if (
		!schedulesRes?.success ||
		!templatesRes ||
		!locationsRes?.success ||
		!coachesRes?.success ||
		!teamRes?.success
	) {
		return <div>Error loading schedule data</div>
	}

	return (
		<Schedule
			schedules={schedulesRes.data ?? []}
			templates={templatesRes ?? []}
			locations={locationsRes.data ?? []}
			coaches={coachesRes.data ?? []}
			teamId={teamId}
		/>
	)
}

export default SchedulePage
