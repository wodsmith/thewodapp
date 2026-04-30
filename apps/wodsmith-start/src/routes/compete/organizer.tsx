/**
 * This file uses top-level imports for server-only modules.
 */
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import type { SessionValidationResult } from "@/types"
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

interface OrganizerBootstrap {
  session: SessionValidationResult | null
  entitlements: OrganizerEntitlementState
}

/**
 * Single round-trip bootstrap for the organizer beforeLoad.
 *
 * Replaces 2 separate server fn calls (validateSession + checkOrganizerEntitlements),
 * collapsing 1 HTTP roundtrip and sharing one getSessionFromCookie() call between
 * the auth check and the entitlement computation.
 *
 * Redirect semantics: returns null session instead of throwing, so the route
 * caller decides whether to redirect (match per-route behavior, e.g. onboard
 * routes accept null sessions).
 */
const getOrganizerBootstrapFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<OrganizerBootstrap> => {
    const session = await getSessionFromCookie()

    if (!session?.teams?.length) {
      return {
        session,
        entitlements: {
          hasHostCompetitions: false,
          isPendingApproval: false,
          isApproved: false,
          activeOrganizingTeamId: null,
        },
      }
    }

    // Get the active team from cookie
    const cookieTeamId = await getActiveTeamId()

    // Find all teams that have HOST_COMPETITIONS using session data
    const teamsWithHostCompetitions = session.teams
      .filter((team) => team.plan?.features.includes("host_competitions"))
      .map((t) => t.id)

    const firstHostingTeam = teamsWithHostCompetitions[0]
    if (!firstHostingTeam) {
      return {
        session,
        entitlements: {
          hasHostCompetitions: false,
          isPendingApproval: false,
          isApproved: false,
          activeOrganizingTeamId: null,
        },
      }
    }

    const activeOrganizingTeamId =
      cookieTeamId && teamsWithHostCompetitions.includes(cookieTeamId)
        ? cookieTeamId
        : firstHostingTeam

    const activeTeam = session.teams.find(
      (t) => t.id === activeOrganizingTeamId,
    )
    const limit = activeTeam?.plan?.limits.max_published_competitions ?? 0
    const isPendingApproval = limit === 0
    const isApproved = limit === -1 || limit > 0

    return {
      session,
      entitlements: {
        hasHostCompetitions: true,
        isPendingApproval,
        isApproved,
        activeOrganizingTeamId,
      },
    }
  },
)

export const Route = createFileRoute("/compete/organizer")({
  beforeLoad: async ({ location }) => {
    // Skip auth/entitlement check for the onboard page - it handles auth inline
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

    const { session, entitlements } = await getOrganizerBootstrapFn()

    // Redirect to sign-in if no session
    if (!session) {
      throw redirect({
        to: "/sign-in",
        search: {
          redirect: "/compete/organizer",
        },
      })
    }

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
