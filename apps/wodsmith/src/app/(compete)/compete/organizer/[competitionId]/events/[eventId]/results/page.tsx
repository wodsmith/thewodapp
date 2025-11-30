import "server-only"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { ZSAError } from "@repo/zsa"
import { Button } from "@/components/ui/button"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getCompetitionDivisionsWithCounts } from "@/server/competition-divisions"
import { getCompetitionEvent } from "@/server/competition-workouts"
import { getEventScoreEntryData } from "@/server/competition-scores"
import { getCompetition } from "@/server/competitions"
import { requireTeamPermission } from "@/utils/team-auth"
import { OrganizerBreadcrumb } from "../../../../_components/organizer-breadcrumb"
import { ResultsEntryForm } from "./_components/results-entry-form"

interface ResultsPageProps {
	params: Promise<{
		competitionId: string
		eventId: string
	}>
	searchParams: Promise<{
		division?: string
	}>
}

export async function generateMetadata({
	params,
}: ResultsPageProps): Promise<Metadata> {
	const { competitionId, eventId } = await params
	const [competition, event] = await Promise.all([
		getCompetition(competitionId),
		getCompetitionEvent(eventId),
	])

	if (!competition || !event) {
		return {
			title: "Results Not Found",
		}
	}

	return {
		title: `Enter Results: ${event.workout.name} - ${competition.name}`,
		description: `Enter competition results for ${event.workout.name}`,
	}
}

export default async function ResultsPage({
	params,
	searchParams,
}: ResultsPageProps) {
	const { competitionId, eventId } = await params
	const { division: selectedDivisionId } = await searchParams

	// Parallel fetch: competition and event
	const [competition, event] = await Promise.all([
		getCompetition(competitionId),
		getCompetitionEvent(eventId),
	])

	if (!competition) {
		notFound()
	}

	if (!event) {
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

	// Get athletes and existing scores
	const [scoreEntryData, { divisions }] = await Promise.all([
		getEventScoreEntryData({
			competitionId,
			trackWorkoutId: eventId,
			divisionId: selectedDivisionId,
		}),
		getCompetitionDivisionsWithCounts({ competitionId }),
	])

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
							{
								label: "Events",
								href: `/compete/organizer/${competition.id}/events`,
							},
							{
								label: event.workout.name,
								href: `/compete/organizer/${competition.id}/events/${eventId}`,
							},
							{ label: "Enter Results" },
						]}
					/>
					<div className="flex items-center gap-4 mt-2">
						<Button variant="ghost" size="sm" asChild>
							<Link
								href={`/compete/organizer/${competition.id}/events/${eventId}`}
							>
								<ChevronLeft className="h-4 w-4 mr-1" />
								Back to Event
							</Link>
						</Button>
					</div>
					<h1 className="text-3xl font-bold mt-4">Enter Results</h1>
					<p className="text-muted-foreground mt-1">
						Event #{event.trackOrder} - {event.workout.name}
					</p>
				</div>

				<ResultsEntryForm
					competitionId={competition.id}
					organizingTeamId={competition.organizingTeamId}
					event={scoreEntryData.event}
					athletes={scoreEntryData.athletes}
					divisions={divisions}
					selectedDivisionId={selectedDivisionId}
				/>
			</div>
		</div>
	)
}
