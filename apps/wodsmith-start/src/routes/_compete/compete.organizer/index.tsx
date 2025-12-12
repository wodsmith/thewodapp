import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { Plus } from "lucide-react"
import { Button } from "~/components/ui/button"
import { OrganizerCompetitionsList } from "~/components/compete/organizer/organizer-competitions-list"
import { TeamFilter } from "~/components/compete/organizer/team-filter"
import {
	getCompetitionsForOrganizerFn,
	getCompetitionGroupsFn,
	getUserOrganizingTeamsFn,
} from "~/server-functions/competitions"
import {
	getActiveTeamFromCookie,
	getSessionFromCookie,
} from "~/utils/auth.server"

export const Route = createFileRoute("/_compete/compete/organizer/")({
	beforeLoad: async () => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("Unauthorized")
		}
	},
	loader: async ({ search }) => {
		const session = await getSessionFromCookie()
		if (!session) throw new Error("Unauthorized")

		const organizingTeams = await getUserOrganizingTeamsFn({
			data: { userId: session.userId },
		})

		if (!organizingTeams.success || organizingTeams.data.length === 0) {
			return {
				organizingTeams: [],
				competitions: [],
				groups: [],
				activeTeamId: null,
			}
		}

		const activeTeamFromCookie = await getActiveTeamFromCookie()

		// Priority: URL param > active team cookie (if valid organizing team)
		let activeTeamId: string | undefined = (search as any)?.teamId
		if (!activeTeamId && activeTeamFromCookie) {
			if (organizingTeams.data.some((t) => t.id === activeTeamFromCookie)) {
				activeTeamId = activeTeamFromCookie
			}
		}

		// If no active team selected but there are organizing teams, use the first one
		if (!activeTeamId && organizingTeams.data.length > 0) {
			activeTeamId = organizingTeams.data[0]?.id
		}

		if (!activeTeamId) {
			return {
				organizingTeams: organizingTeams.data,
				competitions: [],
				groups: [],
				activeTeamId: null,
			}
		}

		// Fetch competitions and groups for the active team
		const [competitionsResult, groupsResult] = await Promise.all([
			getCompetitionsForOrganizerFn({ data: { teamId: activeTeamId } }),
			getCompetitionGroupsFn({ data: { teamId: activeTeamId } }),
		])

		let competitions = competitionsResult.success ? competitionsResult.data : []
		const groups = groupsResult.success ? groupsResult.data : []

		// Filter by group if provided
		const groupId = (search as any)?.groupId
		if (groupId) {
			competitions = competitions.filter((c) => c.groupId === groupId)
		}

		return {
			organizingTeams: organizingTeams.data,
			competitions,
			groups,
			activeTeamId,
			currentGroupId: groupId,
		}
	},
	component: OrganizerDashboardComponent,
	errorComponent: () => {
		const navigate = useNavigate()
		useEffect(() => {
			navigate({ to: "/sign-in", search: { redirect: "/compete/organizer" } })
		}, [navigate])
		return null
	},
})

function OrganizerDashboardComponent() {
	const {
		organizingTeams,
		competitions,
		groups,
		activeTeamId,
		currentGroupId,
	} = Route.useLoaderData()

	// Show no access message if no organizing teams
	if (organizingTeams.length === 0) {
		return (
			<div className="container mx-auto px-4 py-16">
				<div className="max-w-md mx-auto text-center">
					<h1 className="text-2xl font-bold mb-4">No Organizing Access</h1>
					<p className="text-muted-foreground mb-6">
						You don't have permission to organize competitions. Contact your
						team administrator to get access.
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col gap-6">
				{/* Header */}
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
					<div>
						<h1 className="text-3xl font-bold">My Competitions</h1>
						<p className="text-muted-foreground mt-1">
							Create and manage your competitions
						</p>
					</div>
					<div className="flex flex-col sm:flex-row gap-2">
						<Button variant="outline" className="w-full sm:w-auto">
							Manage Series
						</Button>
						<Button className="w-full sm:w-auto">
							<Plus className="h-4 w-4 mr-2" />
							Create Competition
						</Button>
					</div>
				</div>

				{/* Team Filter (only show if multiple teams) */}
				{organizingTeams.length > 1 && (
					<TeamFilter
						teams={organizingTeams}
						selectedTeamId={activeTeamId ?? ""}
					/>
				)}

				{/* Competitions List */}
				{activeTeamId && (
					<OrganizerCompetitionsList
						competitions={competitions}
						groups={groups}
						teamId={activeTeamId}
						currentGroupId={currentGroupId}
					/>
				)}
			</div>
		</div>
	)
}
