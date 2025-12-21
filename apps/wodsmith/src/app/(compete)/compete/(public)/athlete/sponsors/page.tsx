import "server-only"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { getUserSponsors } from "@/server/sponsors"
import { getSessionFromCookie } from "@/utils/auth"
import { AthleteSponsorsList } from "./_components/athlete-sponsors-list"

export default async function AthleteSponsorsPage() {
	const session = await getSessionFromCookie()
	if (!session) {
		redirect("/sign-in?redirect=/compete/athlete/sponsors")
	}

	const sponsors = await getUserSponsors(session.userId)

	return (
		<div className="mx-auto max-w-4xl space-y-8 pb-12">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Button asChild variant="ghost" size="icon">
						<Link href="/compete/athlete">
							<ArrowLeft className="h-5 w-5" />
						</Link>
					</Button>
					<div>
						<h1 className="text-3xl font-bold">My Sponsors</h1>
						<p className="text-muted-foreground mt-1">
							Manage your sponsors and partnerships
						</p>
					</div>
				</div>
			</div>

			{/* Sponsors List */}
			<AthleteSponsorsList sponsors={sponsors} userId={session.userId} />
		</div>
	)
}
