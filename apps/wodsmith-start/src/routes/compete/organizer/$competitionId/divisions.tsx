/**
 * Competition Divisions Route
 *
 * Organizer page for managing competition divisions.
 * Fetches divisions with counts and scaling groups in parallel.
 * Uses parent route loader data for competition data.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { OrganizerDivisionManager } from "@/components/divisions/organizer-division-manager"
import {
	getCompetitionDivisionsWithCountsFn,
	listScalingGroupsFn,
} from "@/server-fns/competition-divisions-fns"
import { getCompetitionGroupByIdFn } from "@/server-fns/competition-fns"
import { CapacitySettingsForm } from "./-components/capacity-settings-form"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/divisions",
)({
	staleTime: 10_000,
	component: DivisionsPage,
	loader: async ({ params, parentMatchPromise }) => {
		const parentMatch = await parentMatchPromise
		const { competition } = parentMatch.loaderData!

		// Parallel fetch divisions, scaling groups, and series info
		const [divisionsResult, scalingGroupsResult, seriesResult] =
			await Promise.all([
				getCompetitionDivisionsWithCountsFn({
					data: {
						competitionId: params.competitionId,
						teamId: competition.organizingTeamId,
					},
				}),
				listScalingGroupsFn({
					data: {
						teamId: competition.organizingTeamId,
					},
				}),
				// Fetch series scaling group ID if competition is in a series
				competition.groupId
					? getCompetitionGroupByIdFn({
							data: { groupId: competition.groupId },
						})
					: Promise.resolve(null),
			])

		return {
			divisions: divisionsResult.divisions,
			scalingGroupId: divisionsResult.scalingGroupId,
			scalingGroups: scalingGroupsResult.groups,
			defaultMaxSpotsPerDivision:
				divisionsResult.defaultMaxSpotsPerDivision ?? null,
			seriesScalingGroupId: seriesResult?.group?.scalingGroupId ?? null,
		}
	},
})

function DivisionsPage() {
	const {
		divisions,
		scalingGroupId,
		scalingGroups,
		defaultMaxSpotsPerDivision,
		seriesScalingGroupId,
	} = Route.useLoaderData()
	// Get competition from parent layout loader data
	const { competition } = parentRoute.useLoaderData()

	// Only show capacity settings if divisions are already configured
	const hasDivisions = scalingGroupId && divisions.length > 0

	return (
		<div className="space-y-6">
			{hasDivisions && (
				<CapacitySettingsForm
					competition={{
						id: competition.id,
						organizingTeamId: competition.organizingTeamId,
						defaultMaxSpotsPerDivision,
					}}
				/>
			)}

			<OrganizerDivisionManager
				key={scalingGroupId ?? "no-divisions"}
				teamId={competition.organizingTeamId}
				competitionId={competition.id}
				divisions={divisions}
				scalingGroupId={scalingGroupId}
				scalingGroups={scalingGroups}
				defaultMaxSpotsPerDivision={defaultMaxSpotsPerDivision}
				seriesScalingGroupId={seriesScalingGroupId}
			/>
		</div>
	)
}
