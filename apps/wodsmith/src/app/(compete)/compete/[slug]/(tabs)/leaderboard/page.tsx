import "server-only"
import { notFound } from "next/navigation"
import { getCompetition } from "@/server/competitions"
import { getPublicCompetitionDivisions } from "@/server/competition-divisions"
import { LeaderboardPageContent } from "./_components/leaderboard-page-content"

type Props = {
	params: Promise<{ slug: string }>
}

export default async function CompetitionLeaderboardPage({ params }: Props) {
	const { slug } = await params
	const competition = await getCompetition(slug)

	if (!competition) {
		notFound()
	}

	const divisions = await getPublicCompetitionDivisions(competition.id)

	return (
		<LeaderboardPageContent
			competitionId={competition.id}
			divisions={divisions}
		/>
	)
}
