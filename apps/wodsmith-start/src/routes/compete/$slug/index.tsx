import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { CompetitionLocationCard } from "@/components/competition-location-card"
import { CompetitionTabs } from "@/components/competition-tabs"
import { CompetitionWorkoutCard } from "@/components/competition-workout-card"
import { EventDetailsContent } from "@/components/event-details-content"
import { RegistrationSidebar } from "@/components/registration-sidebar"
import { getPublicCompetitionDivisionsFn } from "@/server-fns/competition-divisions-fns"
import { getCompetitionBySlugFn } from "@/server-fns/competition-fns"
import {
	getPublicScheduleDataFn,
	type PublicScheduleEvent,
} from "@/server-fns/competition-heats-fns"
import {
	getPublishedCompetitionWorkoutsWithDetailsFn,
	getWorkoutDivisionDescriptionsFn,
} from "@/server-fns/competition-workouts-fns"
import { useDeferredSchedule } from "@/utils/use-deferred-schedule"

const parentRoute = getRouteApi("/compete/$slug")

export const Route = createFileRoute("/compete/$slug/")({
	component: CompetitionOverviewPage,
	loader: async ({ params }) => {
		const { competition } = await getCompetitionBySlugFn({
			data: { slug: params.slug },
		})

		if (!competition) {
			return {
				workouts: [],
				divisionDescriptionsMap: {},
				deferredSchedule: Promise.resolve({
					events: [] as PublicScheduleEvent[],
				}),
			}
		}

		const competitionId = competition.id

		// Defer schedule data - it's below the fold and not needed immediately
		const deferredSchedule = getPublicScheduleDataFn({
			data: { competitionId },
		})

		const [workoutsResult, divisionsResult] = await Promise.all([
			getPublishedCompetitionWorkoutsWithDetailsFn({
				data: { competitionId },
			}),
			getPublicCompetitionDivisionsFn({
				data: { competitionId },
			}),
		])

		const workouts = workoutsResult.workouts
		const divisions = divisionsResult.divisions
		const divisionIds = divisions?.map((d) => d.id) ?? []
		const divisionDescriptionsMap: Record<
			string,
			Awaited<ReturnType<typeof getWorkoutDivisionDescriptionsFn>>
		> = {}

		if (divisionIds.length > 0 && workouts.length > 0) {
			const descriptionsPromises = workouts.map(async (event) => {
				const result = await getWorkoutDivisionDescriptionsFn({
					data: {
						workoutId: event.workoutId,
						divisionIds,
					},
				})
				return { workoutId: event.workoutId, descriptions: result.descriptions }
			})

			const results = await Promise.all(descriptionsPromises)
			for (const { workoutId, descriptions } of results) {
				divisionDescriptionsMap[workoutId] = { descriptions }
			}
		}

		return { workouts, divisionDescriptionsMap, deferredSchedule }
	},
})

function CompetitionOverviewPage() {
	const {
		competition,
		registrationCount,
		userRegistration,
		isVolunteer,
		registrationStatus,
		session,
		divisions,
		sponsors,
		userDivision,
		maxSpots,
		organizerContactEmail,
	} = parentRoute.useLoaderData()

	const { slug } = Route.useParams()
	const { workouts, divisionDescriptionsMap, deferredSchedule } =
		Route.useLoaderData()

	const isRegistered = !!userRegistration
	const isTeamRegistration = (userDivision?.teamSize ?? 1) > 1
	const timezone = competition.timezone ?? "America/Denver"
	const scheduleMap = useDeferredSchedule(deferredSchedule, timezone)

	return (
		<div className="grid gap-6 lg:grid-cols-[1fr_320px]">
			{/* Main Content Column */}
			<div className="space-y-4">
				{/* Sticky Tabs */}
				<div className="sticky top-4 z-10">
					<CompetitionTabs slug={competition.slug} />
				</div>

				{/* Content Panel */}
				<div className="rounded-2xl border border-black/10 bg-black/5 p-4 sm:p-6 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
					<EventDetailsContent
						competition={competition}
						divisions={divisions.length > 0 ? divisions : undefined}
						sponsors={sponsors}
						workoutsContent={
							workouts.length > 0 ? (
								<div className="space-y-6">
									<h2 className="text-xl font-semibold mb-4">Workouts</h2>
									<div className="space-y-6">
										{workouts.map((event) => {
											const divisionDescriptionsResult =
												divisionDescriptionsMap[event.workoutId]
											return (
												<CompetitionWorkoutCard
													key={event.id}
													eventId={event.id}
													slug={slug}
													trackOrder={event.trackOrder}
													name={event.workout.name}
													scheme={event.workout.scheme}
													description={event.workout.description}
													roundsToScore={event.workout.roundsToScore}
													pointsMultiplier={event.pointsMultiplier}
													movements={event.workout.movements}
													tags={event.workout.tags}
													divisionDescriptions={
														divisionDescriptionsResult?.descriptions ?? []
													}
													sponsorName={event.sponsorName}
													sponsorLogoUrl={event.sponsorLogoUrl}
													selectedDivisionId="default"
													timeCap={event.workout.timeCap}
													schedule={scheduleMap?.get(event.id) ?? null}
												/>
											)
										})}
									</div>
								</div>
							) : undefined
						}
					/>
				</div>
			</div>

			{/* Sidebar - Order first on mobile/tablet for prominent Register button */}
			<aside className="order-first space-y-4 lg:order-none lg:sticky lg:top-4 lg:self-start">
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
					organizerContactEmail={organizerContactEmail}
				/>
				<CompetitionLocationCard
					address={competition.address}
					competitionType={competition.competitionType}
					organizingTeamName={competition.organizingTeam?.name}
				/>
			</aside>
		</div>
	)
}
