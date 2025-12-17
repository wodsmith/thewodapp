import "server-only"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PendingTeamInvites } from "@/components/compete/pending-team-invites"
import { getPublicCompetitionDivisions } from "@/server/competition-divisions"
import {
	getCompetition,
	getCompetitionRegistrations,
	getUserCompetitionRegistration,
} from "@/server/competitions"
import { getPendingInvitationsForCurrentUser } from "@/server/team-members"
import { getSessionFromCookie } from "@/utils/auth"
import { canOrganizeForTeam } from "@/utils/get-user-organizing-teams"
import { CompetitionHero } from "../_components/competition-hero"
import { CompetitionViewTracker } from "../_components/competition-view-tracker"
import { RegisterButton } from "../_components/register-button"
import { RegistrationSidebar } from "../_components/registration-sidebar"
import { CompetitionTabs } from "./_components/competition-tabs"

type Props = {
	params: Promise<{ slug: string }>
	children: React.ReactNode
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>
}): Promise<Metadata> {
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

export default async function CompetitionTabsLayout({
	params,
	children,
}: Props) {
	const { slug } = await params
	const competition = await getCompetition(slug)

	if (!competition) {
		notFound()
	}

	// Parallel fetch: session, registrations
	const [session, registrations] = await Promise.all([
		getSessionFromCookie(),
		getCompetitionRegistrations(competition.id),
	])

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

	return (
		<div className="min-h-screen bg-background">
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
			/>

			{/* Tabbed Navigation */}
			<CompetitionTabs
				slug={slug}
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
			/>

			{/* Content Area with Sidebar */}
			<div className="container mx-auto px-4 py-8">
				<div className="grid gap-8 lg:grid-cols-[1fr_320px]">
					{/* Main Content */}
					{children}

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
						/>
					</aside>
				</div>
			</div>
		</div>
	)
}
