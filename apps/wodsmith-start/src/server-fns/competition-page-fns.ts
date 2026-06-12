/**
 * Consolidated Competition Page Server Functions
 *
 * The public /compete/$slug layout loader used to fan out up to 10 server-fn
 * HTTP requests across 3 sequential waves. These two functions collapse that
 * into exactly 2 parallel calls:
 *
 * - getPublicCompetitionPageDataFn: everything anonymous visitors need
 *   (competition, divisions, capacity, sponsors, judges-schedule flag, appUrl)
 * - getViewerCompetitionContextFn: everything session-specific
 *   (registrations, pending invites, cohost permissions)
 *
 * Both take the slug so the loader can fire them fully in parallel — each
 * resolves slug -> competition independently (one extra cheap indexed lookup
 * beats a serial HTTP wave).
 */

import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { competitionsTable } from "@/db/schemas/competitions"
import { getAppUrl } from "@/lib/env"
import { cohostGetPermissionsFn } from "@/server-fns/cohost/cohost-competition-fns"
import {
  getPendingTeamInvitesForEmail,
  getUserCompetitionRegistrationsForUser,
} from "@/server-fns/competition-detail-fns"
import {
  getPublicCompetitionDivisionsForCompetition,
  type PublicCompetitionDivision,
} from "@/server-fns/competition-divisions-fns"
import { getCompetitionBySlugFn } from "@/server-fns/competition-fns"
import { listMyPendingCompetitionInvitesFn } from "@/server-fns/competition-invite-fns"
import { hasJudgesScheduleFn } from "@/server-fns/judge-scheduling-fns"
import {
  type CompetitionSponsorsResult,
  getCompetitionSponsorsFn,
} from "@/server-fns/sponsor-fns"
import { getSessionFromCookie } from "@/utils/auth"

// ============================================================================
// Input Schemas
// ============================================================================

const competitionPageInputSchema = z.object({
  slug: z.string().min(1, "Slug is required"),
})

// ============================================================================
// Public page data (no session)
// ============================================================================

/**
 * Get all public data for the /compete/$slug layout in a single round trip.
 * Fully public — no session read. The competition is fetched once and the
 * remaining branches fan out in parallel, each on its own DB connection
 * (a single mysql2 connection serializes commands on the wire).
 */
export const getPublicCompetitionPageDataFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => competitionPageInputSchema.parse(data))
  .handler(async ({ data }) => {
    const appUrl = getAppUrl()

    const { competition } = await getCompetitionBySlugFn({
      data: { slug: data.slug },
    })

    if (!competition) {
      return {
        competition: null,
        divisions: [] as PublicCompetitionDivision[],
        competitionCapacity: null,
        sponsors: {
          groups: [],
          ungroupedSponsors: [],
        } as CompetitionSponsorsResult,
        hasJudgesSchedule: false,
        appUrl,
      }
    }

    // Fan out in parallel. The in-process server fns each call getDb()
    // internally, and the divisions helper opens its own connections, so
    // these run concurrently on the wire.
    const [divisionsResult, sponsors, judgesScheduleResult] = await Promise.all(
      [
        getPublicCompetitionDivisionsForCompetition({ competition }),
        getCompetitionSponsorsFn({
          data: { competitionId: competition.id },
        }),
        hasJudgesScheduleFn({
          data: { competitionId: competition.id },
        }),
      ],
    )

    return {
      competition,
      divisions: divisionsResult.divisions,
      competitionCapacity: divisionsResult.competitionCapacity,
      sponsors,
      hasJudgesSchedule: judgesScheduleResult.hasSchedule,
      appUrl,
    }
  })

// ============================================================================
// Viewer (session) context
// ============================================================================

/**
 * Get the signed-in viewer's context for the /compete/$slug layout in a
 * single round trip: their registrations, pending teammate invites, pending
 * competition invites, and cohost permissions.
 *
 * Reads the session ONCE; anonymous viewers get empty stubs without touching
 * the database. The userId is always session-derived — never client input.
 */
export const getViewerCompetitionContextFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => competitionPageInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      return {
        registrations: [],
        pendingTeamInvites: [],
        pendingCompetitionInvites: [],
        cohostPermissions: null,
      }
    }

    // Cheap indexed slug lookup — duplicated with the public page fn by
    // design so the two loader calls stay fully parallel.
    const db = getDb()
    const [competition] = await db
      .select({
        id: competitionsTable.id,
        competitionTeamId: competitionsTable.competitionTeamId,
      })
      .from(competitionsTable)
      .where(eq(competitionsTable.slug, data.slug))
      .limit(1)

    if (!competition) {
      return {
        registrations: [],
        pendingTeamInvites: [],
        pendingCompetitionInvites: [],
        cohostPermissions: null,
      }
    }

    // Fan out in parallel — each branch uses its own DB connection(s).
    const [
      registrationsResult,
      teamInvitesResult,
      competitionInvitesResult,
      cohostPermissions,
    ] = await Promise.all([
      getUserCompetitionRegistrationsForUser({
        competitionId: competition.id,
        userId: session.userId,
      }),
      session.user?.email
        ? getPendingTeamInvitesForEmail({
            competitionId: competition.id,
            email: session.user.email.toLowerCase(),
          })
        : Promise.resolve({ invitations: [] }),
      listMyPendingCompetitionInvitesFn({
        data: { championshipCompetitionId: competition.id },
      }),
      competition.competitionTeamId
        ? cohostGetPermissionsFn({
            data: { competitionTeamId: competition.competitionTeamId },
          }).catch(() => null)
        : Promise.resolve(null),
    ])

    return {
      registrations: registrationsResult.registrations,
      pendingTeamInvites: teamInvitesResult.invitations,
      pendingCompetitionInvites: competitionInvitesResult.invites,
      cohostPermissions,
    }
  })
