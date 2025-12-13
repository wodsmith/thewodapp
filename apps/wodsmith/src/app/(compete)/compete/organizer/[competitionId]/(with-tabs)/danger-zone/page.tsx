import "server-only"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import {
	getCompetition,
	getCompetitionRegistrations,
} from "@/server/competitions"
import { DeleteCompetitionForm } from "./_components/delete-competition-form"

interface DangerZonePageProps {
	params: Promise<{
		competitionId: string
	}>
}

export async function generateMetadata({
	params,
}: DangerZonePageProps): Promise<Metadata> {
	const { competitionId } = await params
	const competition = await getCompetition(competitionId)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `Danger Zone - ${competition.name}`,
		description: `Dangerous actions for ${competition.name}`,
	}
}

export default async function DangerZonePage({ params }: DangerZonePageProps) {
	const { competitionId } = await params

	// Get competition (layout already validated access)
	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	// Get registration count for warning
	const registrations = await getCompetitionRegistrations(competitionId)

	return (
		<div className="max-w-2xl">
			<div className="mb-6">
				<h2 className="text-xl font-semibold text-destructive">Danger Zone</h2>
				<p className="text-muted-foreground mt-1">
					Irreversible actions that affect this competition
				</p>
			</div>

			<DeleteCompetitionForm
				competitionId={competition.id}
				competitionName={competition.name}
				organizingTeamId={competition.organizingTeamId}
				registrationCount={registrations.length}
			/>
		</div>
	)
}
