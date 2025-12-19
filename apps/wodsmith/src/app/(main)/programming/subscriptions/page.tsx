import "server-only"
import { SubscriptionsList } from "@/components/programming/subscriptions-list"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { getTeamProgrammingTracks } from "@/server/programming"
import { getSessionFromCookie } from "@/utils/auth"
import { requireTeamPermission } from "@/utils/team-auth"

interface SubscriptionsPageProps {
	searchParams: Promise<{
		team?: string
	}>
}

export default async function SubscriptionsPage({
	searchParams,
}: SubscriptionsPageProps) {
	const session = await getSessionFromCookie()
	if (!session || !session.user) {
		return <div>Please sign in to view subscriptions.</div>
	}

	// For now, use first team or the team from search params
	const { team } = await searchParams
	const teamId = team || session.teams?.[0]?.id

	if (!teamId) {
		return <div>No team selected.</div>
	}

	// Check permissions
	try {
		await requireTeamPermission(teamId, TEAM_PERMISSIONS.ACCESS_DASHBOARD)
	} catch {
		return <div>You don't have access to this team's subscriptions.</div>
	}

	const subscriptions = await getTeamProgrammingTracks(teamId)

	return (
		<div className="container mx-auto py-8">
			<div className="mb-8">
				<h1 className="text-3xl font-bold tracking-tight">
					Programming Subscriptions
				</h1>
				<p className="text-muted-foreground">
					Manage your team's programming track subscriptions
				</p>
			</div>
			<SubscriptionsList subscriptions={subscriptions} teamId={teamId} />
		</div>
	)
}
