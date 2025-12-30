import "server-only"
import { ZSAError } from "@repo/zsa"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { getCompetition } from "@/server/competitions"
import { requireTeamPermission } from "@/utils/team-auth"
import { HeatScheduleSkeleton } from "./_components/heat-schedule-skeleton"
import { ScheduleContainer } from "./_components/schedule-container"
import { VenueManagerSkeleton } from "./_components/venue-manager-skeleton"

interface CompetitionSchedulePageProps {
	params: Promise<{
		competitionId: string
	}>
}

export async function generateMetadata({
	params,
}: CompetitionSchedulePageProps): Promise<Metadata> {
	const { competitionId } = await params
	const competition = await getCompetition(competitionId)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `${competition.name} - Schedule`,
		description: `Manage heat schedule for ${competition.name}`,
	}
}

export default async function CompetitionSchedulePage({
	params,
}: CompetitionSchedulePageProps) {
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

	return (
		<Suspense
			fallback={
				<div className="space-y-8">
					<section>
						<h2 className="text-lg font-semibold mb-4">Venues</h2>
						<VenueManagerSkeleton />
					</section>
					<section>
						<h2 className="text-lg font-semibold mb-4">Heat Schedule</h2>
						<HeatScheduleSkeleton />
					</section>
				</div>
			}
		>
			<ScheduleContainer
				competitionId={competition.id}
				organizingTeamId={competition.organizingTeamId}
				competitionStartDate={competition.startDate}
			/>
		</Suspense>
	)
}
