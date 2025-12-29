/**
 * Competition Edit Route
 *
 * Organizer page for editing competition details.
 * Fetches competition groups and renders the edit form.
 * Uses parent route loader data for competition data.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"
import { getCompetitionGroupsFn } from "@/server-fns/competition-fns"
import { OrganizerCompetitionEditForm } from "./-components/organizer-competition-edit-form"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute("/compete/organizer/$competitionId/edit")({
	component: EditCompetitionPage,
	loader: async ({ params }) => {
		// First get competition to know the teamId
		const { competition } = await getCompetitionByIdFn({
			data: { competitionId: params.competitionId },
		})

		if (!competition) {
			throw new Error("Competition not found")
		}

		// Fetch competition groups for the organizing team
		const { groups } = await getCompetitionGroupsFn({
			data: { teamId: competition.organizingTeamId },
		})

		return {
			groups,
		}
	},
	head: () => {
		return {
			meta: [
				{ title: "Edit Competition" },
				{
					name: "description",
					content: "Edit competition details",
				},
			],
		}
	},
})

function EditCompetitionPage() {
	const { groups } = Route.useLoaderData()
	// Get competition from parent layout loader data
	const { competition } = parentRoute.useLoaderData()

	return (
		<div className="max-w-2xl">
			<div className="mb-8">
				<h1 className="text-3xl font-bold">Edit Competition</h1>
				<p className="text-muted-foreground mt-1">Update competition details</p>
			</div>

			<OrganizerCompetitionEditForm competition={competition} groups={groups} />
		</div>
	)
}
