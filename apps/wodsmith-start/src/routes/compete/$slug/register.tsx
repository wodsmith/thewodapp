/**
 * Competition Registration Route
 * Port from apps/wodsmith/src/app/(compete)/compete/(public)/[slug]/register/page.tsx
 *
 * This file uses top-level imports for server-only modules.
 * Supports multi-division registration - users can register for multiple divisions.
 */

import { createFileRoute, notFound, redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { and, eq, inArray, isNotNull } from "drizzle-orm"
import { z } from "zod"
import {
  InviteRegistrationForm,
  PublicRegistrationForm,
} from "@/components/registration/registration-form"
import {
  competitionRegistrationAnswersTable,
  competitionRegistrationsTable,
  REGISTRATION_STATUS,
  scalingGroupsTable,
  teamMembershipTable,
  userTable,
  waiverSignaturesTable,
} from "@/db/schema"
import {
  getPublicCompetitionDivisionsFn,
  parseCompetitionSettings,
} from "@/server-fns/competition-divisions-fns"
import { cancelPendingPurchaseFn } from "@/server-fns/registration-fns"
import { getCompetitionQuestionsFn } from "@/server-fns/registration-questions-fns"
import { getCompetitionWaiversFn } from "@/server-fns/waiver-fns"
import { getLocalDateKey } from "@/utils/date-utils"

// Search params validation
const registerSearchSchema = z.object({
  canceled: z.enum(["true", "false"]).optional().catch(undefined),
  // Set when arriving from a competition-invite claim. The token is
  // forwarded into `initiateRegistrationPaymentFn` so the paid registration
  // flips the invite to `accepted_paid`. The invited division id is also
  // passed through so the form pre-selects (and pins) the right division
  // — invites are locked to the division they were issued for.
  invite: z.string().min(1).optional().catch(undefined),
  divisionId: z.string().min(1).optional().catch(undefined),
})

// Server function to get ALL user registrations for a competition
const getUserCompetitionRegistrationsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        competitionId: z.string(),
        userId: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { getDb } = await import("@/db")
    const db = getDb()

    // 1. Direct registrations (user is the registrant/captain)
    const directRegistrations =
      await db.query.competitionRegistrationsTable.findMany({
        where: and(
          eq(competitionRegistrationsTable.eventId, data.competitionId),
          eq(competitionRegistrationsTable.userId, data.userId),
        ),
      })

    // 2. Team registrations where user is a team member (accepted invite)
    // Find all athlete teams the user belongs to
    const userMemberships = await db.query.teamMembershipTable.findMany({
      where: and(
        eq(teamMembershipTable.userId, data.userId),
        eq(teamMembershipTable.isActive, true),
      ),
      columns: { teamId: true },
    })
    const userTeamIds = userMemberships.map((m) => m.teamId)

    let teamRegistrations: typeof directRegistrations = []
    if (userTeamIds.length > 0) {
      teamRegistrations = await db.query.competitionRegistrationsTable.findMany(
        {
          where: and(
            eq(competitionRegistrationsTable.eventId, data.competitionId),
            inArray(competitionRegistrationsTable.athleteTeamId, userTeamIds),
            isNotNull(competitionRegistrationsTable.athleteTeamId),
          ),
        },
      )
    }

    // Dedupe by registration ID (captain shows up in both)
    const allRegistrations = [
      ...directRegistrations,
      ...teamRegistrations.filter(
        (tr) => !directRegistrations.some((dr) => dr.id === tr.id),
      ),
    ]

    const activeRegistrations = allRegistrations.filter(
      (r) => r.status !== REGISTRATION_STATUS.REMOVED,
    )
    const removedRegistrations = allRegistrations.filter(
      (r) => r.status === REGISTRATION_STATUS.REMOVED,
    )

    const registeredDivisionIds = activeRegistrations
      .map((r) => r.divisionId)
      .filter((id): id is string => id !== null)

    const removedDivisionIds = removedRegistrations
      .map((r) => r.divisionId)
      .filter((id): id is string => id !== null)

    // If user has existing active registrations, fetch their previous answers and waiver signatures
    const previousAnswers: Array<{ questionId: string; answer: string }> = []
    let signedWaiverIds: string[] = []

    if (activeRegistrations.length > 0) {
      const registrationIds = activeRegistrations.map((r) => r.id)

      // Fetch answers from any previous registration (they're the same across divisions)
      const answers =
        await db.query.competitionRegistrationAnswersTable.findMany({
          where: and(
            eq(competitionRegistrationAnswersTable.userId, data.userId),
            inArray(
              competitionRegistrationAnswersTable.registrationId,
              registrationIds,
            ),
          ),
          columns: { questionId: true, answer: true },
        })

      // Dedupe by questionId (take first answer found)
      const seen = new Set<string>()
      for (const a of answers) {
        if (!seen.has(a.questionId)) {
          seen.add(a.questionId)
          previousAnswers.push({
            questionId: a.questionId,
            answer: a.answer,
          })
        }
      }

      // Fetch waiver signatures for this user on waivers from this competition's registrations
      const signatures = await db.query.waiverSignaturesTable.findMany({
        where: eq(waiverSignaturesTable.userId, data.userId),
        columns: { waiverId: true },
      })
      signedWaiverIds = [...new Set(signatures.map((s) => s.waiverId))]
    }

    return {
      registrations: activeRegistrations,
      registeredDivisionIds,
      removedDivisionIds,
      previousAnswers,
      signedWaiverIds,
    }
  })

