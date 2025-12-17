import "server-only"

import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getDb } from "@/db"
import { getCompetition } from "@/server/competitions"
import { canInputScores, getCompetitionVolunteers } from "@/server/volunteers"

import { VolunteersList } from "./_components/volunteers-list"

interface CompetitionVolunteersPageProps {
	params: Promise<{
		competitionId: string
	}>
}

export async function generateMetadata({
	params,
}: CompetitionVolunteersPageProps): Promise<Metadata> {
	const { competitionId } = await params
	const competition = await getCompetition(competitionId)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `${competition.name} - Volunteers`,
		description: `Manage volunteers for ${competition.name}`,
	}
}

export default async function CompetitionVolunteersPage({
	params,
}: CompetitionVolunteersPageProps) {
	const { competitionId } = await params

	// Get competition (layout already validated access)
	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	const db = getDb()

	// Get all volunteers for this competition team
	const volunteers = await getCompetitionVolunteers(
		db,
		competition.competitionTeamId,
	)

	// For each volunteer, check if they have score access
	const volunteersWithAccess = await Promise.all(
		volunteers.map(async (volunteer) => {
			const hasScoreAccess = volunteer.user
				? await canInputScores(
						db,
						volunteer.user.id,
						competition.competitionTeamId,
					)
				: false

			return {
				...volunteer,
				hasScoreAccess,
			}
		}),
	)

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h2 className="text-xl font-semibold">Volunteers</h2>
				<p className="text-muted-foreground text-sm">
					{volunteersWithAccess.length} volunteer
					{volunteersWithAccess.length !== 1 ? "s" : ""}
				</p>
			</div>

			<VolunteersList
				competitionId={competition.id}
				competitionSlug={competition.slug}
				competitionTeamId={competition.competitionTeamId}
				organizingTeamId={competition.organizingTeamId}
				volunteers={volunteersWithAccess}
			/>
		</div>
	)
}
