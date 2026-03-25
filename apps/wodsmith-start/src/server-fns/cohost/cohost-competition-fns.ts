/**
 * Cohost Competition Detail Server Functions
 * Mirrors competition-detail-fns.ts with cohost auth.
 * READ operations + safe WRITEs a cohost needs for the dashboard.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, count, eq, ne, sql } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { addressesTable } from "@/db/schemas/addresses"
import {
  competitionRegistrationsTable,
  competitionsTable,
  REGISTRATION_STATUS,
} from "@/db/schemas/competitions"
import { teamMembershipTable } from "@/db/schemas/teams"
import { getCohostPermissions } from "@/server/cohost"
import { getSessionFromCookie } from "@/utils/auth"
import { requireCohostPermission } from "@/utils/cohost-auth"

// ============================================================================
// Get Cohost Permissions (server function wrapper)
// ============================================================================

/**
 * Server function to fetch cohost permissions from DB.
 * Used by the layout route to avoid importing server-only code on the client.
 */
export const cohostGetPermissionsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        competitionTeamId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session) return null
    return getCohostPermissions(session, data.competitionTeamId)
  })

// ============================================================================
// Input Schemas
// ============================================================================

const cohostCompetitionInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
})

const cohostRegistrationCountInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
})

const cohostRegistrationsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  divisionFilter: z.string().optional(),
})

const cohostRotationSettingsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  defaultHeatsPerRotation: z.number().int().min(1).max(10).optional(),
  defaultLaneShiftPattern: z.enum(["stay", "shift_right"]).optional(),
})

const cohostScoringConfigInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  scoringConfig: z.object({
    algorithm: z.enum([
      "traditional",
      "p_score",
      "winner_takes_more",
      "online",
      "custom",
    ]),
    traditional: z
      .object({
        step: z.number().positive(),
        firstPlacePoints: z.number().positive(),
      })
      .optional(),
    pScore: z
      .object({
        allowNegatives: z.boolean(),
        medianField: z.enum(["top_half", "all"]),
      })
      .optional(),
    customTable: z
      .object({
        baseTemplate: z.enum(["traditional", "p_score", "winner_takes_more"]),
        overrides: z.record(z.string(), z.number()),
      })
      .optional(),
    tiebreaker: z.object({
      primary: z.enum(["countback", "head_to_head", "none"]),
      secondary: z.enum(["countback", "head_to_head", "none"]).optional(),
      headToHeadEventId: z.string().optional(),
    }),
    statusHandling: z.object({
      dnf: z.enum(["worst_performance", "zero", "last_place"]),
      dns: z.enum(["worst_performance", "zero", "exclude"]),
      withdrawn: z.enum(["zero", "exclude"]),
    }),
  }),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get competition details (cohost view)
 */
export const cohostGetCompetitionByIdFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => cohostCompetitionInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId)
    const db = getDb()

    const result = await db
      .select({
        id: competitionsTable.id,
        organizingTeamId: competitionsTable.organizingTeamId,
        competitionTeamId: competitionsTable.competitionTeamId,
        groupId: competitionsTable.groupId,
        slug: competitionsTable.slug,
        name: competitionsTable.name,
        description: competitionsTable.description,
        startDate: competitionsTable.startDate,
        endDate: competitionsTable.endDate,
        registrationOpensAt: competitionsTable.registrationOpensAt,
        registrationClosesAt: competitionsTable.registrationClosesAt,
        timezone: competitionsTable.timezone,
        settings: competitionsTable.settings,
        defaultRegistrationFeeCents:
          competitionsTable.defaultRegistrationFeeCents,
        platformFeePercentage: competitionsTable.platformFeePercentage,
        platformFeeFixed: competitionsTable.platformFeeFixed,
        passStripeFeesToCustomer: competitionsTable.passStripeFeesToCustomer,
        passPlatformFeesToCustomer:
          competitionsTable.passPlatformFeesToCustomer,
        visibility: competitionsTable.visibility,
        status: competitionsTable.status,
        competitionType: competitionsTable.competitionType,
        profileImageUrl: competitionsTable.profileImageUrl,
        bannerImageUrl: competitionsTable.bannerImageUrl,
        defaultHeatsPerRotation: competitionsTable.defaultHeatsPerRotation,
        defaultLaneShiftPattern: competitionsTable.defaultLaneShiftPattern,
        defaultMaxSpotsPerDivision:
          competitionsTable.defaultMaxSpotsPerDivision,
        maxTotalRegistrations: competitionsTable.maxTotalRegistrations,
        primaryAddressId: competitionsTable.primaryAddressId,
        createdAt: competitionsTable.createdAt,
        updatedAt: competitionsTable.updatedAt,
        updateCounter: competitionsTable.updateCounter,
        // Address fields
        addressName: addressesTable.name,
        addressStreetLine1: addressesTable.streetLine1,
        addressStreetLine2: addressesTable.streetLine2,
        addressCity: addressesTable.city,
        addressStateProvince: addressesTable.stateProvince,
        addressPostalCode: addressesTable.postalCode,
        addressCountryCode: addressesTable.countryCode,
        addressNotes: addressesTable.notes,
      })
      .from(competitionsTable)
      .leftJoin(
        addressesTable,
        eq(competitionsTable.primaryAddressId, addressesTable.id),
      )
      .where(eq(competitionsTable.id, data.competitionId))
      .limit(1)

    if (!result[0]) {
      return { competition: null }
    }

    const {
      addressName,
      addressStreetLine1,
      addressStreetLine2,
      addressCity,
      addressStateProvince,
      addressPostalCode,
      addressCountryCode,
      addressNotes,
      ...competition
    } = result[0]

    const primaryAddress = competition.primaryAddressId
      ? {
          name: addressName,
          streetLine1: addressStreetLine1,
          streetLine2: addressStreetLine2,
          city: addressCity,
          stateProvince: addressStateProvince,
          postalCode: addressPostalCode,
          countryCode: addressCountryCode,
          notes: addressNotes,
        }
      : null

    return { competition: { ...competition, primaryAddress } }
  })

