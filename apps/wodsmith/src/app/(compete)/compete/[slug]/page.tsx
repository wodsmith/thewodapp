import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { PendingTeamInvites } from "@/components/compete/pending-team-invites"
import {
	getCompetition,
	getCompetitionRegistrations,
	getUserCompetitionRegistration,
} from "@/server/competitions"
import { getPublicCompetitionDivisions } from "@/server/competition-divisions"
import { getHeatsForCompetition } from "@/server/competition-heats"
import { getPublishedCompetitionWorkouts } from "@/server/competition-workouts"
import { getCompetitionSponsors } from "@/server/sponsors"
import { getPendingInvitationsForCurrentUser } from "@/server/team-members"
import { getSessionFromCookie } from "@/utils/auth"
import { canOrganizeForTeam } from "@/utils/get-user-organizing-teams"
import { CompetitionHero } from "./_components/competition-hero"
import { CompetitionTabs } from "./_components/competition-tabs"
import { CompetitionViewTracker } from "./_components/competition-view-tracker"
import { EventDetailsContent } from "./_components/event-details-content"
import { LeaderboardContent } from "./_components/leaderboard-content"
import { MobileRegistrationBar } from "./_components/mobile-registration-bar"
import { RegisterButton } from "./_components/register-button"
import { RegistrationSidebar } from "./_components/registration-sidebar"
import { ScheduleContent } from "./_components/schedule-content"
import { ScheduleSkeleton } from "./_components/schedule-skeleton"
import { WorkoutsContent } from "./_components/workouts-content"
import { WorkoutsSkeleton } from "./_components/workouts-skeleton"

type Props = {
	params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params
	const competition = await getCompetition(slug)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `${competition.name} - Compete`,
		description: competition.description || `Register for ${competition.name}`,
		openGraph: {
			type: "website",
			title: competition.name,
			description:
				competition.description || `Register for ${competition.name}`,
			images: [
				{
					url: `/api/og/competition?slug=${encodeURIComponent(slug)}`,
					width: 1200,
					height: 630,
					alt: competition.name,
				},
			],
		},
	}
}

export default async function CompetitionDetailPage({ params }: Props) {
	const { slug } = await params
	const competition = await getCompetition(slug)

	if (!competition) {
		notFound()
	}

	// Start heavy fetches immediately (don't await - pass promises to components)
	const eventsPromise = getPublishedCompetitionWorkouts(competition.id)
	const heatsPromise = getHeatsForCompetition(competition.id)

	// Parallel fetch: session, registrations, divisions, sponsors (needed for hero/sidebar/content)
	const [session, registrations, divisions, sponsorsResult] = await Promise.all(
		[
			getSessionFromCookie(),
			getCompetitionRegistrations(competition.id),
			getPublicCompetitionDivisions(competition.id),
			getCompetitionSponsors(competition.id),
		],
	)

	// Check if user is already registered, get pending invites, and check manage permission (depends on session)
	let userRegistration = null
	let pendingInvitations: Awaited<
		ReturnType<typeof getPendingInvitationsForCurrentUser>
	> = []
	let canManage = false
	if (session) {
		const [registration, invitations, canOrganize] = await Promise.all([
			getUserCompetitionRegistration(competition.id, session.userId),
			getPendingInvitationsForCurrentUser().catch(() => []),
			canOrganizeForTeam(competition.organizingTeamId),
		])
		userRegistration = registration
		pendingInvitations = invitations
		canManage = canOrganize
	}

	const registrationCount = registrations.length

	// Check registration status
	const now = new Date()
	const regOpensAt = competition.registrationOpensAt
		? typeof competition.registrationOpensAt === "number"
			? new Date(competition.registrationOpensAt)
			: competition.registrationOpensAt
		: null
	const regClosesAt = competition.registrationClosesAt
		? typeof competition.registrationClosesAt === "number"
			? new Date(competition.registrationClosesAt)
			: competition.registrationClosesAt
		: null

	const registrationOpen = !!(
		regOpensAt &&
		regClosesAt &&
		regOpensAt <= now &&
		regClosesAt >= now
	)
	const registrationClosed = !!(regClosesAt && regClosesAt < now)
	const registrationNotYetOpen = !!(regOpensAt && regOpensAt > now)

	// Calculate price range from divisions for mobile bar
	const priceRange =
		divisions.length > 0
			? {
					min: Math.min(...divisions.map((d) => d.feeCents)),
					max: Math.max(...divisions.map((d) => d.feeCents)),
				}
			: null

	return (
		<div className="min-h-screen bg-background pb-20 lg:pb-0">
			{/* PostHog page view tracking */}
			<CompetitionViewTracker
				competitionId={competition.id}
				competitionSlug={competition.slug}
				competitionName={competition.name}
				isRegistered={!!userRegistration}
				isOrganizer={canManage}
			/>

			{/* Hero Section */}
			<CompetitionHero
				competition={competition}
				registrationCount={registrationCount}
				canManage={canManage}
				registrationOpen={registrationOpen}
				registrationClosed={registrationClosed}
				registrationNotYetOpen={registrationNotYetOpen}
				registrationClosesAt={regClosesAt}
			/>

			{/* Tabbed Content */}
			<CompetitionTabs
				workoutsContent={
					<Suspense fallback={<WorkoutsSkeleton />}>
						<WorkoutsContent
							key="tab-workouts"
							competition={competition}
							divisions={divisions}
						/>
					</Suspense>
				}
				scheduleContent={
					<Suspense fallback={<ScheduleSkeleton />}>
						<ScheduleContent
							key="tab-schedule"
							eventsPromise={eventsPromise}
							heatsPromise={heatsPromise}
							currentUserId={session?.userId}
						/>
					</Suspense>
				}
				leaderboardContent={
					<LeaderboardContent
						key="tab-leaderboard"
						competitionId={competition.id}
						divisions={divisions}
					/>
				}
				registerButton={
					<RegisterButton
						slug={slug}
						isLoggedIn={!!session}
						isRegistered={!!userRegistration}
						registrationOpen={registrationOpen}
						registrationClosed={registrationClosed}
						registrationNotYetOpen={registrationNotYetOpen}
					/>
				}
			>
				{/* Event Details Tab Content */}
				<div className="container mx-auto px-4 py-8">
					<div className="grid gap-8 lg:grid-cols-[1fr_320px]">
						{/* Main Content */}
						<EventDetailsContent
							competition={competition}
							divisions={divisions.length > 0 ? divisions : undefined}
							sponsors={sponsorsResult}
						/>

						{/* Sidebar */}
						<aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
							<PendingTeamInvites
								invitations={pendingInvitations}
								competitionId={competition.id}
							/>
							<RegistrationSidebar
								competition={competition}
								isRegistered={!!userRegistration}
								registrationOpen={registrationOpen}
								registrationCount={registrationCount}
								userDivision={userRegistration?.division?.label}
								registrationId={userRegistration?.id}
								isTeamRegistration={
									(userRegistration?.division?.teamSize ?? 1) > 1
								}
								isCaptain={userRegistration?.userId === session?.userId}
								priceRange={priceRange}
								divisionCount={divisions.length}
							/>
						</aside>
					</div>
				</div>
			</CompetitionTabs>

			{/* Mobile sticky registration bar */}
			<MobileRegistrationBar
				slug={slug}
				isLoggedIn={!!session}
				isRegistered={!!userRegistration}
				registrationOpen={registrationOpen}
				registrationClosed={registrationClosed}
				registrationNotYetOpen={registrationNotYetOpen}
				registrationClosesAt={regClosesAt}
				priceRange={priceRange}
			/>
		</div>
	)
}