// Server function to get scaling group with levels (avoids client-side db import)
const getScalingGroupWithLevelsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ scalingGroupId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { getDb } = await import("@/db")
    const db = getDb()
    const scalingGroup = await db.query.scalingGroupsTable.findFirst({
      where: eq(scalingGroupsTable.id, data.scalingGroupId),
      with: {
        scalingLevels: {
          orderBy: (table, { asc }) => [asc(table.position)],
        },
      },
    })

    return { scalingGroup }
  })

// Server function to get user's profile info for registration
const getUserProfileFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { getDb } = await import("@/db")
    const db = getDb()
    const user = await db.query.userTable.findFirst({
      where: eq(userTable.id, data.userId),
      columns: {
        affiliateName: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    })

    return {
      affiliateName: user?.affiliateName ?? null,
      firstName: user?.firstName ?? null,
      lastName: user?.lastName ?? null,
      email: user?.email ?? null,
    }
  })

export const Route = createFileRoute("/compete/$slug/register")({
  component: RegisterPage,
  validateSearch: registerSearchSchema,
  staleTime: 10_000, // Cache for 10 seconds
  loaderDeps: ({ search }) => ({
    canceled: search.canceled,
    divisionId: search.divisionId,
  }),
  loader: async ({ params, context, deps, parentMatchPromise }) => {
    const { slug } = params
    const { canceled, divisionId: invitedDivisionId } = deps

    // 1. Get competition from parent (parent already validated it's non-null)
    const parentMatch = await parentMatchPromise
    const competition = parentMatch.loaderData?.competition
    if (!competition) {
      throw notFound()
    }

    // 2. Check authentication
    const session = context.session ?? null
    if (!session) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: `/compete/${slug}/register` },
      })
    }

    // 2.5. If user canceled from Stripe, release their reservation immediately
    if (canceled === "true") {
      await cancelPendingPurchaseFn({
        data: {
          userId: session.userId,
          competitionId: competition.id,
        },
      })
    }

    // 3. Parallel fetch: existing registrations, affiliate name, waivers, and questions
    const [
      {
        registeredDivisionIds,
        removedDivisionIds,
        previousAnswers,
        signedWaiverIds,
      },
      userProfile,
      { waivers },
      { questions },
    ] = await Promise.all([
      getUserCompetitionRegistrationsFn({
        data: {
          competitionId: competition.id,
          userId: session.userId,
        },
      }),
      getUserProfileFn({
        data: { userId: session.userId },
      }),
      getCompetitionWaiversFn({
        data: { competitionId: competition.id },
      }),
      getCompetitionQuestionsFn({
        data: { competitionId: competition.id },
      }),
    ])

    // Invite-flow short-circuit: if the URL specifies a division (the claim
    // CTA always does) and the athlete already has an active registration in
    // that division, send them to the registered confirmation page instead
    // of stranding them on the registration form. Mirrors the claim route's
    // `already_paid` redirect — covers the post-Stripe-success bounce-back
    // and any later return visit to the original claim/register URL.
    if (
      invitedDivisionId &&
      registeredDivisionIds.includes(invitedDivisionId)
    ) {
      throw redirect({
        to: "/compete/$slug/registered",
        params: { slug },
        search: { session_id: undefined, registration_id: undefined },
      })
    }

    // For public flow we deliberately do NOT redirect when registered —
    // allow registration for additional divisions.

    // 4. Check registration window (dates are now YYYY-MM-DD strings)
    const now = new Date()
    const todayStr = getLocalDateKey(now)
    const regOpensAt = competition.registrationOpensAt
    const regClosesAt = competition.registrationClosesAt

    // String comparison works for YYYY-MM-DD format
    const registrationOpen = !!(
      regOpensAt &&
      regClosesAt &&
      todayStr >= regOpensAt &&
      todayStr <= regClosesAt
    )

    // 5. Get competition settings for divisions
    const settings = parseCompetitionSettings(competition.settings)
    if (!settings?.divisions?.scalingGroupId) {
      // No divisions configured - will show error in component
      return {
        competition,
        scalingGroup: null,
        publicDivisions: [],
        competitionCapacity: null,
        userId: session.userId,
        registrationOpen,
        registrationOpensAt: regOpensAt,
        registrationClosesAt: regClosesAt,
        defaultAffiliateName: undefined,
        divisionsConfigured: false,
        waivers: [],
        questions: [],
        registeredDivisionIds: [],
        removedDivisionIds: [],
        previousAnswers: [],
        signedWaiverIds: [],
      }
    }

    // 6. Get scaling group and levels for divisions (via server function)
    // Also get public divisions for capacity info
    const [
      { scalingGroup },
      { divisions: publicDivisions, competitionCapacity },
    ] = await Promise.all([
      getScalingGroupWithLevelsFn({
        data: { scalingGroupId: settings.divisions.scalingGroupId },
      }),
      getPublicCompetitionDivisionsFn({
        data: { competitionId: competition.id },
      }),
    ])

    if (
      !scalingGroup ||
      !scalingGroup.scalingLevels ||
      scalingGroup.scalingLevels.length === 0
    ) {
      // Divisions not properly configured - will show error in component
      return {
        competition,
        scalingGroup: null,
        publicDivisions: [],
        competitionCapacity: null,
        userId: session.userId,
        registrationOpen,
        registrationOpensAt: regOpensAt,
        registrationClosesAt: regClosesAt,
        defaultAffiliateName: undefined,
        divisionsConfigured: false,
        waivers: [],
        questions: [],
        registeredDivisionIds: [],
        removedDivisionIds: [],
        previousAnswers: [],
        signedWaiverIds: [],
      }
    }

    return {
      competition,
      scalingGroup,
      publicDivisions,
      competitionCapacity: competitionCapacity ?? null,
      userId: session.userId,
      registrationOpen,
      registrationOpensAt: regOpensAt,
      registrationClosesAt: regClosesAt,
      defaultAffiliateName: userProfile.affiliateName ?? undefined,
      divisionsConfigured: true,
      waivers,
      questions,
      userFirstName: userProfile.firstName,
      userLastName: userProfile.lastName,
      userEmail: userProfile.email,
      registeredDivisionIds,
      removedDivisionIds,
      previousAnswers,
      signedWaiverIds,
    }
  },
})

