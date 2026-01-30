/**
 * This file uses top-level imports for server-only modules.
 */
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { FEATURES } from "@/config/features"
import { LIMITS } from "@/config/limits"
import { getDb } from "@/db"
import {
	teamMembershipTable,
	TEAM_TYPE_ENUM,
	type Team,
	type TeamMembership,
} from "@/db/schema"

/** Membership with team relation included */
type TeamMembershipWithTeam = TeamMembership & {
	team: Team | null
}
import {
	hasFeature,
	isTeamPendingOrganizer,
	getTeamLimit,
} from "@/server/entitlements"
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
 *
 * NOTE: Due to Cloudflare KV eventual consistency, the session's teams list
 * may be stale after team creation or feature grant. If no teams with
 * HOST_COMPETITIONS are found in the cached session, we fallback to
 * querying the database directly.
 */
const checkOrganizerEntitlements = createServerFn({ method: "GET" }).handler(
	async (): Promise<OrganizerEntitlementState> => {
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			return {
				hasHostCompetitions: false,
				isPendingApproval: false,
				isApproved: false,
				activeOrganizingTeamId: null,
			}
		}

		// Get the active team from cookie
		const cookieTeamId = await getActiveTeamId()

		// Find all teams that have HOST_COMPETITIONS from cached session
		let teamsWithHostCompetitions: string[] = []

		// First, check teams from cached session
		if (session.teams?.length) {
			for (const team of session.teams) {
				const hasHost = await hasFeature(team.id, FEATURES.HOST_COMPETITIONS)
				if (hasHost) {
					teamsWithHostCompetitions.push(team.id)
				}
			}
		}

		// If no teams found in cached session, fallback to database query
		// This handles the case where KV session hasn't been updated yet
		// (e.g., after team creation or feature grant due to eventual consistency)
		if (teamsWithHostCompetitions.length === 0) {
			const db = getDb()

			// Query user's team memberships directly from database
			const memberships = (await db.query.teamMembershipTable.findMany({
				where: eq(teamMembershipTable.userId, session.userId),
				with: {
					team: true,
				},
			})) as TeamMembershipWithTeam[]

			// Filter to gym teams (same logic as session.teams filtering)
			const gymTeamIds = memberships
				.filter((m) => {
					return (
						m.team &&
						m.team.type === TEAM_TYPE_ENUM.GYM &&
						!m.team.isPersonalTeam
					)
				})
				.map((m) => m.teamId)

			// Check each team from DB for HOST_COMPETITIONS
			for (const teamId of gymTeamIds) {
				const hasHost = await hasFeature(teamId, FEATURES.HOST_COMPETITIONS)
				if (hasHost) {
					teamsWithHostCompetitions.push(teamId)
				}
			}
		}

		// No teams can host competitions - redirect to onboarding
		if (teamsWithHostCompetitions.length === 0) {
			return {
				hasHostCompetitions: false,
				isPendingApproval: false,
				isApproved: false,
				activeOrganizingTeamId: null,
			}
		}

		// Determine the active organizing team:
		// 1. Use cookie team if it has HOST_COMPETITIONS
		// 2. Otherwise use first team with HOST_COMPETITIONS
		const activeOrganizingTeamId =
			cookieTeamId && teamsWithHostCompetitions.includes(cookieTeamId)
				? cookieTeamId
				: teamsWithHostCompetitions[0]!

		// Check if pending (limit = 0) for the active organizing team
		const isPendingApproval = await isTeamPendingOrganizer(
			activeOrganizingTeamId,
		)

		// Check if approved (limit = -1 or > 0)
		const limit = await getTeamLimit(
			activeOrganizingTeamId,
			LIMITS.MAX_PUBLISHED_COMPETITIONS,
		)
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
