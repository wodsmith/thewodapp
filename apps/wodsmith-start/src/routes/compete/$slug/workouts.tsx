import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Dumbbell, Filter } from "lucide-react"
import { z } from "zod"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { CompetitionWorkoutCard } from "@/components/competition-workout-card"
import { getPublicCompetitionEventsFn } from "@/server-fns/competition-event-fns"
import { getPublicCompetitionDivisionsFn } from "@/server-fns/competition-divisions-fns"
import { getCompetitionBySlugFn } from "@/server-fns/competition-fns"
import {
	getPublishedCompetitionWorkoutsWithDetailsFn,
	getWorkoutDivisionDescriptionsFn,
} from "@/server-fns/competition-workouts-fns"

const workoutsSearchSchema = z.object({
	division: z.string().optional(),
})

export const Route = createFileRoute("/compete/$slug/workouts")({
	component: CompetitionWorkoutsPage,
	validateSearch: (search) => workoutsSearchSchema.parse(search),
	loader: async ({ params }) => {
		// Fetch competition by slug to get the ID
		const { competition } = await getCompetitionBySlugFn({
			data: { slug: params.slug },
		})

		if (!competition) {
			return {
				workouts: [],
				divisions: [],
				divisionDescriptionsMap: {},
				submissionWindowsMap: {},
				isOnline: false,
				competitionStarted: false,
				timezone: "America/Denver",
			}
		}

		const competitionId = competition.id
		const isOnline = competition.competitionType === "online"

		// Fetch divisions, workouts, and submission windows (if online) in parallel
		const [divisionsResult, workoutsResult, submissionResult] =
			await Promise.all([
				getPublicCompetitionDivisionsFn({
					data: { competitionId },
				}),
				getPublishedCompetitionWorkoutsWithDetailsFn({
					data: { competitionId },
				}),
				isOnline
					? getPublicCompetitionEventsFn({ data: { competitionId } })
					: Promise.resolve({ events: [], competitionStarted: false }),
			])

		const divisions = divisionsResult.divisions
		const workouts = workoutsResult.workouts

		// Build submission windows map by trackWorkoutId
		const submissionWindowsMap: Record<
			string,
			{
				submissionOpensAt: string | null
				submissionClosesAt: string | null
			}
		> = {}
		for (const event of submissionResult.events) {
			submissionWindowsMap[event.trackWorkoutId] = {
				submissionOpensAt: event.submissionOpensAt,
				submissionClosesAt: event.submissionClosesAt,
			}
		}

		// Fetch division descriptions for all workouts in parallel
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

		return {
			workouts,
			divisions,
			divisionDescriptionsMap,
			submissionWindowsMap,
			isOnline,
			competitionStarted: submissionResult.competitionStarted,
			timezone: competition.timezone ?? "America/Denver",
		}
	},
})

function CompetitionWorkoutsPage() {
	const {
		workouts,
		divisions,
		divisionDescriptionsMap,
		submissionWindowsMap,
		isOnline,
		competitionStarted,
		timezone,
	} = Route.useLoaderData()
	const search = Route.useSearch()
	const navigate = useNavigate({ from: Route.fullPath })

	// Default to first division if available and none selected, or "default"
	const defaultDivisionId =
		divisions && divisions.length > 0 ? divisions[0].id : "default"
	const selectedDivisionId = search.division || defaultDivisionId

	const handleDivisionChange = (divisionId: string) => {
		navigate({
			search: (prev) => ({ ...prev, division: divisionId }),
			replace: true, // Replace history entry to avoid cluttering back button
		})
	}

	if (workouts.length === 0) {
		return (
			<div className="space-y-8">
				<h2 className="text-3xl font-bold tracking-tight">Workouts</h2>
				<Alert variant="default" className="border-dashed">
					<Dumbbell className="h-4 w-4" />
					<AlertTitle>Workouts not yet released</AlertTitle>
					<AlertDescription>
						Competition workouts will be announced closer to the event. Check
						back soon or follow the event organizer for updates.
					</AlertDescription>
				</Alert>
			</div>
		)
	}

	return (
		<div className="space-y-8">
			{/* Sticky Header with Global Context Switcher */}
			<div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4 border-b -mx-4 px-4 sm:mx-0 sm:px-0">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
					<div>
						<h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
							Workouts
							<span className="inline-flex items-center justify-center rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium text-muted-foreground">
								{workouts.length}
							</span>
						</h2>
						<p className="text-sm text-muted-foreground hidden sm:block">
							Viewing variations for{" "}
							<span className="font-medium text-foreground">
								{divisions?.find((d) => d.id === selectedDivisionId)?.label ||
									"All Divisions"}
							</span>
						</p>
					</div>

					{divisions && divisions.length > 0 && (
						<div className="flex items-center gap-2">
							<Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
							<Select
								value={selectedDivisionId}
								onValueChange={handleDivisionChange}
							>
								<SelectTrigger className="w-full sm:w-[240px] h-10 font-medium">
									<SelectValue placeholder="Select Division" />
								</SelectTrigger>
								<SelectContent>
									{divisions.map((division) => (
										<SelectItem
											key={division.id}
											value={division.id}
											className="cursor-pointer"
										>
											{division.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}
				</div>
			</div>

			{/* Workouts List */}
			<div className="space-y-6 pb-20">
				{workouts.map((event) => {
					const divisionDescriptionsResult =
						divisionDescriptionsMap[event.workoutId]
					const submissionWindow = submissionWindowsMap[event.id]

					return (
						<CompetitionWorkoutCard
							key={event.id}
							trackOrder={event.trackOrder}
							name={event.workout.name}
							scheme={event.workout.scheme}
							description={event.workout.description}
							scoreType={event.workout.scoreType}
							roundsToScore={event.workout.roundsToScore}
							tiebreakScheme={event.workout.tiebreakScheme}
							pointsMultiplier={event.pointsMultiplier}
							notes={event.notes}
							movements={event.workout.movements}
							tags={event.workout.tags}
							divisionDescriptions={
								divisionDescriptionsResult?.descriptions ?? []
							}
							sponsorName={event.sponsorName}
							sponsorLogoUrl={event.sponsorLogoUrl}
							selectedDivisionId={selectedDivisionId}
							timeCap={event.workout.timeCap}
							submissionWindow={
								isOnline && competitionStarted ? submissionWindow : undefined
							}
							timezone={timezone}
						/>
					)
				})}
			</div>
		</div>
	)
}
