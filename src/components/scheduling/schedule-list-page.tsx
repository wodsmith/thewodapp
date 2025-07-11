import { getGeneratedSchedulesForTeam } from "@/server/ai/scheduler"
import { ScheduleDisplay } from "./schedule-display"

interface ScheduleListPageProps {
	teamId: string
}

export async function ScheduleListPage({ teamId }: ScheduleListPageProps) {
	const schedules = await getGeneratedSchedulesForTeam(teamId)

	if (schedules.length === 0) {
		return (
			<div className="mx-auto max-w-4xl space-y-6">
				<h2 className="text-2xl font-bold">Class Schedule</h2>
				<div className="rounded-lg border p-6 text-center">
					<p className="text-muted-foreground">
						No schedules found. Generate a schedule to get started.
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-8">
			{schedules.map((schedule) => (
				<div key={schedule.id} className="space-y-4">
					<div className="rounded-lg border p-4">
						<div className="mb-4 flex items-center justify-between">
							<h3 className="text-lg font-semibold">Generated Schedule</h3>
							<span className="text-sm text-muted-foreground">
								{schedule.scheduledClasses.length} classes scheduled
							</span>
						</div>
						<ScheduleDisplay
							scheduledClasses={schedule.scheduledClasses}
							weekStartDate={schedule.weekStartDate}
						/>
					</div>
				</div>
			))}
		</div>
	)
}
