/**
 * This file uses top-level imports for server-only modules.
 */
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import type { SessionValidationResult } from "@/types"
import { getSessionFromCookie } from "@/utils/auth"
import {
  computeOrganizerEntitlements,
  type OrganizerEntitlementState,
} from "@/utils/organizer-entitlements"
import { getActiveTeamId } from "@/utils/team-auth"

export type { OrganizerEntitlementState }

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
    const cookieTeamId = session?.teams?.length ? await getActiveTeamId() : null

    return {
      session,
      entitlements: computeOrganizerEntitlements(session, cookieTeamId),
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
