import "server-only"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { ZSAError } from "@repo/zsa"
import { Button } from "@/components/ui/button"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getCompetitionDivisionsWithCounts } from "@/server/competition-divisions"
import { getCompetitionWorkouts } from "@/server/competition-workouts"
import { getEventScoreEntryData } from "@/server/competition-scores"
import { getCompetition } from "@/server/competitions"
import { requireTeamPermission } from "@/utils/team-auth"
import { OrganizerBreadcrumb } from "../../_components/organizer-breadcrumb"
import { ResultsEntryForm } from "./_components/results-entry-form"

interface ResultsPageProps {
	params: Promise<{
		competitionId: string
	}>
	searchParams: Promise<{
		event?: string
		division?: string
	}>
}

export async function generateMetadata({
	params,
}: ResultsPageProps): Promise<Metadata> {
	const { competitionId } = await params
	const competition = await getCompetition(competitionId)

	if (!competition) {
		return {
			title: "Results Not Found",
		}
	}

	return {
		title: `Enter Results - ${competition.name}`,
		description: `Enter competition results for ${competition.name}`,
	}
}

export default async function ResultsPage({
	params,
	searchParams,
}: ResultsPageProps) {
	const { competitionId } = await params
	const { event: selectedEventId, division: selectedDivisionId } =
		await searchParams

	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	// Check permission
	try {
		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)
	} catch (error) {
		if (
			error instanceof ZSAError &&
			(error.code === "NOT_AUTHORIZED" || error.code === "FORBIDDEN")
		) {
			notFound()
		}
		throw error
	}

	// Get all events for this competition
	const events = await getCompetitionWorkouts(competitionId)

	// Default to first event if none selected
	const currentEventId = selectedEventId || events[0]?.id
	const currentEvent = events.find((e) => e.id === currentEventId)

	// Get athletes and existing scores for selected event
	const [scoreEntryData, { divisions }] = currentEvent
		? await Promise.all([
				getEventScoreEntryData({
					competitionId,
					trackWorkoutId: currentEvent.id,
					competitionTeamId: competition.competitionTeamId,
					divisionId: selectedDivisionId,
				}),
				getCompetitionDivisionsWithCounts({ competitionId }),
			])
		: [null, { divisions: [] }]

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				{/* Header */}
				<div>
					<OrganizerBreadcrumb
						segments={[
							{
								label: competition.name,
								href: `/compete/organizer/${competition.id}`,
							},
							{ label: "Enter Results" },
						]}
					/>
					<div className="flex items-center gap-4 mt-2">
						<Button variant="ghost" size="sm" asChild>
							<Link href={`/compete/organizer/${competition.id}`}>
								<ChevronLeft className="h-4 w-4 mr-1" />
								Back to Competition
							</Link>
						</Button>
					</div>
					<h1 className="text-3xl font-bold mt-4">Enter Results</h1>
				</div>

				{events.length > 0 && currentEvent && scoreEntryData ? (
					<ResultsEntryForm
						key={currentEvent.id + selectedDivisionId}
						competitionId={competition.id}
						organizingTeamId={competition.organizingTeamId}
						events={events.map((e) => ({
							id: e.id,
							name: e.workout.name,
							trackOrder: e.trackOrder,
						}))}
						selectedEventId={currentEventId}
						event={scoreEntryData.event}
						athletes={scoreEntryData.athletes}
						divisions={divisions}
						selectedDivisionId={selectedDivisionId}
					/>
				) : (
					<div className="text-center py-12 text-muted-foreground">
						No events found for this competition. Add events first before
						entering results.
					</div>
				)}
			</div>
		</div>
	)
}
