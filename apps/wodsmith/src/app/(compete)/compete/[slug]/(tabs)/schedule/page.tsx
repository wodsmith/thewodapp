import "server-only"
import { notFound } from "next/navigation"
import { getCompetition } from "@/server/competitions"
import { getHeatsForCompetition } from "@/server/competition-heats"
import { getPublishedCompetitionWorkouts } from "@/server/competition-workouts"
import { getSessionFromCookie } from "@/utils/auth"
import { SchedulePageContent } from "./_components/schedule-page-content"

type Props = {
	params: Promise<{ slug: string }>
}

export default async function CompetitionSchedulePage({ params }: Props) {
	const { slug } = await params
	const competition = await getCompetition(slug)

	if (!competition) {
		notFound()
	}

	const [session, events, heats] = await Promise.all([
		getSessionFromCookie(),
		getPublishedCompetitionWorkouts(competition.id),
		getHeatsForCompetition(competition.id),
	])

	return (
		<SchedulePageContent
			events={events}
			heats={heats}
			currentUserId={session?.userId}
		/>
	)
}
