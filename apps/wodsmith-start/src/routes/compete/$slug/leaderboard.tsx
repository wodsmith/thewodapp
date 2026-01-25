import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { z } from "zod"
import { CompetitionTabs } from "@/components/competition-tabs"
import { LeaderboardPageContent } from "@/components/leaderboard-page-content"
import { RegistrationSidebar } from "@/components/registration-sidebar"

const parentRoute = getRouteApi("/compete/$slug")

// Search params schema for division and event selection
const leaderboardSearchSchema = z.object({
	division: z.string().optional(),
	event: z.string().optional(),
})

export const Route = createFileRoute("/compete/$slug/leaderboard")({
	validateSearch: leaderboardSearchSchema,
	component: CompetitionLeaderboardPage,
})

function CompetitionLeaderboardPage() {
	const {
		competition,
		registrationCount,
		userRegistration,
		isVolunteer,
		registrationStatus,
		session,
		userDivision,
		maxSpots,
	} = parentRoute.useLoaderData()

	const isRegistered = !!userRegistration
	const isTeamRegistration = (userDivision?.teamSize ?? 1) > 1

	return (
		<div className="grid gap-6 lg:grid-cols-[1fr_320px]">
			<div className="space-y-4">
				<div className="sticky top-4 z-10">
					<CompetitionTabs slug={competition.slug} />
				</div>
				<div className="rounded-2xl border border-black/10 bg-black/5 p-6 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
					<LeaderboardPageContent competitionId={competition.id} />
				</div>
			</div>
			<aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
				<RegistrationSidebar
					competition={competition}
					isRegistered={isRegistered}
					registrationOpen={registrationStatus.registrationOpen}
					registrationCount={registrationCount}
					maxSpots={maxSpots}
					userDivision={userDivision?.label}
					registrationId={userRegistration?.id}
					isTeamRegistration={isTeamRegistration}
					isCaptain={userRegistration?.userId === session?.userId}
					isVolunteer={isVolunteer}
				/>
			</aside>
		</div>
	)
}
