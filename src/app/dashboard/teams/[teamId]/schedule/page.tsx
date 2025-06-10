import ScheduleWorkoutModal from "@/components/schedule/ScheduleWorkoutModal"
import TeamScheduleCalendar from "@/components/schedule/TeamScheduleCalendar"

interface PageProps {
	params: { teamId: string }
}

export default function Page({ params }: PageProps) {
	return (
		<main className="container mx-auto p-4 space-y-4">
			<TeamScheduleCalendar teamId={params.teamId} />
			{/* client component */}
			<ScheduleWorkoutModal teamId={params.teamId} />
		</main>
	)
}
