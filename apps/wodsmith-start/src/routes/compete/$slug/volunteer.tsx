import { createFileRoute } from "@tanstack/react-router"
import { getCompetitionBySlugFn } from "@/server-fns/competition-fns"
import { VolunteerSignupForm } from "./-components/volunteer-signup-form"

export const Route = createFileRoute("/compete/$slug/volunteer")({
	loader: async ({ params }) => {
		const result = await getCompetitionBySlugFn({
			data: { slug: params.slug },
		})

		if (!result.competition) {
			throw new Error("Competition not found")
		}

		return { competition: result.competition }
	},
	component: VolunteerSignupPage,
	head: ({ loaderData }) => {
		const competition = loaderData?.competition
		if (!competition) {
			return {
				meta: [{ title: "Competition Not Found" }],
			}
		}
		return {
			meta: [
				{ title: `Volunteer for ${competition.name}` },
				{
					name: "description",
					content: `Sign up to volunteer at ${competition.name}`,
				},
			],
		}
	},
})

function VolunteerSignupPage() {
	const { competition } = Route.useLoaderData()

	// Check if competition has a team (required for volunteer signups)
	if (!competition.competitionTeamId) {
		return (
			<div className="mx-auto max-w-2xl">
				<div className="rounded-lg border border-destructive/20 bg-destructive/10 p-6">
					<h1 className="mb-2 text-2xl font-bold">
						Volunteer Sign-up Not Available
					</h1>
					<p>
						This competition is not accepting volunteer sign-ups at this time.
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="mx-auto max-w-2xl py-8">
			<VolunteerSignupForm
				competition={{
					id: competition.id,
					name: competition.name,
					slug: competition.slug,
				}}
				competitionTeamId={competition.competitionTeamId}
			/>
		</div>
	)
}
