import "server-only"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCompetitionDivisionsWithCounts } from "@/server/competition-divisions"
import { getCompetition, getCompetitionRegistrations } from "@/server/competitions"
import { OrganizerRegistrationList } from "./_components/organizer-registration-list"

interface CompetitionAthletesPageProps {
	params: Promise<{
		competitionId: string
	}>
	searchParams: Promise<{
		division?: string
	}>
}

export async function generateMetadata({
	params,
}: CompetitionAthletesPageProps): Promise<Metadata> {
	const { competitionId } = await params
	const competition = await getCompetition(competitionId)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `${competition.name} - Athletes`,
		description: `Manage athletes for ${competition.name}`,
	}
}

export default async function CompetitionAthletesPage({
	params,
	searchParams,
}: CompetitionAthletesPageProps) {
	const { competitionId } = await params
	const { division: divisionFilter } = await searchParams

	// Get competition (layout already validated access)
	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	// Parallel fetch: registrations and divisions for filtering
	const [registrations, { divisions }] = await Promise.all([
		getCompetitionRegistrations(competitionId, divisionFilter),
		getCompetitionDivisionsWithCounts({ competitionId }),
	])

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h2 className="text-xl font-semibold">Registered Athletes</h2>
				<p className="text-muted-foreground text-sm">
					{registrations.length} registration{registrations.length !== 1 ? "s" : ""}
				</p>
			</div>

			<OrganizerRegistrationList
				competitionId={competition.id}
				registrations={registrations}
				divisions={divisions}
				currentDivisionFilter={divisionFilter}
			/>
		</div>
	)
}
