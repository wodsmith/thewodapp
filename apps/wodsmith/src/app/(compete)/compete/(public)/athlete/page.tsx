import { eq, inArray } from "drizzle-orm"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { PendingTeamInvites } from "@/components/compete/pending-team-invites"
import { VolunteerStatus } from "@/components/compete/volunteer-status"
import { Separator } from "@/components/ui/separator"
import { getDb } from "@/db"
import { competitionsTable, userTable } from "@/db/schema"
import type {
	VolunteerMembershipMetadata,
	VolunteerRoleType,
} from "@/db/schemas/volunteers"
import { getUserCompetitionHistory } from "@/server/competitions"
import { getUserSponsors } from "@/server/sponsors"
import { getPendingInvitationsForCurrentUser } from "@/server/team-members"
import { getUserGymAffiliation } from "@/server/user"
import {
	getPendingVolunteerInvitationsForEmail,
	getUserVolunteerMemberships,
} from "@/server/volunteers"
import { calculateAge, parseAthleteProfile } from "@/utils/athlete-profile"
import { getSessionFromCookie } from "@/utils/auth"
import { autochunk } from "@/utils/batch-query"
import { AthleteHeader } from "./_components/athlete-header"
import { AthleteStats } from "./_components/athlete-stats"
import { BenchmarkStats } from "./_components/benchmark-stats"
import { CompetitiveHistory } from "./_components/competitive-history"
import { SponsorsSocial } from "./_components/sponsors-social"

export const metadata: Metadata = {
	title: "Athlete Profile | WODsmith",
	description: "View and manage your athlete profile",
	openGraph: {
		title: "Athlete Profile",
		description: "View and manage your athlete profile on WODsmith",
		images: [
			{
				url: `/api/og?title=${encodeURIComponent("Athlete Profile")}&description=${encodeURIComponent("View and manage your athlete profile")}`,
				width: 1200,
				height: 630,
				alt: "Athlete Profile",
			},
		],
	},
}

export default async function AthletePage() {
	// Require authentication
	const session = await getSessionFromCookie()
	if (!session) {
		redirect("/sign-in?redirect=/compete/athlete")
	}

	// Fetch user profile data
	const db = getDb()
	const user = await db.query.userTable.findFirst({
		where: eq(userTable.id, session.userId),
		columns: {
			id: true,
			email: true,
			firstName: true,
			lastName: true,
			avatar: true,
			gender: true,
			dateOfBirth: true,
			athleteProfile: true,
		},
	})

	if (!user) {
		redirect("/sign-in?redirect=/compete/athlete")
	}

	// Parse athlete profile JSON
	const athleteProfile = parseAthleteProfile(user.athleteProfile)

	// Get gym affiliation, competition history, sponsors, pending invitations, and volunteer data in parallel
	const [
		gym,
		competitionHistory,
		sponsors,
		pendingInvitations,
		pendingVolunteerInvitations,
		volunteerMemberships,
	] = await Promise.all([
		getUserGymAffiliation(session.userId),
		getUserCompetitionHistory(session.userId),
		getUserSponsors(session.userId),
		getPendingInvitationsForCurrentUser().catch(() => []),
		user.email
			? getPendingVolunteerInvitationsForEmail(db, user.email).catch(() => [])
			: Promise.resolve([]),
		getUserVolunteerMemberships(db, session.userId).catch(() => []),
	])

	// Get competitions for volunteer invitations
	const pendingVolunteerInvitationsWithCompetitions = await (async () => {
		if (pendingVolunteerInvitations.length === 0) return []

		const teamIds = pendingVolunteerInvitations.map((inv) => inv.teamId)
		const competitions = await autochunk(
			{ items: teamIds, otherParametersCount: 0 },
			async (chunk) =>
				db.query.competitionsTable.findMany({
					where: inArray(competitionsTable.competitionTeamId, chunk),
					columns: {
						id: true,
						name: true,
						slug: true,
						competitionTeamId: true,
					},
				}),
		)

		return pendingVolunteerInvitations.map((inv) => {
			const comp = competitions.find((c) => c.competitionTeamId === inv.teamId)
			return {
				id: inv.id,
				competitionName: comp?.name || "Unknown Competition",
				competitionSlug: comp?.slug || "",
				signupDate: new Date(inv.createdAt),
			}
		})
	})()

	// Get competitions for volunteer memberships
	const volunteerMembershipsWithCompetitions = await (async () => {
		if (volunteerMemberships.length === 0) return []

		const teamIds = volunteerMemberships.map((m) => m.teamId)
		const competitions = await autochunk(
			{ items: teamIds, otherParametersCount: 0 },
			async (chunk) =>
				db.query.competitionsTable.findMany({
					where: inArray(competitionsTable.competitionTeamId, chunk),
					columns: {
						id: true,
						name: true,
						slug: true,
						competitionTeamId: true,
					},
				}),
		)

		return volunteerMemberships.map((membership) => {
			const comp = competitions.find(
				(c) => c.competitionTeamId === membership.teamId,
			)
			// Parse role types from metadata
			let roleTypes: VolunteerRoleType[] = []
			try {
				const meta = JSON.parse(
					membership.metadata || "{}",
				) as VolunteerMembershipMetadata
				roleTypes = meta.volunteerRoleTypes || []
			} catch {
				// Ignore parse errors
			}

			return {
				id: membership.id,
				competitionName: comp?.name || "Unknown Competition",
				competitionSlug: comp?.slug || "",
				roleTypes,
			}
		})
	})()

	// Calculate age
	const age = calculateAge(user.dateOfBirth)

	return (
		<div className="mx-auto max-w-4xl space-y-8 pb-12">
			{/* Header with cover image and avatar */}
			<AthleteHeader
				user={user}
				athleteProfile={athleteProfile}
				gymName={gym?.name || null}
				age={age}
			/>

			{/* Stats Section */}
			<AthleteStats
				dateOfBirth={user.dateOfBirth}
				athleteProfile={athleteProfile}
			/>

			{/* Pending Team Invites */}
			{pendingInvitations.length > 0 && (
				<>
					<Separator />
					<section className="space-y-4">
						<h2 className="font-semibold text-lg">Pending Team Invites</h2>
						<PendingTeamInvites
							invitations={pendingInvitations}
							variant="inline"
						/>
					</section>
				</>
			)}

			{/* Volunteer Status */}
			{(pendingVolunteerInvitationsWithCompetitions.length > 0 ||
				volunteerMembershipsWithCompetitions.length > 0) && (
				<>
					<Separator />
					<section className="space-y-4">
						<h2 className="font-semibold text-lg">Volunteer Status</h2>
						<VolunteerStatus
							pendingInvitations={pendingVolunteerInvitationsWithCompetitions}
							activeMemberships={volunteerMembershipsWithCompetitions}
						/>
					</section>
				</>
			)}

			<Separator />

			{/* Competitive History */}
			<CompetitiveHistory registrations={competitionHistory} />

			<Separator />

			{/* Benchmark Stats */}
			<BenchmarkStats athleteProfile={athleteProfile} />

			<Separator />

			{/* Sponsors & Social */}
			<SponsorsSocial athleteProfile={athleteProfile} sponsors={sponsors} />
		</div>
	)
}
