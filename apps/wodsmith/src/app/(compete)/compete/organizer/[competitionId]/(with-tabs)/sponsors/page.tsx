import "server-only"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCompetition } from "@/server/competitions"
import { getCompetitionSponsors } from "@/server/sponsors"
import { SponsorManager } from "./_components/sponsor-manager"

interface CompetitionSponsorsPageProps {
	params: Promise<{
		competitionId: string
	}>
}

export async function generateMetadata({
	params,
}: CompetitionSponsorsPageProps): Promise<Metadata> {
	const { competitionId } = await params
	const competition = await getCompetition(competitionId)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `${competition.name} - Sponsors`,
		description: `Manage sponsors for ${competition.name}`,
	}
}

export default async function CompetitionSponsorsPage({
	params,
}: CompetitionSponsorsPageProps) {
	const { competitionId } = await params

	// Get competition (layout already validated access)
	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	// Fetch sponsors with groups
	const { groups, ungroupedSponsors } =
		await getCompetitionSponsors(competitionId)

	return (
		<SponsorManager
			competitionId={competition.id}
			organizingTeamId={competition.organizingTeamId}
			groups={groups}
			ungroupedSponsors={ungroupedSponsors}
		/>
	)
}
