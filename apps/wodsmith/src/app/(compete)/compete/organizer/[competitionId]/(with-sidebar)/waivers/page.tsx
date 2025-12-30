import "server-only"
import { ZSAError } from "@repo/zsa"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getCompetition } from "@/server/competitions"
import { getCompetitionWaivers } from "@/server/waivers"
import { requireTeamPermission } from "@/utils/team-auth"
import { WaiverList } from "./_components/waiver-list"

interface CompetitionWaiversPageProps {
	params: Promise<{
		competitionId: string
	}>
}

export async function generateMetadata({
	params,
}: CompetitionWaiversPageProps): Promise<Metadata> {
	const { competitionId } = await params
	const competition = await getCompetition(competitionId)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `${competition.name} - Waivers`,
		description: `Manage waivers for ${competition.name}`,
	}
}

export default async function CompetitionWaiversPage({
	params,
}: CompetitionWaiversPageProps) {
	const { competitionId } = await params

	// Get competition
	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	// Check if user has permission on the organizing team
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

	// Fetch waivers
	const waivers = await getCompetitionWaivers(competitionId)

	return (
		<WaiverList
			competitionId={competition.id}
			teamId={competition.organizingTeamId}
			waivers={waivers}
		/>
	)
}
