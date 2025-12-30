/**
 * Competition Waivers Route
 * Port from apps/wodsmith/src/app/(compete)/compete/organizer/[competitionId]/(with-sidebar)/waivers/page.tsx
 *
 * Allows organizers to manage waivers for their competition - create, edit, delete, reorder.
 * Uses the existing waiver-fns.ts server functions.
 */

import { createFileRoute } from "@tanstack/react-router"
import { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"
import { getCompetitionWaiversFn } from "@/server-fns/waiver-fns"

import { WaiverList } from "./-components/waiver-list"

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/waivers",
)({
	loader: async ({ params }) => {
		// 1. Get competition details
		const result = await getCompetitionByIdFn({
			data: { competitionId: params.competitionId },
		})

		if (!result.competition) {
			throw new Error("Competition not found")
		}

		const competition = result.competition

		// 2. Get waivers for this competition
		const { waivers } = await getCompetitionWaiversFn({
			data: { competitionId: params.competitionId },
		})

		return {
			competition: {
				id: competition.id,
				name: competition.name,
				organizingTeamId: competition.organizingTeamId,
			},
			waivers,
		}
	},
	component: WaiversPage,
})

function WaiversPage() {
	const { competition, waivers } = Route.useLoaderData()

	return (
		<WaiverList
			competitionId={competition.id}
			teamId={competition.organizingTeamId}
			waivers={waivers}
		/>
	)
}
