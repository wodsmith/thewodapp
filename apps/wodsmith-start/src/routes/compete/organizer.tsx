import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { FEATURES } from "@/config/features"
import { PendingOrganizerBanner } from "@/components/pending-organizer-banner"
import { validateSession } from "@/server-fns/middleware/auth"

/**
 * Organizer Entitlement State
 * Three possible states:
 * 1. No entitlement - redirect to /compete/organizer/onboard
 * 2. Pending - has HOST_COMPETITIONS but limit=0 (show banner, allow drafts)
 * 3. Approved - has HOST_COMPETITIONS and limit=-1 (full access)
 */
export interface OrganizerEntitlementState {
	hasHostCompetitions: boolean
	isPendingApproval: boolean
	isApproved: boolean
}

/**
 * Check organizer entitlements for the current user's active team
 * Uses dynamic imports to avoid bundling cloudflare:workers into client
 *
 * IMPORTANT: Uses getActiveTeamId() to respect the team cookie set by team-switcher.
 * Previously this used session.teams?.[0] which ignored team switching.
 */
const checkOrganizerEntitlements = createServerFn({ method: "GET" }).handler(
	async (): Promise<OrganizerEntitlementState> => {
		// Dynamic imports for server-only modules
		const { getActiveTeamId } = await import("@/utils/team-auth")
		const { hasFeature, isTeamPendingOrganizer, getTeamLimit } = await import(
			"@/server/entitlements"
		)
		const { LIMITS } = await import("@/config/limits")

		// Get the active team from cookie (falls back to first team if no cookie)
		const teamId = await getActiveTeamId()
		if (!teamId) {
			return {
				hasHostCompetitions: false,
				isPendingApproval: false,
				isApproved: false,
			}
		}

		// Check if team has HOST_COMPETITIONS feature
		const hasHostCompetitions = await hasFeature(
			teamId,
			FEATURES.HOST_COMPETITIONS,
		)

		if (!hasHostCompetitions) {
			return {
				hasHostCompetitions: false,
				isPendingApproval: false,
				isApproved: false,
			}
		}

		// Check if pending (limit = 0)
		const isPendingApproval = await isTeamPendingOrganizer(teamId)

		// Check if approved (limit = -1 or > 0)
		const limit = await getTeamLimit(teamId, LIMITS.MAX_PUBLISHED_COMPETITIONS)
		const isApproved = limit === -1 || limit > 0

		return {
			hasHostCompetitions,
			isPendingApproval,
			isApproved,
		}
	},
)

export const Route = createFileRoute("/compete/organizer")({
	beforeLoad: async () => {
		// Validate session - organizer routes require authentication
		const session = await validateSession()

		// Redirect to sign-in if no session
		if (!session) {
			throw redirect({
				to: "/sign-in",
				search: {
					redirect: "/compete/organizer",
				},
			})
		}

		// Check entitlements
		const entitlements = await checkOrganizerEntitlements()

		// Redirect to onboarding if no HOST_COMPETITIONS feature
		if (!entitlements.hasHostCompetitions) {
			throw redirect({
				to: "/compete/organizer/onboard",
			})
		}

		return {
			session,
			entitlements,
		}
	},
	component: OrganizerLayout,
})

function OrganizerLayout() {
	const { entitlements } = Route.useRouteContext()

	return (
		<>
			{entitlements.isPendingApproval && (
				<PendingOrganizerBanner variant="page-container" />
			)}
			<Outlet />
		</>
	)
}
