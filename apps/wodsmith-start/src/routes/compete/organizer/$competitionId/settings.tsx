import { createFileRoute } from "@tanstack/react-router"
import { CapacitySettingsForm } from "./-components/capacity-settings-form"
import { RotationSettingsForm } from "./-components/rotation-settings-form"
import { ScoringSettingsForm } from "./-components/scoring-settings-form"

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/settings",
)({
	staleTime: 10_000,
	loader: async ({ parentMatchPromise }) => {
		const parentMatch = await parentMatchPromise
		const { competition } = parentMatch.loaderData!

		return { competition }
	},
	component: SettingsPage,
	head: ({ loaderData }) => {
		const competition = loaderData?.competition
		if (!competition) {
			return {
				meta: [{ title: "Competition Not Found" }],
			}
		}
		return {
			meta: [
				{ title: `Settings - ${competition.name}` },
				{
					name: "description",
					content: `Configure settings for ${competition.name}`,
				},
			],
		}
	},
})

function SettingsPage() {
	const { competition } = Route.useLoaderData()

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">
					Competition Settings
				</h1>
				<p className="text-muted-foreground mt-1">
					Configure default settings for your competition
				</p>
			</div>

			{/* Capacity Settings Section */}
			<section>
				<CapacitySettingsForm
					competition={{
						id: competition.id,
						organizingTeamId: competition.organizingTeamId,
						defaultMaxSpotsPerDivision: competition.defaultMaxSpotsPerDivision,
					}}
				/>
			</section>

			{/* Scoring Configuration Section */}
			<section>
				<ScoringSettingsForm
					competition={{
						id: competition.id,
						name: competition.name,
						settings: competition.settings,
					}}
				/>
			</section>

			{/* Rotation Settings Section */}
			<section>
				<RotationSettingsForm
					competition={{
						id: competition.id,
						name: competition.name,
						defaultHeatsPerRotation: competition.defaultHeatsPerRotation ?? 4,
						defaultLaneShiftPattern:
							competition.defaultLaneShiftPattern ?? "stay",
					}}
				/>
			</section>
		</div>
	)
}
