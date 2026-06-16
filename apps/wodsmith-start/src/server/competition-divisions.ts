/**
 * Public competition divisions helpers (server-only).
 *
 * Lives in src/server so server fns can share the query logic without the
 * helper being an exported plain function inside a server-fn module — those
 * survive the client compile and would drag `@/db` (and its
 * `cloudflare:workers` import) into the browser bundle.
 */

import "server-only"

import { and, eq, gt, ne, sql } from "drizzle-orm"
import { getDb } from "@/db"
import {
  COMMERCE_PURCHASE_STATUS,
  commercePurchaseTable,
  competitionDivisionsTable,
} from "@/db/schemas/commerce"
import {
  competitionRegistrationsTable,
  REGISTRATION_STATUS,
} from "@/db/schemas/competitions"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { calculateCompetitionCapacity } from "@/utils/competition-capacity"
import {
  PENDING_PURCHASE_MAX_AGE_MINUTES,
  parseCompetitionSettings,
  type PublicCompetitionDivision,
  type PublicDivisionsCompetitionInput,
} from "@/utils/competition-settings"
import { calculateDivisionCapacity } from "@/utils/division-capacity"

/**
 * Compute public divisions + capacity for an already-loaded competition row.
 * Lets consolidated server fns (which already fetched the competition) skip
 * the duplicate competition fetch.
 *
 * The two queries are independent, so each runs on its own connection for
 * true wire parallelism (a single mysql2 connection serializes commands).
 */
export async function getPublicCompetitionDivisionsForCompetition({
  competition,
}: {
  competition: PublicDivisionsCompetitionInput
}): Promise<{
  divisions: PublicCompetitionDivision[]
  competitionCapacity: ReturnType<typeof calculateCompetitionCapacity> | null
}> {
  const settings = parseCompetitionSettings(competition.settings)
  const scalingGroupId = settings?.divisions?.scalingGroupId

  if (!scalingGroupId) {
    return { divisions: [], competitionCapacity: null }
  }

  const db = getDb()
  const pendingDb = getDb()
  const capacityDb = getDb()

  // Get divisions with descriptions, registration counts, and capacity
  // Also get pending purchases (reservations) separately to avoid double-counting in joins
  const [divisions, pendingByDivision, totalConfirmedRows] = await Promise.all([
    db
      .select({
        id: scalingLevelsTable.id,
        label: scalingLevelsTable.label,
        teamSize: scalingLevelsTable.teamSize,
        description: competitionDivisionsTable.description,
        feeCents: competitionDivisionsTable.feeCents,
        maxSpots: competitionDivisionsTable.maxSpots,
        registrationCount: sql<number>`cast(count(${competitionRegistrationsTable.id}) as unsigned)`,
      })
      .from(scalingLevelsTable)
      .leftJoin(
        competitionDivisionsTable,
        and(
          eq(competitionDivisionsTable.divisionId, scalingLevelsTable.id),
          eq(competitionDivisionsTable.competitionId, competition.id),
        ),
      )
      .leftJoin(
        competitionRegistrationsTable,
        and(
          eq(competitionRegistrationsTable.divisionId, scalingLevelsTable.id),
          eq(competitionRegistrationsTable.eventId, competition.id),
          ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
        ),
      )
      .where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))
      .groupBy(
        scalingLevelsTable.id,
        competitionDivisionsTable.description,
        competitionDivisionsTable.feeCents,
        competitionDivisionsTable.maxSpots,
      )
      .orderBy(scalingLevelsTable.position),
    // Count pending purchases (reservations) per division
    // Only count recent ones — Stripe sessions expire after 30 min
    pendingDb
      .select({
        divisionId: commercePurchaseTable.divisionId,
        pendingCount: sql<number>`cast(count(*) as unsigned)`,
      })
      .from(commercePurchaseTable)
      .where(
        and(
          eq(commercePurchaseTable.competitionId, competition.id),
          eq(commercePurchaseTable.status, COMMERCE_PURCHASE_STATUS.PENDING),
          gt(
            commercePurchaseTable.createdAt,
            new Date(Date.now() - PENDING_PURCHASE_MAX_AGE_MINUTES * 60 * 1000),
          ),
        ),
      )
      .groupBy(commercePurchaseTable.divisionId),
    competition.maxTotalRegistrations != null
      ? capacityDb
          .select({
            registrationCount: sql<number>`cast(count(${competitionRegistrationsTable.id}) as unsigned)`,
          })
          .from(competitionRegistrationsTable)
          .where(
            and(
              eq(competitionRegistrationsTable.eventId, competition.id),
              ne(
                competitionRegistrationsTable.status,
                REGISTRATION_STATUS.REMOVED,
              ),
            ),
          )
      : Promise.resolve([] as Array<{ registrationCount: number }>),
  ])

  // Create lookup map for pending counts
  const pendingCountMap = new Map(
    pendingByDivision.map((p) => [p.divisionId, p.pendingCount]),
  )

  // Apply defaults from competition and calculate capacity (including reservations)
  const result: PublicCompetitionDivision[] = divisions.map((d) => {
    const capacity = calculateDivisionCapacity({
      registrationCount: d.registrationCount,
      pendingCount: pendingCountMap.get(d.id) ?? 0,
      divisionMaxSpots: d.maxSpots,
      competitionDefaultMax: competition.defaultMaxSpotsPerDivision,
    })
    return {
      id: d.id,
      label: d.label,
      description: d.description ?? null,
      registrationCount: d.registrationCount,
      feeCents: d.feeCents ?? competition.defaultRegistrationFeeCents ?? 0,
      teamSize: d.teamSize,
      maxSpots: capacity.effectiveMax,
      spotsAvailable: capacity.spotsAvailable,
      isFull: capacity.isFull,
    }
  })

  // Competition-wide capacity (only when a cap is set)
  let competitionCapacity: ReturnType<
    typeof calculateCompetitionCapacity
  > | null = null
  if (competition.maxTotalRegistrations != null) {
    const totalConfirmed = Number(totalConfirmedRows[0]?.registrationCount ?? 0)
    const totalPending = pendingByDivision.reduce(
      (sum, p) => sum + Number(p.pendingCount),
      0,
    )
    competitionCapacity = calculateCompetitionCapacity({
      registrationCount: totalConfirmed,
      pendingCount: totalPending,
      maxTotalRegistrations: competition.maxTotalRegistrations,
    })
  }

  return { divisions: result, competitionCapacity }
}
