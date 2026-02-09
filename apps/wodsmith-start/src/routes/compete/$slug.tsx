import { createFileRoute, notFound, Outlet } from "@tanstack/react-router"
import { CompetitionHero } from "@/components/competition-hero"
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
import { getTeamContactEmailFn } from "@/server-fns/team-fns"
import { getAppUrl } from "@/lib/env"

export const Route = createFileRoute("/compete/$slug")({
	component: CompetitionDetailLayout,
	staleTime: 10_000, // Cache for 10 seconds (SWR behavior)
	head: ({ loaderData }) => {
		const competition = loaderData?.competition

		if (!competition) {
			return { meta: [{ title: "Competition Not Found" }] }
		}

		const appUrl = loaderData?.appUrl || "https://wodsmith.com"
		const ogImageUrl = `${loaderData?.ogBaseUrl || "https://og.wodsmith.com"}/competition/${competition.slug}`
		const pageUrl = `${appUrl}/compete/${competition.slug}`
		const description =
			competition.description?.slice(0, 160) ||
			`Join ${competition.name} - a fitness competition on WODsmith`

		return {
			meta: [
				{ title: competition.name },
				{ name: "description", content: description },
				{ property: "og:type", content: "website" },
				{ property: "og:url", content: pageUrl },
				{ property: "og:title", content: competition.name },
				{ property: "og:description", content: description },
				{ property: "og:image", content: ogImageUrl },
				{ property: "og:image:width", content: "1200" },
				{ property: "og:image:height", content: "630" },
				{ property: "og:site_name", content: "WODsmith" },
				{ name: "twitter:card", content: "summary_large_image" },
				{ name: "twitter:title", content: competition.name },
				{ name: "twitter:description", content: description },
				{ name: "twitter:image", content: ogImageUrl },
			],
		}
	},
	loader: async ({ params, context }) => {
		const { slug } = params

		// Fetch competition by slug first (required to get competition.id)
		const { competition } = await getCompetitionBySlugFn({ data: { slug } })

		if (!competition) {
			throw notFound()
		}

		const session = context.session ?? null

		// Parallel fetch ALL data in a single batch
		// Public data: registration count, divisions, sponsors, registration status
		// User data (if logged in): user registration, can manage, is volunteer
		const [
			registrationCountResult,
			divisionsResult,
			sponsorsResult,
			registrationStatus,
			organizerContactEmail,
			userRegResult,
			canManageResult,
			isVolunteerResult,
		] = await Promise.all([
			// Public data - always fetched
			getCompetitionRegistrationCountFn({
				data: { competitionId: competition.id },
			}),
			getPublicCompetitionDivisionsFn({
				data: { competitionId: competition.id },
			}),
			getCompetitionSponsorsFn({
				data: { competitionId: competition.id },
			}),
			getRegistrationStatusFn({
				data: {
					registrationOpensAt: competition.registrationOpensAt,
					registrationClosesAt: competition.registrationClosesAt,
					timezone: competition.timezone,
				},
			}),
			getTeamContactEmailFn({
				data: { teamId: competition.organizingTeamId },
			}),
			// User-specific data - returns null/false if no session
			session
				? getUserCompetitionRegistrationFn({
					data: {
						competitionId: competition.id,
						userId: session.userId,
					},
				})
				: Promise.resolve({ registration: null }),
			session
				? checkCanManageCompetitionFn({
					data: {
						organizingTeamId: competition.organizingTeamId,
						userId: session.userId,
					},
				})
				: Promise.resolve({ canManage: false }),
			session
				? checkIsVolunteerFn({
					data: {
						competitionTeamId: competition.competitionTeamId,
						userId: session.userId,
					},
				})
				: Promise.resolve({ isVolunteer: false }),
		])

		const registrationCount = registrationCountResult.count
		const divisions = divisionsResult.divisions
		const sponsors = sponsorsResult
		const userRegistration = userRegResult.registration
		const canManage = canManageResult.canManage
		const isVolunteer = isVolunteerResult.isVolunteer

		// Calculate userDivision from divisions data
		const userDivision = userRegistration?.divisionId
			? divisions.find((d) => d.id === userRegistration.divisionId)
			: null

		const appUrl = getAppUrl()
		const ogBaseUrl = appUrl.includes("localhost")
			? "http://localhost:8787"
			: "https://og.wodsmith.com"

		return {
			appUrl,
			ogBaseUrl,
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
			maxSpots: undefined as number | undefined,
			organizerContactEmail,
		}
	},
})

function CompetitionDetailLayout() {
	const { competition, registrationCount, canManage } = Route.useLoaderData()

	return (
		<div className="min-h-screen bg-background">
			{/* Hero Section */}
			<CompetitionHero
				competition={competition}
				registrationCount={registrationCount}
				canManage={canManage}
			/>

			{/* Content Area */}
			<div className="px-0 pb-4">
				<Outlet />
			</div>
		</div>
	)
}
