import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { CompetitionTabs } from "@/components/competition-tabs"
import { RegistrationSidebar } from "@/components/registration-sidebar"
import { SchedulePageContent } from "@/components/schedule-page-content"
import { getCompetitionBySlugFn } from "@/server-fns/competition-fns"
import { getHeatsForCompetitionFn } from "@/server-fns/competition-heats-fns"
import { getPublishedCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"

const parentRoute = getRouteApi("/compete/$slug")

export const Route = createFileRoute("/compete/$slug/schedule")({
	component: CompetitionSchedulePage,
	loader: async ({ params }) => {
		// Fetch competition by slug to get the ID
		const { competition } = await getCompetitionBySlugFn({
			data: { slug: params.slug },
		})

		if (!competition) {
			return { heats: [], events: [] }
		}

		// Fetch heats and events for this competition
		const [heatsResult, eventsResult] = await Promise.all([
			getHeatsForCompetitionFn({ data: { competitionId: competition.id } }),
			getPublishedCompetitionWorkoutsFn({
				data: { competitionId: competition.id },
			}),
		])

		return {
			heats: heatsResult.heats,
			events: eventsResult.workouts,
		}
	},
})

function CompetitionSchedulePage() {
	const { heats, events } = Route.useLoaderData()
	const {
		competition,
		registrationCount,
		userRegistration,
		isVolunteer,
		registrationStatus,
		session,
		userDivision,
		maxSpots,
	} = parentRoute.useLoaderData()

	const isRegistered = !!userRegistration
	const isTeamRegistration = (userDivision?.teamSize ?? 1) > 1

	return (
		<div className="grid gap-6 lg:grid-cols-[1fr_320px]">
			<div className="space-y-4">
				<div className="sticky top-4 z-10">
					<CompetitionTabs slug={competition.slug} />
				</div>
				<div className="rounded-2xl border border-black/10 bg-black/5 p-6 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
					<SchedulePageContent
						events={events}
						heats={heats}
						currentUserId={session?.userId}
					/>
				</div>
			</div>
			<aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
				<RegistrationSidebar
					competition={competition}
					isRegistered={isRegistered}
					registrationOpen={registrationStatus.registrationOpen}
					registrationCount={registrationCount}
					maxSpots={maxSpots}
					userDivision={userDivision?.label}
					registrationId={userRegistration?.id}
					isTeamRegistration={isTeamRegistration}
					isCaptain={userRegistration?.userId === session?.userId}
					isVolunteer={isVolunteer}
				/>
			</aside>
		</div>
	)
}
