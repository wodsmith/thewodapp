import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { CompetitionTabs } from "@/components/competition-tabs"
import { PublicSubmissionWindows } from "@/components/public-submission-windows"
import { SchedulePageContent } from "@/components/schedule-page-content"
import { getPublicCompetitionEventsFn } from "@/server-fns/competition-event-fns"
import { getHeatsForCompetitionFn } from "@/server-fns/competition-heats-fns"
import { getPublishedCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"

const parentRoute = getRouteApi("/compete/$slug")

export const Route = createFileRoute("/compete/$slug/schedule")({
	component: CompetitionSchedulePage,
	loader: async ({ parentMatchPromise }) => {
		const parentMatch = await parentMatchPromise
		const competition = parentMatch.loaderData?.competition

		if (!competition) {
			return {
				heats: [],
				events: [],
				submissionWindows: [],
				competitionStarted: false,
				isOnline: false,
				timezone: "America/Denver",
			}
		}

		const isOnline = competition.competitionType === "online"

		// For online competitions, fetch submission windows instead of heats
		if (isOnline) {
			const [eventsResult, submissionResult] = await Promise.allSettled([
				getPublishedCompetitionWorkoutsFn({
					data: { competitionId: competition.id },
				}),
				getPublicCompetitionEventsFn({
					data: { competitionId: competition.id },
				}),
			])

			return {
				heats: [],
				events:
					eventsResult.status === "fulfilled"
						? eventsResult.value.workouts
						: [],
				submissionWindows:
					submissionResult.status === "fulfilled"
						? submissionResult.value.events
						: [],
				competitionStarted:
					submissionResult.status === "fulfilled"
						? submissionResult.value.competitionStarted
						: competition.startDate
							? new Date() >= new Date(`${competition.startDate}T00:00:00`)
							: false,
				isOnline: true,
				timezone: competition.timezone ?? "America/Denver",
			}
		}

		// For in-person competitions, fetch heats as usual
		const [heatsResult, eventsResult] = await Promise.allSettled([
			getHeatsForCompetitionFn({ data: { competitionId: competition.id } }),
			getPublishedCompetitionWorkoutsFn({
				data: { competitionId: competition.id },
			}),
		])

		return {
			heats: heatsResult.status === "fulfilled" ? heatsResult.value.heats : [],
			events:
				eventsResult.status === "fulfilled" ? eventsResult.value.workouts : [],
			submissionWindows: [],
			competitionStarted: false,
			isOnline: false,
			timezone: competition.timezone ?? "America/Denver",
		}
	},
})

function CompetitionSchedulePage() {
	const {
		heats,
		events,
		submissionWindows,
		competitionStarted,
		isOnline,
		timezone,
	} = Route.useLoaderData()
	const { competition, session } = parentRoute.useLoaderData()

	return (
		<div className="space-y-4">
			<div className="sticky top-4 z-10">
				<CompetitionTabs slug={competition.slug} />
			</div>
			<div className="rounded-2xl border border-black/10 bg-black/5 p-4 sm:p-6 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
				{isOnline ? (
					<PublicSubmissionWindows
						events={events}
						submissionWindows={submissionWindows}
						competitionStarted={competitionStarted}
						timezone={timezone}
					/>
				) : (
					<SchedulePageContent
						events={events}
						heats={heats}
						currentUserId={session?.userId}
						timezone={timezone}
					/>
				)}
			</div>
		</div>
	)
}
