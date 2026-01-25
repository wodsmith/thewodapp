import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { EventDetailsContent } from "@/components/event-details-content"
import { RegistrationSidebar } from "@/components/registration-sidebar"
import { Card, CardContent } from "@/components/ui/card"
import {
	getPublishedCompetitionWorkoutsWithDetailsFn,
	getWorkoutDivisionDescriptionsFn,
} from "@/server-fns/competition-workouts-fns"
import { getCompetitionBySlugFn } from "@/server-fns/competition-fns"
import { CompetitionWorkoutCard } from "@/components/competition-workout-card"
import { getPublicCompetitionDivisionsFn } from "@/server-fns/competition-divisions-fns"

const parentRoute = getRouteApi("/compete/$slug")

export const Route = createFileRoute("/compete/$slug/")({
	component: CompetitionOverviewPage,
	loader: async ({ params }) => {
		const { competition } = await getCompetitionBySlugFn({
			data: { slug: params.slug },
		})

		if (!competition) {
			return { workouts: [], divisionDescriptionsMap: {} }
		}

		const competitionId = competition.id

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

		return { workouts, divisionDescriptionsMap }
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
	} = parentRoute.useLoaderData()

	const { slug } = Route.useParams()
	const { workouts, divisionDescriptionsMap } = Route.useLoaderData()

	const isRegistered = !!userRegistration
	const isTeamRegistration = (userDivision?.teamSize ?? 1) > 1

	return (
		<div className="grid gap-8 lg:grid-cols-[1fr_320px]">
			{/* Main Content */}
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
										/>
									)
								})}
							</div>
						</div>
					) : (
						<section>
							<Card className="border-dashed">
								<CardContent className="py-6 text-center">
									<p className="text-muted-foreground">
										Workouts will be announced by the event organizer.
									</p>
								</CardContent>
							</Card>
						</section>
					)
				}
				scheduleContent={
					<Card className="border-dashed">
						<CardContent className="py-6 text-center">
							<p className="text-muted-foreground">
								Schedule information coming soon.
							</p>
						</CardContent>
					</Card>
				}
			/>

			{/* Sidebar */}
			<aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
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
