import { eq } from "drizzle-orm"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { getDb } from "@/db"
import { userTable } from "@/db/schema"
import { getUserNotableMetconResults } from "@/server/user"
import { parseAthleteProfile } from "@/utils/athlete-profile"
import { getSessionFromCookie } from "@/utils/auth"
import { AthleteProfileForm } from "../_components/athlete-profile-form"

export default async function AthleteEditPage() {
	// Require authentication
	const session = await getSessionFromCookie()
	if (!session) {
		redirect("/sign-in?redirect=/compete/athlete/edit")
	}

	// Fetch user profile data
	const db = getDb()
	const user = await db.query.userTable.findFirst({
		where: eq(userTable.id, session.userId),
		columns: {
			athleteProfile: true,
			gender: true,
			dateOfBirth: true,
			affiliateName: true,
		},
	})

	if (!user) {
		redirect("/sign-in?redirect=/compete/athlete/edit")
	}

	// Parse athlete profile JSON and merge with direct column fields
	const parsed = parseAthleteProfile(user.athleteProfile)
	const athleteProfile = {
		...parsed,
		preferredUnits: parsed?.preferredUnits ?? "imperial",
		gender: user.gender ?? undefined,
		dateOfBirth: user.dateOfBirth
			? user.dateOfBirth.toISOString().split("T")[0]
			: undefined,
		affiliateName: user.affiliateName ?? undefined,
	}

	// Get notable metcon results as suggestions
	const notableMetconSuggestions = await getUserNotableMetconResults(
		session.userId,
	)

	return (
		<div className="mx-auto max-w-4xl space-y-8 pb-12">
			{/* Header */}
			<div className="flex items-center gap-4">
				<Button asChild variant="ghost" size="icon">
					<Link href="/compete/athlete">
						<ArrowLeft className="h-5 w-5" />
					</Link>
				</Button>
				<div>
					<h1 className="text-3xl font-bold">Edit Athlete Profile</h1>
					<p className="text-muted-foreground mt-1">
						Update your competition profile information
					</p>
				</div>
			</div>

			{/* Form */}
			<AthleteProfileForm
				initialData={athleteProfile}
				notableMetconSuggestions={notableMetconSuggestions}
			/>
		</div>
	)
}
