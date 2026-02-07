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

export const Route = createFileRoute("/compete/$slug")({
	component: CompetitionDetailLayout,
	staleTime: 10_000, // Cache for 10 seconds (SWR behavior)
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
			maxSpots: undefined as number | undefined,
			organizerContactEmail,
		}
	},
})

function CompetitionDetailLayout() {
	const { competition, registrationCount, canManage, isVolunteer } =
		Route.useLoaderData()

	const hasBanner = !!competition.bannerImageUrl
	const profileImage =
		competition.profileImageUrl ?? competition.organizingTeam?.avatarUrl

	return (
		<div className="relative min-h-screen bg-background print:min-h-0 print:bg-white">
			{/* Full-bleed banner - absolutely positioned to extend behind the glass card */}
			{hasBanner && (
				<div className="absolute left-1/2 top-0 h-[22rem] w-screen -translate-x-1/2 md:h-[26rem] lg:h-[28rem] print:hidden">
					{/* Profile image on mobile for better portrait fit */}
					{profileImage && (
						<img
							src={profileImage}
							alt=""
							className="absolute inset-0 h-full w-full object-cover md:hidden"
						/>
					)}
					{/* Banner image on desktop (or all screens if no profile image) */}
					<img
						src={competition.bannerImageUrl!}
						alt=""
						className={`absolute inset-0 h-full w-full object-cover ${profileImage ? "hidden md:block" : ""}`}
					/>
					<div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/60 to-slate-900/40" />
				</div>
			)}

			{/* Hero Section - hidden on print */}
			<div className="relative print:hidden">
				<CompetitionHero
					competition={competition}
					registrationCount={registrationCount}
					canManage={canManage}
					isVolunteer={isVolunteer}
				/>
			</div>

			{/* Content Area */}
			<div className="relative container mx-auto px-0 pb-4 print:p-0 print:max-w-none">
				<Outlet />
			</div>
		</div>
	)
}
