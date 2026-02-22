/**
 * This file uses top-level imports for server-only modules.
 */
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { validateSession } from "@/server-fns/middleware/auth"
import { getSessionFromCookie } from "@/utils/auth"
import { getActiveTeamId } from "@/utils/team-auth"

/**
 * Organizer Entitlement State for the active organizing team
 * Three possible states:
 * 1. No entitlement - redirect to /compete/organizer/onboard
 * 2. Pending - has HOST_COMPETITIONS but limit=0 (show banner, allow drafts)
 * 3. Approved - has HOST_COMPETITIONS and limit=-1 (full access)
 */
export interface OrganizerEntitlementState {
	hasHostCompetitions: boolean
	isPendingApproval: boolean
	isApproved: boolean
	activeOrganizingTeamId: string | null
}

/**
 * Check if the user has ANY team with HOST_COMPETITIONS entitlement
 * and determine the active organizing team.
 *
 * Priority for active organizing team:
 * 1. Cookie value (if that team has HOST_COMPETITIONS)
 * 2. First team with HOST_COMPETITIONS
 * 3. null (redirect to onboarding)
 */
const checkOrganizerEntitlements = createServerFn({ method: "GET" }).handler(
	async (): Promise<OrganizerEntitlementState> => {
		const session = await getSessionFromCookie()
		if (!session?.teams?.length) {
			return {
				hasHostCompetitions: false,
				isPendingApproval: false,
				isApproved: false,
				activeOrganizingTeamId: null,
			}
		}

		// Get the active team from cookie
		const cookieTeamId = await getActiveTeamId()

		// Find all teams that have HOST_COMPETITIONS using session data
		const teamsWithHostCompetitions = session.teams
			.filter((team) => team.plan?.features.includes("host_competitions"))
			.map((t) => t.id)

		// No teams can host competitions - redirect to onboarding
		if (teamsWithHostCompetitions.length === 0) {
			return {
				hasHostCompetitions: false,
				isPendingApproval: false,
				isApproved: false,
				activeOrganizingTeamId: null,
			}
		}

		// Determine the active organizing team
		const activeOrganizingTeamId =
			cookieTeamId && teamsWithHostCompetitions.includes(cookieTeamId)
				? cookieTeamId
				: (teamsWithHostCompetitions[0] ?? "")

		// Get limit from session data
		const activeTeam = session.teams.find(
			(t) => t.id === activeOrganizingTeamId,
		)
		const limit =
			activeTeam?.plan?.limits["max_published_competitions"] ?? 0
		const isPendingApproval = limit === 0
		const isApproved = limit === -1 || limit > 0

		return {
			hasHostCompetitions: true,
			isPendingApproval,
			isApproved,
			activeOrganizingTeamId,
		}
	},
)

export const Route = createFileRoute("/compete/organizer")({
	beforeLoad: async ({ location }) => {
		// Skip auth/entitlement check for the onboard page - it handles auth inline
		// Note: We return session: null here, but the onboard page's loader
		// fetches the session directly via getOptionalSessionFn() to avoid
		// import chain issues with cloudflare:workers
		// SECURITY: Use exact match + trailing slash to prevent auth bypass on similar routes
		// (e.g., /compete/organizer/onboarding would have bypassed with startsWith alone)
		const isOnboardRoute =
			location.pathname === "/compete/organizer/onboard" ||
			location.pathname.startsWith("/compete/organizer/onboard/")
		if (isOnboardRoute) {
			return {
				session: null,
				entitlements: {
					hasHostCompetitions: false,
					isPendingApproval: false,
					isApproved: false,
					activeOrganizingTeamId: null,
				},
			}
		}

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
	return <Outlet />
}
