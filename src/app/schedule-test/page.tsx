"use server"
import { ScheduleListPage } from "@/components/scheduling/schedule-list-page"

export default async function ScheduleTestPage() {
	// Use a demo team ID - you can replace this with your actual team ID
	const teamId = "team_crossfitbox1"

	return (
		<div className="container mx-auto px-4 py-4 sm:py-8">
			<ScheduleListPage teamId={teamId} />
		</div>
	)
}
