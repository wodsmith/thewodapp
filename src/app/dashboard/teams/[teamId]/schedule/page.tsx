import ScheduleWorkoutModal from "@/components/schedule/ScheduleWorkoutModal"
import TeamScheduleCalendar from "@/components/schedule/TeamScheduleCalendar"

interface PageProps {
	params: Promise<{ teamId: string }>
}

export default async function Page({ params }: PageProps) {
	const { teamId } = await params
	return (
		<main className="container mx-auto p-4 space-y-4">
			<TeamScheduleCalendar teamId={teamId} />
			{/* client component */}
			<ScheduleWorkoutModal teamId={teamId} />
		</main>
	)
}
