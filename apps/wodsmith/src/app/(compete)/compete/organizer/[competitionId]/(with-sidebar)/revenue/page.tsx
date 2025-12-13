import "server-only"
import { eq } from "drizzle-orm"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getDb } from "@/db"
import { teamTable } from "@/db/schema"
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
	const db = getDb()

	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	// Get organizing team's Stripe connection status
	const organizingTeam = await db.query.teamTable.findFirst({
		where: eq(teamTable.id, competition.organizingTeamId),
		columns: {
			slug: true,
			stripeAccountStatus: true,
		},
	})

	const stats = await getCompetitionRevenueStats(competitionId)

	// Only pass stripeStatus if we have a valid team with slug
	const stripeStatus =
		organizingTeam?.slug
			? {
					isConnected: organizingTeam.stripeAccountStatus === "VERIFIED",
					teamSlug: organizingTeam.slug,
				}
			: undefined

	return <RevenueStatsDisplay stats={stats} stripeStatus={stripeStatus} />
}
