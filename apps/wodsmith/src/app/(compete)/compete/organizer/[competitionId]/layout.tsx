import "server-only"
import { notFound } from "next/navigation"
import { ZSAError } from "@repo/zsa"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getCompetition } from "@/server/competitions"
import { requireTeamPermission } from "@/utils/team-auth"

interface CompetitionLayoutProps {
	children: React.ReactNode
	params: Promise<{
		competitionId: string
	}>
}

export default async function CompetitionLayout({
	children,
	params,
}: CompetitionLayoutProps) {
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

	return <>{children}</>
}