function RegisterPage() {
  const {
    competition,
    scalingGroup,
    publicDivisions,
    competitionCapacity,
    userId,
    registrationOpen,
    registrationOpensAt,
    registrationClosesAt,
    defaultAffiliateName,
    divisionsConfigured,
    waivers,
    questions,
    userFirstName,
    userLastName,
    userEmail,
    registeredDivisionIds,
    removedDivisionIds,
    previousAnswers,
    signedWaiverIds,
  } = Route.useLoaderData()

  const {
    canceled,
    divisionId: initialDivisionId,
    invite: inviteToken,
  } = Route.useSearch()

  // Show error if divisions are not configured
  if (!divisionsConfigured || !scalingGroup) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="bg-destructive/10 rounded-lg border border-destructive/20 p-6">
          <h1 className="text-2xl font-bold mb-2">
            Registration Not Available
          </h1>
          <p>
            {!divisionsConfigured
              ? "This competition does not have divisions configured yet."
              : "This competition's divisions are not properly configured."}
          </p>
        </div>
      </div>
    )
  }

  // Variant dispatch: presence of `?divisionId=...` (the only producer is the
  // claim CTA) routes the athlete into the invite-aware variant. The server
  // is the actual authority — it looks up the active pending invite for
  // (session email, competition, division) and bypasses the public window if
  // one exists, regardless of whether the URL also carried `?invite=<token>`.
  // The token is decoration; the database invite row is the source of truth.
  const sharedProps = {
    competition,
    scalingGroup,
    publicDivisions,
    competitionCapacity,
    userId,
    registrationOpensAt,
    registrationClosesAt,
    paymentCanceled: canceled === "true",
    defaultAffiliateName,
    waivers,
    questions,
    userFirstName,
    userLastName,
    userEmail,
    registeredDivisionIds,
    removedDivisionIds,
    previousAnswers,
    signedWaiverIds,
  }

  return (
    <div className="mx-auto max-w-2xl">
      {initialDivisionId ? (
        <InviteRegistrationForm
          {...sharedProps}
          initialDivisionId={initialDivisionId}
          inviteToken={inviteToken}
        />
      ) : (
        <PublicRegistrationForm
          {...sharedProps}
          registrationOpen={registrationOpen}
        />
      )}
    </div>
  )
}
