import "server-only"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCompetitionDivisionsWithCounts } from "@/server/competition-divisions"
import { getCompetition } from "@/server/competitions"
import { listScalingGroups } from "@/server/scaling-groups"
import { OrganizerDivisionManager } from "./_components/organizer-division-manager"

interface CompetitionDivisionsPageProps {
	params: Promise<{
		competitionId: string
	}>
}

export async function generateMetadata({
	params,
}: CompetitionDivisionsPageProps): Promise<Metadata> {
	const { competitionId } = await params
	const competition = await getCompetition(competitionId)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `${competition.name} - Divisions`,
		description: `Manage divisions for ${competition.name}`,
	}
}

export default async function CompetitionDivisionsPage({
	params,
}: CompetitionDivisionsPageProps) {
	const { competitionId } = await params

	// Get competition (layout already validated access)
	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	// Parallel fetch: divisions with counts and available scaling groups
	const [{ scalingGroupId, divisions }, scalingGroups] = await Promise.all([
		getCompetitionDivisionsWithCounts({ competitionId }),
		listScalingGroups({ teamId: competition.organizingTeamId, includeSystem: true }),
	])

	return (
		<OrganizerDivisionManager
			key={scalingGroupId ?? "no-divisions"}
			teamId={competition.organizingTeamId}
			competitionId={competition.id}
			divisions={divisions}
			scalingGroupId={scalingGroupId}
			scalingGroups={scalingGroups}
		/>
	)
}
