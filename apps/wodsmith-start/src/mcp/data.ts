/**
 * Data access for the MCP server.
 *
 * Tight, MCP-shaped queries — small selected columns, no UI-only fields. These
 * are intentionally separate from the regular server functions to keep the
 * MCP payload stable across UI refactors.
 */

import "server-only"
import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import { competitionsTable } from "@/db/schemas/competitions"
import { teamTable } from "@/db/schemas/teams"

/**
 * Subset of competition fields that the MCP server exposes to clients. The
 * shape is intentionally narrow so it stays stable for tool consumers.
 */
export interface McpCompetitionSummary {
  id: string
  slug: string
  name: string
  description: string | null
  startDate: string
  endDate: string
  registrationOpensAt: string | null
  registrationClosesAt: string | null
  timezone: string | null
  visibility: "public" | "private"
  status: "draft" | "published"
  competitionType: "in-person" | "online"
  profileImageUrl: string | null
  bannerImageUrl: string | null
  organizingTeamId: string
  organizingTeamName: string | null
  organizingTeamSlug: string | null
}

const competitionColumns = {
  id: competitionsTable.id,
  slug: competitionsTable.slug,
  name: competitionsTable.name,
  description: competitionsTable.description,
  startDate: competitionsTable.startDate,
  endDate: competitionsTable.endDate,
  registrationOpensAt: competitionsTable.registrationOpensAt,
  registrationClosesAt: competitionsTable.registrationClosesAt,
  timezone: competitionsTable.timezone,
  visibility: competitionsTable.visibility,
  status: competitionsTable.status,
  competitionType: competitionsTable.competitionType,
  profileImageUrl: competitionsTable.profileImageUrl,
  bannerImageUrl: competitionsTable.bannerImageUrl,
  organizingTeamId: competitionsTable.organizingTeamId,
  organizingTeamName: teamTable.name,
  organizingTeamSlug: teamTable.slug,
}

/**
 * Public competitions: published + public visibility, ordered by start date.
 * Available to unauthenticated MCP clients.
 */
export async function listPublicCompetitions(): Promise<
  McpCompetitionSummary[]
> {
  const db = getDb()
  const rows = await db
    .select(competitionColumns)
    .from(competitionsTable)
    .leftJoin(teamTable, eq(competitionsTable.organizingTeamId, teamTable.id))
    .where(
      and(
        eq(competitionsTable.visibility, "public"),
        eq(competitionsTable.status, "published"),
      ),
    )
    .orderBy(asc(competitionsTable.startDate))

  return rows.map(toSummary)
}

/**
 * A single public competition by slug. Returns null if it doesn't exist,
 * is private, or is not yet published.
 */
export async function getPublicCompetitionBySlug(
  slug: string,
): Promise<McpCompetitionSummary | null> {
  const db = getDb()
  const rows = await db
    .select(competitionColumns)
    .from(competitionsTable)
    .leftJoin(teamTable, eq(competitionsTable.organizingTeamId, teamTable.id))
    .where(
      and(
        eq(competitionsTable.slug, slug),
        eq(competitionsTable.visibility, "public"),
        eq(competitionsTable.status, "published"),
      ),
    )
    .limit(1)

  const row = rows[0]
  return row ? toSummary(row) : null
}

/**
 * Competitions the user organizes — any visibility, any status (draft included).
 * "Organizes" means the user is a member of the organizing team. Today we
 * approximate this by matching the user's personal team and any team they
 * belong to; for v1 we keep it permissive and just match on team membership.
 *
 * For the demo MCP server we use a simpler rule: return competitions where
 * `organizingTeamId` is in the set of teams the user belongs to.
 */
export async function listOrganizerCompetitionsForUser(
  userId: string,
): Promise<McpCompetitionSummary[]> {
  const db = getDb()

  const memberships = await db.query.teamMembershipTable.findMany({
    where: (m, { eq: eqOp }) => eqOp(m.userId, userId),
    columns: { teamId: true },
  })
  const teamIds = memberships.map((m) => m.teamId)
  if (teamIds.length === 0) return []

  const rows = await db
    .select(competitionColumns)
    .from(competitionsTable)
    .leftJoin(teamTable, eq(competitionsTable.organizingTeamId, teamTable.id))
    .where(inArray(competitionsTable.organizingTeamId, teamIds))
    .orderBy(desc(competitionsTable.startDate))

  return rows.map(toSummary)
}

/**
 * A single competition the user organizes, by slug. Returns null if the
 * competition doesn't exist or the user does not organize it.
 */
export async function getOrganizerCompetitionBySlug(
  userId: string,
  slug: string,
): Promise<McpCompetitionSummary | null> {
  const db = getDb()

  const memberships = await db.query.teamMembershipTable.findMany({
    where: (m, { eq: eqOp }) => eqOp(m.userId, userId),
    columns: { teamId: true },
  })
  const teamIds = new Set(memberships.map((m) => m.teamId))
  if (teamIds.size === 0) return null

  const rows = await db
    .select(competitionColumns)
    .from(competitionsTable)
    .leftJoin(teamTable, eq(competitionsTable.organizingTeamId, teamTable.id))
    .where(eq(competitionsTable.slug, slug))
    .limit(1)

  const row = rows[0]
  if (!row) return null
  if (!teamIds.has(row.organizingTeamId)) return null
  return toSummary(row)
}

function toSummary(
  row: {
    [K in keyof typeof competitionColumns]: unknown
  },
): McpCompetitionSummary {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    description: row.description as string | null,
    startDate: row.startDate as string,
    endDate: row.endDate as string,
    registrationOpensAt: row.registrationOpensAt as string | null,
    registrationClosesAt: row.registrationClosesAt as string | null,
    timezone: row.timezone as string | null,
    visibility: row.visibility as "public" | "private",
    status: row.status as "draft" | "published",
    competitionType: row.competitionType as "in-person" | "online",
    profileImageUrl: row.profileImageUrl as string | null,
    bannerImageUrl: row.bannerImageUrl as string | null,
    organizingTeamId: row.organizingTeamId as string,
    organizingTeamName: (row.organizingTeamName as string | null) ?? null,
    organizingTeamSlug: (row.organizingTeamSlug as string | null) ?? null,
  }
}
