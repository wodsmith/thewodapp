import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { CompetitionLocationCard } from "@/components/competition-location-card"
import { CompetitionTabs } from "@/components/competition-tabs"
import {
	CompetitionWorkoutCard,
	type SubmissionStatus,
} from "@/components/competition-workout-card"
import { EventDetailsContent } from "@/components/event-details-content"
import { RegistrationSidebar } from "@/components/registration-sidebar"
import {
	getPublicScheduleDataFn,
	getVenueForTrackWorkoutFn,
	type PublicScheduleEvent,
} from "@/server-fns/competition-heats-fns"
import {
	getBatchWorkoutDivisionDescriptionsFn,
	getPublishedCompetitionWorkoutsWithDetailsFn,
	type DivisionDescription,
} from "@/server-fns/competition-workouts-fns"
import { getBatchSubmissionStatusFn } from "@/server-fns/video-submission-fns"
import { useDeferredSchedule } from "@/utils/use-deferred-schedule"

const parentRoute = getRouteApi("/compete/$slug")

export const Route = createFileRoute("/compete/$slug/")({
	component: CompetitionOverviewPage,
	loader: async ({ parentMatchPromise }) => {
		const parentMatch = await parentMatchPromise
		const competition = parentMatch.loaderData?.competition
		const divisions = parentMatch.loaderData?.divisions

		if (!competition) {
			return {
				workouts: [],
				divisionDescriptionsMap: {} as Record<string, DivisionDescription[]>,
				venueMap: {} as Record<string, null>,
				submissionStatusMap: {} as Record<string, SubmissionStatus>,
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

		const workoutsResult = await getPublishedCompetitionWorkoutsWithDetailsFn({
			data: { competitionId },
		})

		const workouts = workoutsResult.workouts
		const divisionIds = divisions?.map((d) => d.id) ?? []
		const divisionDescriptionsMap: Record<string, DivisionDescription[]> = {}

		if (divisionIds.length > 0 && workouts.length > 0) {
			const workoutIds = workouts.map((w) => w.workoutId)
			const batchResult = await getBatchWorkoutDivisionDescriptionsFn({
				data: { workoutIds, divisionIds },
			})
			Object.assign(divisionDescriptionsMap, batchResult.descriptionsByWorkout)
		}

		// Fetch venue data for each workout
		type VenueInfo = {
			id: string
			name: string
			address: {
				streetLine1?: string
				city?: string
				stateProvince?: string
				postalCode?: string
				countryCode?: string
			} | null
		}
		const venueMap: Record<string, VenueInfo | null> = {}
		if (competition.competitionType !== "online" && workouts.length > 0) {
			const venuePromises = workouts.map(async (event) => {
				const result = await getVenueForTrackWorkoutFn({
					data: { trackWorkoutId: event.id },
				})
				return { trackWorkoutId: event.id, venueData: result }
			})
			const venueResults = await Promise.all(venuePromises)
			for (const { trackWorkoutId, venueData } of venueResults) {
				if (venueData.venue) {
					venueMap[trackWorkoutId] = {
						id: venueData.venue.id,
						name: venueData.venue.name,
						address: venueData.venue.address
							? {
									streetLine1: venueData.venue.address.streetLine1 ?? undefined,
									city: venueData.venue.address.city ?? undefined,
									stateProvince: venueData.venue.address.stateProvince ?? undefined,
									postalCode: venueData.venue.address.postalCode ?? undefined,
									countryCode: venueData.venue.address.countryCode ?? undefined,
								}
							: null,
					}
				} else {
					venueMap[trackWorkoutId] = null
				}
			}
		}

		// Fetch submission statuses for online competitions with registered athletes
		const userRegistration = parentMatch.loaderData?.userRegistration
		let submissionStatusMap: Record<string, SubmissionStatus> = {}
		if (
			competition.competitionType === "online" &&
			userRegistration &&
			workouts.length > 0
		) {
			const result = await getBatchSubmissionStatusFn({
				data: {
					competitionId,
					trackWorkoutIds: workouts.map((w) => w.id),
				},
			})
			submissionStatusMap = result.statuses
		}

		return {
			workouts,
			divisionDescriptionsMap,
			venueMap,
			submissionStatusMap,
			deferredSchedule,
		}
	},
})

function CompetitionOverviewPage() {
	const {
		competition,
		userRegistration,
		isVolunteer,
		registrationStatus,
		session,
		divisions,
		sponsors,
		userDivision,
		userDivisions,
		maxSpots,
		organizerContactEmail,
	} = parentRoute.useLoaderData()

	const { slug } = Route.useParams()
	const {
		workouts,
		divisionDescriptionsMap,
		venueMap,
		submissionStatusMap,
		deferredSchedule,
	} = Route.useLoaderData()

	const isRegistered = !!userRegistration
	const isTeamRegistration = (userDivision?.teamSize ?? 1) > 1
	const timezone = competition.timezone ?? "America/Denver"
	const scheduleMap = useDeferredSchedule({ deferredSchedule, timezone })
	const isOnline = competition.competitionType === "online"

	// Build a venue from the competition's main address for workout cards
	// Only create when address has real data to preserve "Venue to be announced" fallback
	const hasAddressInfo =
		!isOnline &&
		(competition.address?.name ||
			competition.address?.streetLine1 ||
			competition.address?.city ||
			competition.address?.stateProvince ||
			competition.address?.postalCode ||
			competition.address?.countryCode)
	const competitionVenue = hasAddressInfo
		? {
				id: "competition-main",
				name: competition.address?.name ?? "Competition Venue",
				address: competition.address
					? {
							streetLine1: competition.address.streetLine1 ?? undefined,
							city: competition.address.city ?? undefined,
							stateProvince: competition.address.stateProvince ?? undefined,
							postalCode: competition.address.postalCode ?? undefined,
							countryCode: competition.address.countryCode ?? undefined,
						}
					: null,
			}
		: undefined

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
														divisionDescriptionsResult ?? []
													}
													sponsorName={event.sponsorName}
													sponsorLogoUrl={event.sponsorLogoUrl}
													selectedDivisionId="default"
													isRegistered={isRegistered}
													submissionStatus={
														submissionStatusMap[event.id] ?? null
													}
													timeCap={event.workout.timeCap}
													schedule={scheduleMap?.get(event.id) ?? null}
													isOnline={isOnline}
													venue={venueMap?.[event.id] ?? competitionVenue}
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
					maxSpots={maxSpots}
					userDivision={userDivision?.label}
					registrationId={userRegistration?.id}
					isTeamRegistration={isTeamRegistration}
					isCaptain={userRegistration?.userId === session?.userId}
					isVolunteer={isVolunteer}
					organizerContactEmail={organizerContactEmail}
					userRegistrations={userDivisions}
					session={session}
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
