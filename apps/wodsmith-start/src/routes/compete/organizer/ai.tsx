import { createFileRoute, redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { FEATURES } from "@/config/features"
import { ROLES_ENUM } from "@/db/schema"
import { hasFeature } from "@/server/entitlements"
import { getSessionFromCookie } from "@/utils/auth"
import { getActiveTeamId } from "@/utils/team-auth"

const checkAiAccess = createServerFn({ method: "GET" }).handler(async () => {
	const session = await getSessionFromCookie()
	if (!session) return { hasAccess: false }

	// Admin bypass
	if (session.user.role === ROLES_ENUM.ADMIN) {
		return { hasAccess: true }
	}

	const teamId = await getActiveTeamId()
	if (!teamId) return { hasAccess: false }

	// Check for AI entitlements
	// Checking both relevant AI features to be inclusive
	const hasWorkoutGen = await hasFeature(teamId, FEATURES.AI_WORKOUT_GENERATION)
	const hasProgAssist = await hasFeature(
		teamId,
		FEATURES.AI_PROGRAMMING_ASSISTANT,
	)

	return { hasAccess: hasWorkoutGen || hasProgAssist }
})

export const Route = createFileRoute("/compete/organizer/ai")({
	beforeLoad: async () => {
		const { hasAccess } = await checkAiAccess()

		if (!hasAccess) {
			throw redirect({
				to: "/", // Redirect to home or another appropriate page
			})
		}
	},
	component: AiPage,
})

function AiPage() {
	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold mb-4">AI Assistant</h1>
			<p>Welcome to the AI Assistant page.</p>
		</div>
	)
}
