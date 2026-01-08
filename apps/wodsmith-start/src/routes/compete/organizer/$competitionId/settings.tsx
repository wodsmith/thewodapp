import { createFileRoute } from "@tanstack/react-router"
import { getCompetitionByIdFn } from "@/server-fns/competition-detail-fns"
import { RotationSettingsForm } from "./-components/rotation-settings-form"
import { ScoringSettingsForm } from "./-components/scoring-settings-form"

export const Route = createFileRoute(
	"/compete/organizer/$competitionId/settings",
)({
	loader: async ({ params }) => {
		const result = await getCompetitionByIdFn({
			data: { competitionId: params.competitionId },
		})

		if (!result.competition) {
			throw new Error("Competition not found")
		}

		return { competition: result.competition }
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
