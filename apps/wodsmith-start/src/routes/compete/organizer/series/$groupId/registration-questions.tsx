import { createFileRoute, useRouter } from "@tanstack/react-router"
import { RegistrationQuestionsEditor } from "@/components/competition-settings/registration-questions-editor"
import { getCompetitionGroupByIdFn } from "@/server-fns/competition-fns"
import { getSeriesQuestionsFn } from "@/server-fns/registration-questions-fns"
import { getActiveTeamIdFn, getOrganizerTeamsFn } from "@/server-fns/team-fns"

export const Route = createFileRoute(
	"/compete/organizer/series/$groupId/registration-questions",
)({
	component: SeriesRegistrationQuestionsPage,
	loader: async ({ params, context }) => {
		const { groupId } = params
		const [groupResult, { teams: organizingTeams }, questionsResult] =
			await Promise.all([
				getCompetitionGroupByIdFn({ data: { groupId } }),
				getOrganizerTeamsFn(),
				getSeriesQuestionsFn({ data: { groupId } }),
			])

		const isSiteAdmin = context.session?.user?.role === "admin"
		const groupTeamId = groupResult.group?.organizingTeamId
		let teamId: string | null = null

		if (groupTeamId) {
			if (
				isSiteAdmin ||
				organizingTeams.some((t) => t.id === groupTeamId)
			) {
				teamId = groupTeamId
			} else {
				const activeTeamId = await getActiveTeamIdFn()
				teamId =
					organizingTeams.find((t) => t.id === activeTeamId)?.id ??
					organizingTeams[0]?.id ??
					null
			}
		}

		return {
			groupId,
			teamId,
			questions: questionsResult.questions,
		}
	},
})

function SeriesRegistrationQuestionsPage() {
	const { groupId, teamId, questions } = Route.useLoaderData()
	const router = useRouter()

	if (!teamId) return null

	return (
		<div className="flex flex-col gap-6">
			<RegistrationQuestionsEditor
				entityType="series"
				entityId={groupId}
				teamId={teamId}
				questions={questions}
				onQuestionsChange={() => router.invalidate()}
			/>
		</div>
	)
}
