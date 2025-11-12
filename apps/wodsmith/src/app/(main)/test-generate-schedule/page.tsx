import { getScheduleTemplatesByTeam } from "@/actions/schedule-template-actions"
import { getOwnedTeamsAction } from "@/actions/team-actions"
import type { Team } from "@/db/schema"
import { CreateTemplateForm } from "./_components/create-template-form"
import { TestGenerateScheduleClient } from "./_components/test-client"

export default async function TestGenerateSchedulePage() {
	const [result] = await getOwnedTeamsAction()

	// For testing, we'll get templates for the first team if available
	if (!result?.success || !result.data) {
		return <div>Error</div>
	}

	const teams = result.data as Team[]
	const firstTeam = teams[0]
	if (!firstTeam) {
		return <div>No teams found</div>
	}
	const [templatesResult, templatesError] = await getScheduleTemplatesByTeam({
		teamId: firstTeam.id,
	})

	if (templatesError) {
		return <div>Error loading templates</div>
	}

	// Show create template form if no templates exist
	if (!templatesResult || templatesResult.length === 0) {
		return (
			<div className="container mx-auto p-8">
				<h1 className="text-2xl font-bold mb-6">
					Test Generate Schedule Action
				</h1>
				<div className="mb-8">
					<p className="text-muted-foreground mb-6">
						No schedule templates found for your team. Create one to get started
						with automated scheduling.
					</p>
					<CreateTemplateForm teamId={firstTeam.id} />
				</div>
			</div>
		)
	}

	return (
		<div className="container mx-auto p-8">
			<h1 className="text-2xl font-bold mb-6">Test Generate Schedule Action</h1>

			<TestGenerateScheduleClient
				teams={teams.map((t) => ({ id: t.id, name: t.name }))}
				templates={templatesResult || []}
				defaultTeamId={firstTeam?.id || ""}
			/>
		</div>
	)
}
