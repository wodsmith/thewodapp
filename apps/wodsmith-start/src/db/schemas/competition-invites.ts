/**
 * Competition Invites Schema
 *
 * Tables powering ADR-0011 "Competition Invites" — the organizer-facing
 * qualification-source → roster → invite-round system.
 *
 * This file starts in Phase 1 with just `competition_invite_sources`, which
 * declares where a championship competition draws its invitees from
 * (another single competition, or a series). Later phases add rounds,
 * per-athlete invites, and email templates.
 */
// @lat: [[competition-invites#Sources schema]]

import type { InferSelectModel } from "drizzle-orm"
import {
  index,
  int,
  mysqlTable,
  text,
  varchar,
} from "drizzle-orm/mysql-core"
import { commonColumns, createCompetitionInviteSourceId } from "./common"

// ============================================================================
// Source Kinds
// ============================================================================

export const COMPETITION_INVITE_SOURCE_KIND = {
  COMPETITION: "competition",
  SERIES: "series",
} as const

export type CompetitionInviteSourceKind =
  (typeof COMPETITION_INVITE_SOURCE_KIND)[keyof typeof COMPETITION_INVITE_SOURCE_KIND]

// ============================================================================
// Competition Invite Sources
// ============================================================================

/**
 * A qualification source attached to a championship competition. Exactly one
 * of `sourceCompetitionId` / `sourceGroupId` is non-null — the `kind`
 * discriminator indicates which. Spot allocations describe how many invitees
 * this source contributes to the championship.
 *
 * Write-time constraints are enforced in helpers, not the DB, to match
 * PlanetScale conventions (no FKs).
 */
export const competitionInviteSourcesTable = mysqlTable(
  "competition_invite_sources",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCompetitionInviteSourceId())
      .notNull(),
    // The competition receiving invites from this source.
    championshipCompetitionId: varchar({ length: 255 }).notNull(),
    // "competition" | "series"
    kind: varchar({ length: 20 })
      .$type<CompetitionInviteSourceKind>()
      .notNull(),
    // When kind = "competition".
    sourceCompetitionId: varchar({ length: 255 }),
    // When kind = "series". Logical reference to competitionGroupsTable.id.
    sourceGroupId: varchar({ length: 255 }),
    // For series: how many top-N per comp in the series get a direct slot.
    directSpotsPerComp: int(),
    // For series: how many additional spots come from the global leaderboard.
    // For single-comp: the total top-N that qualifies.
    globalSpots: int(),
    // JSON: [{ sourceDivisionId, championshipDivisionId, spots? }]
    divisionMappings: text(),
    // Display order of sources in the organizer sources tab.
    sortOrder: int().default(0).notNull(),
    // Organizer-visible free-text note about this source.
    notes: text(),
  },
  (table) => [
    index("competition_invite_sources_championship_sort_idx").on(
      table.championshipCompetitionId,
      table.sortOrder,
    ),
    index("competition_invite_sources_source_competition_idx").on(
      table.sourceCompetitionId,
    ),
    index("competition_invite_sources_source_group_idx").on(
      table.sourceGroupId,
    ),
  ],
)

export type CompetitionInviteSource = InferSelectModel<
  typeof competitionInviteSourcesTable
>
