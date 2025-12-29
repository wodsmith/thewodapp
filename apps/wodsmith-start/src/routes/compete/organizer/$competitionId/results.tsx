/**
 * Competition Results Route
 *
 * Organizer page for entering competition results/scores.
 * Fetches events, divisions, and score entry data.
 * Uses ResultsEntryForm component for score entry UI.
 *
 * Port from apps/wodsmith/src/app/(compete)/compete/organizer/[competitionId]/(with-sidebar)/results/page.tsx
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { useCallback } from "react"
import { z } from "zod"
import { ResultsEntryForm } from "@/components/organizer/results/results-entry-form"
import { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"
import { getCompetitionDivisionsWithCountsFn } from "@/server-fns/competition-divisions-fns"
import {
	getEventScoreEntryDataWithHeatsFn,
	saveCompetitionScoreFn,
} from "@/server-fns/competition-score-fns"
import { getCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"

// Get parent route API to access competition data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

// Search params schema for event and division selection
const searchParamsSchema = z.object({
	event: z.string().optional(),
	division: z.string().optional(),
})

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/results",
)({
	validateSearch: searchParamsSchema,
	component: ResultsPage,
	loaderDeps: ({ search }) => ({
		eventId: search.event,
		divisionId: search.division,
	}),
	loader: async ({ params, deps }) => {
		// First get competition to know the teamId
		const { competition } = await getCompetitionByIdFn({
			data: { competitionId: params.competitionId },
		})

		if (!competition) {
			throw new Error("Competition not found")
		}

		// Fetch events and divisions in parallel
		const [eventsResult, divisionsResult] = await Promise.all([
			getCompetitionWorkoutsFn({
				data: {
					competitionId: params.competitionId,
					teamId: competition.organizingTeamId,
				},
			}),
			getCompetitionDivisionsWithCountsFn({
				data: {
					competitionId: params.competitionId,
					teamId: competition.organizingTeamId,
				},
			}),
		])

		const events = eventsResult.workouts
		const divisions = divisionsResult.divisions

		// Determine which event to show (from URL or first event)
		const selectedEventId = deps.eventId || events[0]?.id
		const selectedEvent = events.find((e) => e.id === selectedEventId)

		// Fetch score entry data if we have a selected event
		let scoreEntryData = null
		if (selectedEvent) {
			scoreEntryData = await getEventScoreEntryDataWithHeatsFn({
				data: {
					competitionId: params.competitionId,
					organizingTeamId: competition.organizingTeamId,
					trackWorkoutId: selectedEvent.id,
					divisionId: deps.divisionId,
				},
			})
		}

		return {
			events,
			divisions,
			selectedEventId,
			selectedDivisionId: deps.divisionId,
			scoreEntryData,
		}
	},
})

function ResultsPage() {
	const {
		events,
		divisions,
		selectedEventId,
		selectedDivisionId,
		scoreEntryData,
	} = Route.useLoaderData()
	const { competitionId } = Route.useParams()

	// Get competition from parent route for organizingTeamId
	const { competition } = parentRoute.useLoaderData()

	// Handle saving scores - wraps the server function with required params
	const handleSaveScore = useCallback(
		async (params: {
			competitionId: string
			organizingTeamId: string
			trackWorkoutId: string
			workoutId: string
			registrationId: string
			userId: string
			divisionId: string | null
			score: string
			scoreStatus: string
			tieBreakScore: string | null
			secondaryScore: string | null
			roundScores?: Array<{ score: string }>
			workout: {
				scheme: string
				scoreType: string | null
				repsPerRound: number | null
				roundsToScore: number | null
				timeCap: number | null
				tiebreakScheme: string | null
			}
		}) => {
			const result = await saveCompetitionScoreFn({
				data: {
					competitionId: params.competitionId,
					organizingTeamId: params.organizingTeamId,
					trackWorkoutId: params.trackWorkoutId,
					workoutId: params.workoutId,
					registrationId: params.registrationId,
					userId: params.userId,
					divisionId: params.divisionId,
					score: params.score,
					scoreStatus: params.scoreStatus as
						| "scored"
						| "cap"
						| "dq"
						| "withdrawn"
						| "dns"
						| "dnf",
					tieBreakScore: params.tieBreakScore,
					secondaryScore: params.secondaryScore,
					roundScores: params.roundScores,
					workout: params.workout,
				},
			})
			return result.data
		},
		[],
	)

	// No events - show empty state
	if (events.length === 0) {
		return (
			<div className="flex flex-col gap-4">
				<div>
					<h2 className="text-xl font-semibold">Enter Results</h2>
					<p className="text-muted-foreground text-sm">
						Enter scores for competition events
					</p>
				</div>
				<div className="text-center py-12 text-muted-foreground">
					No events found for this competition. Add events first before entering
					results.
				</div>
			</div>
		)
	}

	// No score entry data (shouldn't happen if events exist, but handle gracefully)
	if (!scoreEntryData) {
		return (
			<div className="flex flex-col gap-4">
				<div>
					<h2 className="text-xl font-semibold">Enter Results</h2>
					<p className="text-muted-foreground text-sm">
						Enter scores for competition events
					</p>
				</div>
				<div className="text-center py-12 text-muted-foreground">
					Unable to load score entry data. Please try again.
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h2 className="text-xl font-semibold">Enter Results</h2>
				<p className="text-muted-foreground text-sm">
					{scoreEntryData.athletes.length} athlete
					{scoreEntryData.athletes.length !== 1 ? "s" : ""}
					{selectedDivisionId ? " in selected division" : ""}
				</p>
			</div>

			<ResultsEntryForm
				key={`${selectedEventId}-${selectedDivisionId}`}
				competitionId={competitionId}
				organizingTeamId={competition.organizingTeamId}
				events={events.map((e) => ({
					id: e.id,
					name: e.workout.name,
					trackOrder: e.trackOrder,
				}))}
				selectedEventId={selectedEventId}
				event={scoreEntryData.event}
				athletes={scoreEntryData.athletes}
				heats={scoreEntryData.heats}
				unassignedRegistrationIds={scoreEntryData.unassignedRegistrationIds}
				divisions={divisions.map((d) => ({
					id: d.id,
					label: d.label,
				}))}
				selectedDivisionId={selectedDivisionId}
				saveScore={handleSaveScore}
			/>
		</div>
	)
}
