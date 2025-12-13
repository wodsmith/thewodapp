import "server-only"
import { eq } from "drizzle-orm"
import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { StripeConnectionManager } from "@/components/compete/stripe-connection-manager"
import { Button } from "@/components/ui/button"
import { getDb } from "@/db"
import { TEAM_PERMISSIONS, teamTable } from "@/db/schema"
import {
	type AccountBalance,
	getAccountBalance,
	syncAccountStatus,
} from "@/server/stripe-connect"
import { requireTeamPermission } from "@/utils/team-auth"

interface PayoutsPageProps {
	params: Promise<{
		teamSlug: string
	}>
	searchParams: Promise<{
		stripe_connected?: string
		stripe_refresh?: string
		stripe_error?: string
		returnTo?: string
	}>
}

export async function generateMetadata({
	params,
}: PayoutsPageProps): Promise<Metadata> {
	const { teamSlug } = await params
	const db = getDb()

	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.slug, teamSlug),
		columns: { name: true },
	})

	if (!team) {
		return { title: "Team Not Found" }
	}

	return {
		title: `Payout Settings - ${team.name}`,
		description: `Configure Stripe payouts for ${team.name}`,
	}
}

export default async function PayoutsPage({
	params,
	searchParams,
}: PayoutsPageProps) {
	const { teamSlug } = await params
	const { stripe_connected, stripe_refresh, stripe_error, returnTo } =
		await searchParams
	const db = getDb()

	// Find the team by slug
	const team = await db.query.teamTable.findFirst({
		where: eq(teamTable.slug, teamSlug),
		columns: {
			id: true,
			name: true,
			slug: true,
			stripeConnectedAccountId: true,
			stripeAccountStatus: true,
			stripeAccountType: true,
			stripeOnboardingCompletedAt: true,
		},
	})

	if (!team) {
		notFound()
	}

	// Verify user has permission on this team
	await requireTeamPermission(team.id, TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS)

	// If account is pending, sync status from Stripe to check if it's now verified
	let currentStatus = team.stripeAccountStatus
	let currentOnboardingCompletedAt = team.stripeOnboardingCompletedAt
	if (team.stripeConnectedAccountId && team.stripeAccountStatus === "PENDING") {
		try {
			await syncAccountStatus(team.id)
			// Re-fetch the updated status
			const updated = await db.query.teamTable.findFirst({
				where: eq(teamTable.id, team.id),
				columns: {
					stripeAccountStatus: true,
					stripeOnboardingCompletedAt: true,
				},
			})
			if (updated) {
				currentStatus = updated.stripeAccountStatus
				currentOnboardingCompletedAt = updated.stripeOnboardingCompletedAt
			}
		} catch {
			// Silently fail - we'll show the cached status
		}
	}

	// Fetch Stripe balance if connected
	let stripeBalance: AccountBalance | null = null
	if (team.stripeConnectedAccountId && currentStatus === "VERIFIED") {
		try {
			stripeBalance = await getAccountBalance(team.stripeConnectedAccountId)
		} catch {
			// Silently fail - balance display is a convenience feature
		}
	}

	// Determine back link - returnTo param or default to organizer dashboard
	// Only allow relative paths to prevent open redirect attacks
	const backHref =
		returnTo?.startsWith("/") && !returnTo.startsWith("//")
			? returnTo
			: "/compete/organizer"

	return (
		<div className="container mx-auto px-4 py-8 max-w-3xl">
			<div className="mb-6">
				<Button variant="ghost" size="sm" asChild>
					<Link href={backHref}>
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back
					</Link>
				</Button>
			</div>

			<div className="space-y-6">
				<div>
					<h1 className="text-2xl font-bold">{team.name} - Payout Settings</h1>
					<p className="text-muted-foreground">
						Connect your Stripe account to receive payouts from competition
						registrations.
					</p>
				</div>

				<StripeConnectionManager
					teamId={team.id}
					teamSlug={team.slug}
					stripeAccountStatus={currentStatus}
					stripeAccountType={team.stripeAccountType}
					stripeOnboardingCompletedAt={currentOnboardingCompletedAt}
					balance={stripeBalance}
					showConnectedMessage={stripe_connected === "true"}
					showRefreshMessage={stripe_refresh === "true"}
					stripeError={stripe_error}
				/>
			</div>
		</div>
	)
}
