import { redirect } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { getUserCompetitionHistory } from "@/server/competitions"
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

	// Get gym affiliation
	const gym = await getUserGymAffiliation(session.userId)

	// Get competition history
	const competitionHistory = await getUserCompetitionHistory(session.userId)

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

			<Separator />

			{/* Competitive History */}
			<CompetitiveHistory registrations={competitionHistory} />

			<Separator />

			{/* Benchmark Stats */}
			<BenchmarkStats athleteProfile={athleteProfile} />

			<Separator />

			{/* Sponsors & Social */}
			<SponsorsSocial athleteProfile={athleteProfile} />
		</div>
	)
}
