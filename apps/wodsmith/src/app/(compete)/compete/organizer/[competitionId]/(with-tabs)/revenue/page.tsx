import "server-only"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCompetition } from "@/server/competitions"
import { getCompetitionRevenueStats } from "@/server/commerce"
import { RevenueStatsDisplay } from "./_components/revenue-stats-display"

interface RevenuePageProps {
	params: Promise<{
		competitionId: string
	}>
}

export async function generateMetadata({
	params,
}: RevenuePageProps): Promise<Metadata> {
	const { competitionId } = await params
	const competition = await getCompetition(competitionId)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `Revenue - ${competition.name}`,
		description: `Revenue statistics for ${competition.name}`,
	}
}

export default async function RevenuePage({ params }: RevenuePageProps) {
	const { competitionId } = await params

	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	const stats = await getCompetitionRevenueStats(competitionId)

	return <RevenueStatsDisplay stats={stats} />
}
