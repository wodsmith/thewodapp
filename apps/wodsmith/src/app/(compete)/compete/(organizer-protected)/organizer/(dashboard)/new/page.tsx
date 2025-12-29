import "server-only"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { OrganizerBreadcrumb } from "@/app/(compete)/compete/(organizer-protected)/organizer/_components/organizer-breadcrumb"
import { getCompetitionGroups } from "@/server/competitions"
import { listScalingGroups } from "@/server/scaling-groups"
import { getActiveTeamFromCookie } from "@/utils/auth"
import { getUserOrganizingTeams } from "@/utils/get-user-organizing-teams"
import { OrganizerCompetitionForm } from "./_components/organizer-competition-form"

export const metadata: Metadata = {
	title: "Create Competition - Compete",
	description: "Create a new competition",
}

interface NewCompetitionPageProps {
	searchParams: Promise<{
		teamId?: string
		groupId?: string
	}>
}

export default async function NewCompetitionPage({
	searchParams,
}: NewCompetitionPageProps) {
	const { teamId: selectedTeamId, groupId } = await searchParams
	const organizingTeams = await getUserOrganizingTeams()
	const activeTeamFromCookie = await getActiveTeamFromCookie()

	// Priority: URL param > active team cookie (if valid organizing team)
	let activeTeamId: string | undefined = selectedTeamId
	if (!activeTeamId && activeTeamFromCookie) {
		if (organizingTeams.some((t) => t.id === activeTeamFromCookie)) {
			activeTeamId = activeTeamFromCookie
		}
	}

	if (!activeTeamId) {
		const gymTeams = organizingTeams.filter((team) => team.type === "gym")
		const firstTeam = gymTeams[0]
		if (firstTeam) {
			activeTeamId = firstTeam.id
		} else {
			redirect("/compete/organizer")
		}
	}

	// Fetch groups and scaling groups for the active team
	const [groups, scalingGroups] = await Promise.all([
		getCompetitionGroups(activeTeamId),
		listScalingGroups({ teamId: activeTeamId }),
	])

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-2xl mx-auto">
				{/* Header */}
				<div className="mb-8">
					<OrganizerBreadcrumb segments={[{ label: "New Competition" }]} />
					<h1 className="text-3xl font-bold">Create Competition</h1>
					<p className="text-muted-foreground mt-1">
						Set up a new competition for your athletes
					</p>
				</div>

				{/* Form */}
				<OrganizerCompetitionForm
					teams={organizingTeams}
					selectedTeamId={activeTeamId}
					groups={groups}
					scalingGroups={scalingGroups}
					defaultGroupId={groupId}
				/>
			</div>
		</div>
	)
}
