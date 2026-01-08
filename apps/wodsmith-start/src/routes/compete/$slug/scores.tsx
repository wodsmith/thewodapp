/**
 * Volunteer Score Entry Route
 *
 * Allows volunteers with score access entitlement to enter competition scores.
 * This is a simplified view without the full organizer sidebar.
 */

import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { useCallback } from "react"
import { z } from "zod"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ResultsEntryForm } from "@/components/organizer/results/results-entry-form"
import { getCompetitionBySlugFn } from "@/server-fns/competition-fns"
import {
	getCompetitionDivisionsForScoreEntryFn,
	getCompetitionWorkoutsForScoreEntryFn,
	getEventScoreEntryDataWithHeatsFn,
	saveCompetitionScoreFn,
} from "@/server-fns/competition-score-fns"
import { canInputScoresFn } from "@/server-fns/volunteer-fns"

const searchParamsSchema = z.object({
	event: z.string().optional(),
	division: z.string().optional(),
})

export const Route = createFileRoute("/compete/$slug/scores")({
	validateSearch: searchParamsSchema,
	staleTime: 5_000, // Cache for 5 seconds - scores change frequently
	loaderDeps: ({ search }) => ({
		eventId: search.event,
		divisionId: search.division,
	}),
	loader: async ({ params, deps, context }) => {
		const { slug } = params
		const session = context.session

		// Require authentication
		if (!session?.user?.id) {
			throw redirect({
				to: "/sign-in",
				search: { redirect: `/compete/${slug}/scores` },
			})
		}

		// Get competition by slug
		const { competition } = await getCompetitionBySlugFn({ data: { slug } })

		if (!competition) {
			throw new Error("Competition not found")
		}

		if (!competition.competitionTeamId) {
			throw new Error("Competition team not found")
		}

		// Parallel fetch: score access check, events, and divisions
		// All only need competition.id and competition.competitionTeamId
		const [hasScoreAccess, eventsResult, divisionsResult] = await Promise.all([
			canInputScoresFn({
				data: {
					userId: session.user.id,
					competitionTeamId: competition.competitionTeamId,
				},
			}),
			getCompetitionWorkoutsForScoreEntryFn({
				data: {
					competitionId: competition.id,
					competitionTeamId: competition.competitionTeamId,
				},
			}),
			getCompetitionDivisionsForScoreEntryFn({
				data: {
					competitionId: competition.id,
					competitionTeamId: competition.competitionTeamId,
				},
			}),
		])

		// Check access after parallel fetch
		if (!hasScoreAccess) {
			throw redirect({
				to: "/compete/$slug",
				params: { slug },
			})
		}

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
					competitionId: competition.id,
					organizingTeamId: competition.organizingTeamId,
					trackWorkoutId: selectedEvent.id,
					divisionId: deps.divisionId,
				},
			})
		}

		return {
			competition,
			events,
			divisions,
			selectedEventId,
			selectedDivisionId: deps.divisionId,
			scoreEntryData,
		}
	},
	component: VolunteerScoresPage,
	head: ({ loaderData }) => {
		const competition = loaderData?.competition
		if (!competition) {
			return {
				meta: [{ title: "Competition Not Found" }],
			}
		}
		return {
			meta: [
				{ title: `Enter Scores - ${competition.name}` },
				{
					name: "description",
					content: `Enter scores for ${competition.name}`,
				},
			],
		}
	},
})

function VolunteerScoresPage() {
	const {
		competition,
		events,
		divisions,
		selectedEventId,
		selectedDivisionId,
		scoreEntryData,
	} = Route.useLoaderData()
	const { slug } = Route.useParams()

	// Handle saving scores
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

	return (
		<div className="min-h-screen bg-background">
			<div className="border-b">
				<div className="container mx-auto px-4 py-4">
					<Button variant="ghost" size="sm" asChild>
						<Link to="/compete/$slug/my-schedule" params={{ slug }}>
							<ArrowLeft className="mr-2 h-4 w-4" />
							Back to My Schedule
						</Link>
					</Button>
				</div>
			</div>

			<div className="container mx-auto py-8 px-4">
				<div className="mb-6">
					<h1 className="text-2xl font-bold">{competition.name}</h1>
					<p className="text-muted-foreground">Enter Scores</p>
				</div>

				{/* No events - show empty state */}
				{events.length === 0 && (
					<div className="text-center py-12 text-muted-foreground">
						No events found for this competition.
					</div>
				)}

				{/* No score entry data */}
				{events.length > 0 && !scoreEntryData && (
					<div className="text-center py-12 text-muted-foreground">
						Unable to load score entry data. Please try again.
					</div>
				)}

				{/* Score entry form */}
				{scoreEntryData && (
					<ResultsEntryForm
						key={`${selectedEventId}-${selectedDivisionId}`}
						competitionId={competition.id}
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
				)}
			</div>
		</div>
	)
}
