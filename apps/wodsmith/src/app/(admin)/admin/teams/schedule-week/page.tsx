import { getCoachesByTeam } from "@/actions/coach-actions"
import { getGeneratedSchedulesByTeamAction } from "@/actions/generate-schedule-actions"
import { getLocationsByTeam } from "@/actions/gym-setup-actions"
import { getScheduleTemplatesByTeam } from "@/actions/schedule-template-actions"
import { getAdminTeamContext } from "../_utils/get-team-context"
import Schedule from "../[teamId]/schedule-week/_components/Schedule"

export async function generateMetadata() {
	const { team } = await getAdminTeamContext()

	return {
		title: `${team.name} - Schedule`,
		description: `Manage schedule for ${team.name}`,
	}
}

export default async function SchedulePage() {
	const { teamId } = await getAdminTeamContext()

	const [
		[schedulesRes],
		[templatesRes],
		[locationsRes],
		[coachesRes],
	] = await Promise.all([
		getGeneratedSchedulesByTeamAction({ teamId }),
		getScheduleTemplatesByTeam({ teamId }),
		getLocationsByTeam({ teamId }),
		getCoachesByTeam({ teamId }),
	])

	if (
		!schedulesRes?.success ||
		!templatesRes ||
		!locationsRes?.success ||
		!coachesRes?.success
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
