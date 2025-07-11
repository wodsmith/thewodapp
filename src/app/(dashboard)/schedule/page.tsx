import { ScheduleCalendar } from "@/components/schedule-calendar"
import { PageHeader } from "@/components/page-header"

export default function SchedulePage() {
	return (
		<div className="container mx-auto py-10">
			<PageHeader
				title="Schedule Management"
				description="View and manage your gym's class schedule."
			/>
			<ScheduleCalendar />
		</div>
	)
}
