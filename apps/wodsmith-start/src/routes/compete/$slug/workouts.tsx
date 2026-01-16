import { createFileRoute } from "@tanstack/react-router"
import { Dumbbell } from "lucide-react"
import { useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { WorkoutCard } from "@/components/workout-card"
import { getPublicCompetitionDivisionsFn } from "@/server-fns/competition-divisions-fns"
import { getCompetitionBySlugFn } from "@/server-fns/competition-fns"
import {
	getPublishedCompetitionWorkoutsWithDetailsFn,
	getWorkoutDivisionDescriptionsFn,
} from "@/server-fns/competition-workouts-fns"

export const Route = createFileRoute("/compete/$slug/workouts")({
	component: CompetitionWorkoutsPage,
	loader: async ({ params }) => {
		// Fetch competition by slug to get the ID
		const { competition } = await getCompetitionBySlugFn({
			data: { slug: params.slug },
		})

		if (!competition) {
			return { workouts: [], divisions: [], divisionDescriptionsMap: new Map() }
		}

		const competitionId = competition.id

		// Fetch divisions, workouts in parallel
		const [divisionsResult, workoutsResult] = await Promise.all([
			getPublicCompetitionDivisionsFn({
				data: { competitionId },
			}),
			getPublishedCompetitionWorkoutsWithDetailsFn({
				data: { competitionId },
			}),
		])

		const divisions = divisionsResult.divisions
		const workouts = workoutsResult.workouts

		// Fetch division descriptions for all workouts in parallel
		const divisionIds = divisions?.map((d) => d.id) ?? []
		const divisionDescriptionsMap = new Map<
			string,
			Awaited<ReturnType<typeof getWorkoutDivisionDescriptionsFn>>
		>()

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
				divisionDescriptionsMap.set(workoutId, { descriptions })
			}
		}

		return {
			workouts,
			divisions,
			divisionDescriptionsMap,
		}
	},
})

function CompetitionWorkoutsPage() {
	const { workouts, divisions, divisionDescriptionsMap } = Route.useLoaderData()
	const [selectedDivisionId, setSelectedDivisionId] =
		useState<string>("default")

	if (workouts.length === 0) {
		return (
			<div className="space-y-8">
				<h2 className="text-2xl font-bold">Workouts</h2>
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
			<div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4 border-b -mx-4 px-4 sm:mx-0 sm:px-0">
				<div className="flex items-center justify-between gap-4">
					<h2 className="text-2xl font-bold flex items-center">
						Workouts
						<span className="text-muted-foreground font-normal text-lg ml-2 hidden sm:inline">
							({workouts.length} event{workouts.length !== 1 ? "s" : ""})
						</span>
					</h2>

					{divisions && divisions.length > 0 && (
						<Select
							value={selectedDivisionId}
							onValueChange={setSelectedDivisionId}
						>
							<SelectTrigger className="w-[180px]">
								<SelectValue placeholder="Select Division" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="default">All Divisions</SelectItem>
								{divisions.map((division) => (
									<SelectItem key={division.id} value={division.id}>
										{division.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</div>
				<span className="text-muted-foreground font-normal text-sm sm:hidden">
					{workouts.length} event{workouts.length !== 1 ? "s" : ""}
				</span>
			</div>

			<div className="space-y-4">
				{workouts.map((event) => {
					const divisionDescriptionsResult = divisionDescriptionsMap.get(
						event.workoutId,
					)
					return (
						<WorkoutCard
							key={event.id}
							trackOrder={event.trackOrder}
							name={event.workout.name}
							scheme={event.workout.scheme}
							description={event.workout.description}
							scoreType={event.workout.scoreType}
							roundsToScore={event.workout.roundsToScore}
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
						/>
					)
				})}
			</div>
		</div>
	)
}
