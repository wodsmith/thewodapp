import { createFileRoute, notFound, Outlet } from "@tanstack/react-router"
import { CompetitionHero } from "@/components/competition-hero"
import { CompetitionTabs } from "@/components/competition-tabs"
import {
	checkCanManageCompetitionFn,
	checkIsVolunteerFn,
	getCompetitionRegistrationCountFn,
	getRegistrationStatusFn,
	getUserCompetitionRegistrationFn,
} from "@/server-fns/competition-detail-fns"
import { getPublicCompetitionDivisionsFn } from "@/server-fns/competition-divisions-fns"
import { getCompetitionBySlugFn } from "@/server-fns/competition-fns"
import { getCompetitionSponsorsFn } from "@/server-fns/sponsor-fns"

export const Route = createFileRoute("/compete/$slug")({
	component: CompetitionDetailLayout,
	loader: async ({ params, context }) => {
		const { slug } = params

		// Fetch competition by slug
		const { competition } = await getCompetitionBySlugFn({ data: { slug } })

		if (!competition) {
			throw notFound()
		}

		// Parallel fetch: registration count and session data
		const session = context.session ?? null

		// Parallel fetch: registration count, divisions, sponsors (always needed)
		const [registrationCountResult, divisionsResult, sponsorsResult] =
			await Promise.all([
				getCompetitionRegistrationCountFn({
					data: { competitionId: competition.id },
				}),
				getPublicCompetitionDivisionsFn({
					data: { competitionId: competition.id },
				}),
				getCompetitionSponsorsFn({
					data: { competitionId: competition.id },
				}),
			])

		const registrationCount = registrationCountResult.count
		const divisions = divisionsResult.divisions
		const sponsors = sponsorsResult

		// If user is logged in, fetch user-specific data
		let userRegistration = null
		let canManage = false
		let isVolunteer = false
		let registrationStatus = {
			registrationOpen: false,
			registrationClosed: false,
			registrationNotYetOpen: false,
		}

		if (session) {
			const [userRegResult, canManageResult, isVolunteerResult] =
				await Promise.all([
					getUserCompetitionRegistrationFn({
						data: {
							competitionId: competition.id,
							userId: session.userId,
						},
					}),
					checkCanManageCompetitionFn({
						data: {
							organizingTeamId: competition.organizingTeamId,
							userId: session.userId,
						},
					}),
					checkIsVolunteerFn({
						data: {
							competitionTeamId: competition.competitionTeamId,
							userId: session.userId,
						},
					}),
				])

			userRegistration = userRegResult.registration
			canManage = canManageResult.canManage
			isVolunteer = isVolunteerResult.isVolunteer
		}

		// Get registration status
		registrationStatus = await getRegistrationStatusFn({
			data: {
				registrationOpensAt: competition.registrationOpensAt,
				registrationClosesAt: competition.registrationClosesAt,
			},
		})

		// Calculate userDivision and isTeamRegistration from divisions data
		const userDivision = userRegistration?.divisionId
			? divisions.find((d) => d.id === userRegistration.divisionId)
			: null

		// Calculate maxSpots from divisions (sum of all division capacities if applicable)
		// For now, we don't have maxSpots per division in the schema, so leave undefined
		const maxSpots: number | undefined = undefined

		return {
			competition,
			registrationCount,
			userRegistration,
			canManage,
			isVolunteer,
			registrationStatus,
			session,
			divisions,
			sponsors,
			userDivision,
			maxSpots,
		}
	},
})

function CompetitionDetailLayout() {
	const {
		competition,
		registrationCount,
		userRegistration,
		canManage,
		registrationStatus,
	} = Route.useLoaderData()
	const { slug } = Route.useParams()

	return (
		<div className="min-h-screen bg-background">
			{/* Hero Section */}
			<CompetitionHero
				competition={competition}
				registrationCount={registrationCount}
				canManage={canManage}
			/>

			{/* Tabbed Navigation */}
			<CompetitionTabs
				slug={slug}
				isRegistered={!!userRegistration}
				registrationOpen={registrationStatus.registrationOpen}
				registrationClosed={registrationStatus.registrationClosed}
				registrationNotYetOpen={registrationStatus.registrationNotYetOpen}
			/>

			{/* Content Area */}
			<div className="container mx-auto px-4 py-8">
				<Outlet />
			</div>
		</div>
	)
}