/**
 * Get registration count (cohost view)
 */
export const cohostGetRegistrationCountFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    cohostRegistrationCountInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId)
    const db = getDb()

    const result = await db
      .select({ count: count() })
      .from(competitionRegistrationsTable)
      .where(
        and(
          eq(competitionRegistrationsTable.eventId, data.competitionId),
          ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
        ),
      )

    return { count: result[0]?.count ?? 0 }
  })

/**
 * Get registrations for cohost organizer view with full user and division details
 */
export const cohostGetRegistrationsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    cohostRegistrationsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId)
    const db = getDb()

    const whereConditions = [
      eq(competitionRegistrationsTable.eventId, data.competitionId),
    ]

    const registrations = await db.query.competitionRegistrationsTable.findMany(
      {
        where: and(...whereConditions),
        orderBy: (table, { desc }) => [desc(table.registeredAt)],
        with: {
          user: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
              gender: true,
              dateOfBirth: true,
              affiliateName: true,
            },
          },
          division: {
            columns: {
              id: true,
              label: true,
              teamSize: true,
            },
          },
          athleteTeam: {
            with: {
              memberships: {
                columns: {
                  id: true,
                  userId: true,
                  joinedAt: true,
                },
                where: eq(teamMembershipTable.isActive, true),
                with: {
                  user: {
                    columns: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      avatar: true,
                      affiliateName: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    )

    const filteredRegistrations = data.divisionFilter
      ? registrations.filter((r) => r.divisionId === data.divisionFilter)
      : registrations

    return { registrations: filteredRegistrations }
  })

/**
 * Update competition rotation settings (cohost — requires volunteers)
 */
export const cohostUpdateRotationSettingsFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    cohostRotationSettingsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "volunteers")
    const db = getDb()

    await db
      .update(competitionsTable)
      .set({
        defaultHeatsPerRotation: data.defaultHeatsPerRotation,
        defaultLaneShiftPattern: data.defaultLaneShiftPattern as
          | "stay"
          | "shift_right"
          | undefined,
        updatedAt: new Date(),
      })
      .where(eq(competitionsTable.id, data.competitionId))

    return { success: true }
  })

/**
 * Update competition scoring configuration (cohost — requires scoring)
 */
export const cohostUpdateScoringConfigFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostScoringConfigInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "scoring")
    const db = getDb()

    const competition = await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
    })
    if (!competition) throw new Error("Competition not found")

    let existingSettings: Record<string, unknown> = {}
    if (competition.settings) {
      try {
        existingSettings = JSON.parse(competition.settings)
      } catch {
        // Ignore parse errors
      }
    }

    const newSettings = {
      ...existingSettings,
      scoringConfig: data.scoringConfig,
    }

    await db
      .update(competitionsTable)
      .set({
        settings: JSON.stringify(newSettings),
        updatedAt: new Date(),
      })
      .where(eq(competitionsTable.id, data.competitionId))

    return { success: true }
  })
