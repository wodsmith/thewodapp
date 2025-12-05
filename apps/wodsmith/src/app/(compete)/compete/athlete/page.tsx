import { redirect } from "next/navigation"
import { PendingTeamInvites } from "@/components/compete/pending-team-invites"
import { Separator } from "@/components/ui/separator"
import { getUserCompetitionHistory } from "@/server/competitions"
import { getUserSponsors } from "@/server/sponsors"
import { getPendingInvitationsForCurrentUser } from "@/server/team-members"
import { getUserGymAffiliation } from "@/server/user"
import { getSessionFromCookie } from "@/utils/auth"
import { calculateAge, parseAthleteProfile } from "@/utils/athlete-profile"
import { AthleteHeader } from "./_components/athlete-header"
import { AthleteStats } from "./_components/athlete-stats"
import { BenchmarkStats } from "./_components/benchmark-stats"
import { CompetitiveHistory } from "./_components/competitive-history"
import { SponsorsSocial } from "./_components/sponsors-social"
import { getDb } from "@/db"
import { eq } from "drizzle-orm"
import { userTable } from "@/db/schema"

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

	// Get gym affiliation, competition history, sponsors, and pending invitations in parallel
	const [gym, competitionHistory, sponsors, pendingInvitations] =
		await Promise.all([
			getUserGymAffiliation(session.userId),
			getUserCompetitionHistory(session.userId),
			getUserSponsors(session.userId),
			getPendingInvitationsForCurrentUser().catch(() => []),
		])

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
