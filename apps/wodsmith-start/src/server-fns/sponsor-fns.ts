/**
 * Sponsor Server Functions for TanStack Start
 */

import {createServerFn} from '@tanstack/react-start'
import {z} from 'zod'
import {asc, eq} from 'drizzle-orm'
import {getDb} from '@/db'
import {sponsorsTable, sponsorGroupsTable} from '@/db/schemas/sponsors'
import type {Sponsor, SponsorGroup} from '@/db/schemas/sponsors'

// ============================================================================
// Types
// ============================================================================

export type SponsorGroupWithSponsors = SponsorGroup & {
  sponsors: Sponsor[]
}

export type CompetitionSponsorsResult = {
  groups: SponsorGroupWithSponsors[]
  ungroupedSponsors: Sponsor[]
}

// ============================================================================
// Input Schemas
// ============================================================================

const getCompetitionSponsorsInputSchema = z.object({
  competitionId: z.string().min(1, 'Competition ID is required'),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all sponsors for a competition, organized by groups
 */
export const getCompetitionSponsorsFn = createServerFn({method: 'GET'})
  .inputValidator((data: unknown) =>
    getCompetitionSponsorsInputSchema.parse(data),
  )
  .handler(async ({data}): Promise<CompetitionSponsorsResult> => {
    const db = getDb()

    // Get all sponsor groups for this competition
    const groups = await db
      .select()
      .from(sponsorGroupsTable)
      .where(eq(sponsorGroupsTable.competitionId, data.competitionId))
      .orderBy(asc(sponsorGroupsTable.displayOrder))

    // Get all sponsors for this competition
    const sponsors = await db
      .select()
      .from(sponsorsTable)
      .where(eq(sponsorsTable.competitionId, data.competitionId))
      .orderBy(asc(sponsorsTable.displayOrder))

    // Organize sponsors by group
    const groupsWithSponsors: SponsorGroupWithSponsors[] = groups.map(
      (group) => ({
        ...group,
        sponsors: sponsors.filter((s) => s.groupId === group.id),
      }),
    )

    // Get ungrouped sponsors
    const ungroupedSponsors = sponsors.filter((s) => s.groupId === null)

    return {
      groups: groupsWithSponsors,
      ungroupedSponsors,
    }
  })
