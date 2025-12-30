import "server-only"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCompetition } from "@/server/competitions"
import { RotationSettingsForm } from "./_components/rotation-settings-form"

interface SettingsPageProps {
	params: Promise<{
		competitionId: string
	}>
}

export async function generateMetadata({
	params,
}: SettingsPageProps): Promise<Metadata> {
	const { competitionId } = await params
	const competition = await getCompetition(competitionId)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `Settings - ${competition.name}`,
		description: `Configure settings for ${competition.name}`,
	}
}

export default async function SettingsPage({ params }: SettingsPageProps) {
	const { competitionId } = await params

	// Get competition (layout already validated access)
	const competition = await getCompetition(competitionId)

	if (!competition) {
		notFound()
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">
					Competition Settings
				</h1>
				<p className="text-muted-foreground mt-1">
					Configure default settings for your competition
				</p>
			</div>

			<RotationSettingsForm
				competition={{
					id: competition.id,
					name: competition.name,
					defaultHeatsPerRotation: competition.defaultHeatsPerRotation ?? 4,
					defaultLaneShiftPattern:
						competition.defaultLaneShiftPattern ?? "stay",
				}}
			/>
		</div>
	)
}
