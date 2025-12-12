import { Suspense } from 'react'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { getCompetitionFn, getCompetitionRegistrationsFn, getCompetitionWorkoutsFn } from '~/server-functions/competitions'
import { getSessionFromCookie } from '~/utils/auth.server'
import { getCompetitionRevenueStatsFn } from '~/server-functions/commerce'
import { getHeatsForCompetitionFn } from '~/server-functions/competition-heats'
import { OrganizerBreadcrumb } from '~/components/compete/organizer/organizer-breadcrumb'
import { CompetitionHeader } from '~/components/compete/organizer/competition-header'
import { CompetitionTabs } from '~/components/compete/organizer/competition-tabs'
import { OrganizerDashboardContent } from '~/components/compete/organizer/organizer-dashboard-content'
import { OrganizerDashboardSkeleton } from '~/components/compete/organizer/organizer-dashboard-skeleton'

export const Route = createFileRoute('/_compete/compete/organizer/$competitionId/')({
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

		// Parallel fetch: registrations, revenue stats, workouts, and heats
		const [registrationsResult, revenueResult, workoutsResult, heatsResult] = await Promise.all([
			getCompetitionRegistrationsFn({ data: { competitionId: competition.id } }),
			getCompetitionRevenueStatsFn({ data: { competitionId: competition.id } }),
			getCompetitionWorkoutsFn({ data: { competitionId: competition.id } }),
			getHeatsForCompetitionFn({ data: { competitionId: competition.id } }),
		])

		return {
			competition,
			registrations: registrationsResult.success ? registrationsResult.data : [],
			revenueStats: revenueResult.success ? revenueResult.data : null,
			workouts: workoutsResult.success ? workoutsResult.data : [],
			heats: heatsResult.success ? heatsResult.data : [],
		}
	},
	component: OrganizerCompetitionComponent,
})

function OrganizerCompetitionComponent() {
	const { competition, registrations, revenueStats, workouts, heats } = Route.useLoaderData()

	const breadcrumbSegments = competition.groupId
		? [
				{ label: 'Series', href: '/compete/organizer/series' },
				{ label: 'View Series', href: `/compete/organizer/series/${competition.groupId}` },
				{ label: competition.name },
			]
		: [{ label: competition.name }]

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				{/* Breadcrumb */}
				<OrganizerBreadcrumb segments={breadcrumbSegments} />

				{/* Competition Header */}
				<CompetitionHeader
					competition={{
						id: competition.id,
						name: competition.name,
						slug: competition.slug,
						description: competition.description,
						startDate: competition.startDate,
						endDate: competition.endDate,
						registrationOpensAt: competition.registrationOpensAt,
						registrationClosesAt: competition.registrationClosesAt,
						visibility: competition.visibility,
					}}
				/>

				{/* Navigation Tabs */}
				<CompetitionTabs competitionId={competition.id} />

				{/* Page Content */}
				<Suspense fallback={<OrganizerDashboardSkeleton />}>
					<OrganizerDashboardContent
						competition={competition}
						registrations={registrations}
						revenueStats={revenueStats}
						workouts={workouts}
						heats={heats}
					/>
				</Suspense>
			</div>
		</div>
	)
}
