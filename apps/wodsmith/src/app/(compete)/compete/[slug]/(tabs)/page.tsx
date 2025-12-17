import "server-only"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { getPublicCompetitionDivisions } from "@/server/competition-divisions"
import { getHeatsForCompetition } from "@/server/competition-heats"
import { getPublishedCompetitionWorkouts } from "@/server/competition-workouts"
import { getCompetition } from "@/server/competitions"
import { getCompetitionSponsors } from "@/server/sponsors"
import { getSessionFromCookie } from "@/utils/auth"
import { EventDetailsContent } from "../_components/event-details-content"
import { ScheduleContent } from "../_components/schedule-content"
import { ScheduleSkeleton } from "../_components/schedule-skeleton"
import { WorkoutsContent } from "../_components/workouts-content"
import { WorkoutsSkeleton } from "../_components/workouts-skeleton"

type Props = {
	params: Promise<{ slug: string }>
}

export default async function CompetitionEventDetailsPage({ params }: Props) {
	const { slug } = await params
	const competition = await getCompetition(slug)

	if (!competition) {
		notFound()
	}

	// Start heavy fetches immediately (don't await - pass promises to components)
	const eventsPromise = getPublishedCompetitionWorkouts(competition.id)
	const heatsPromise = getHeatsForCompetition(competition.id)

	// Parallel fetch: session, divisions, sponsors (needed for content)
	const [session, divisions, sponsorsResult] = await Promise.all([
		getSessionFromCookie(),
		getPublicCompetitionDivisions(competition.id),
		getCompetitionSponsors(competition.id),
	])

	return (
		<EventDetailsContent
			competition={competition}
			divisions={divisions.length > 0 ? divisions : undefined}
			sponsors={sponsorsResult}
			workoutsContent={
				<Suspense fallback={<WorkoutsSkeleton />}>
					<WorkoutsContent
						key="workouts"
						competition={competition}
						divisions={divisions}
					/>
				</Suspense>
			}
			scheduleContent={
				<Suspense fallback={<ScheduleSkeleton />}>
					<ScheduleContent
						key="schedule"
						eventsPromise={eventsPromise}
						heatsPromise={heatsPromise}
						currentUserId={session?.userId}
					/>
				</Suspense>
			}
		/>
	)
}
