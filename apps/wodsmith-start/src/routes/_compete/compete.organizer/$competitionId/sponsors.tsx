import { createFileRoute, notFound } from '@tanstack/react-router'
import { getCompetitionFn } from '~/server-functions/competitions'
import { getCompetitionSponsorsFn } from '~/server-functions/sponsors'
import { OrganizerSponsorsManager } from '~/components/compete/organizer/organizer-sponsors-manager'
import { getSessionFromCookie } from '~/utils/auth'

export const Route = createFileRoute('/_compete/compete/organizer/$competitionId/sponsors')({
	beforeLoad: async () => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error('Unauthorized')
		}
	},
	loader: async ({ params }) => {
		const compResult = await getCompetitionFn({
			data: { idOrSlug: params.competitionId },
		})

		if (!compResult.success || !compResult.data) {
			throw notFound()
		}

		const competition = compResult.data

		// Fetch sponsors for the competition
		const sponsorsResult = await getCompetitionSponsorsFn({
			data: { competitionId: competition.id },
		})

		return {
			competition,
			sponsors: sponsorsResult.success ? sponsorsResult.data : [],
		}
	},
	component: OrganizerSponsorsComponent,
})

function OrganizerSponsorsComponent() {
	const { competition, sponsors } = Route.useLoaderData()

	return (
		<OrganizerSponsorsManager
			competitionId={competition.id}
			sponsors={sponsors}
		/>
	)
}
