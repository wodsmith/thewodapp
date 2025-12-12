import { createFileRoute, notFound } from '@tanstack/react-router'
import { getCompetitionFn } from '~/server-functions/competitions'
import { OrganizerSettingsManager } from '~/components/compete/organizer/organizer-settings-manager'
import { getSessionFromCookie } from '~/utils/auth'

export const Route = createFileRoute('/_compete/compete/organizer/$competitionId/settings')({
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

		return {
			competition: compResult.data,
		}
	},
	component: OrganizerSettingsComponent,
})

function OrganizerSettingsComponent() {
	const { competition } = Route.useLoaderData()

	return (
		<OrganizerSettingsManager
			competition={competition}
		/>
	)
}
