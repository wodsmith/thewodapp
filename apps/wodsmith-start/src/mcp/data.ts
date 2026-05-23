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
import {
  SYSTEM_ROLES_ENUM,
  TEAM_PERMISSIONS,
  teamRoleTable,
  teamTable,
} from "@/db/schemas/teams"
import { ROLES_ENUM, userTable } from "@/db/schemas/users"

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
 * "Organizes" matches the app's organizer surfaces: site admins can see all
 * competitions, and team users need an active membership with
 * `manage_competitions` permission on the organizing team.
 */
export async function listOrganizerCompetitionsForUser(
  userId: string,
): Promise<McpCompetitionSummary[]> {
  const db = getDb()

  const teamIds = await listOrganizerTeamIdsForUser(userId)
  if (teamIds === "all") {
    const rows = await db
      .select(competitionColumns)
      .from(competitionsTable)
      .leftJoin(teamTable, eq(competitionsTable.organizingTeamId, teamTable.id))
      .orderBy(desc(competitionsTable.startDate))

    return rows.map(toSummary)
  }
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

  const teamIds = await listOrganizerTeamIdsForUser(userId)
  if (teamIds !== "all" && teamIds.length === 0) return null

  const rows = await db
    .select(competitionColumns)
    .from(competitionsTable)
    .leftJoin(teamTable, eq(competitionsTable.organizingTeamId, teamTable.id))
    .where(eq(competitionsTable.slug, slug))
    .limit(1)

  const row = rows[0]
  if (!row) return null
  if (teamIds !== "all" && !teamIds.includes(row.organizingTeamId)) return null
  return toSummary(row)
}

type OrganizerTeamIds = "all" | string[]

async function listOrganizerTeamIdsForUser(
  userId: string,
): Promise<OrganizerTeamIds> {
  const db = getDb()

  const user = await db.query.userTable.findFirst({
    where: eq(userTable.id, userId),
    columns: { role: true },
  })
  if (user?.role === ROLES_ENUM.ADMIN) return "all"

  const memberships = await db.query.teamMembershipTable.findMany({
    where: (m, { and: andOp, eq: eqOp }) =>
      andOp(eqOp(m.userId, userId), eqOp(m.isActive, true)),
    columns: {
      teamId: true,
      roleId: true,
      isSystemRole: true,
    },
  })
  if (memberships.length === 0) return []

  const organizerTeamIds = new Set<string>()
  const customRoleIds = memberships
    .filter((m) => !m.isSystemRole)
    .map((m) => m.roleId)

  const customRoles =
    customRoleIds.length > 0
      ? await db.query.teamRoleTable.findMany({
          where: inArray(teamRoleTable.id, customRoleIds),
          columns: {
            id: true,
            permissions: true,
          },
        })
      : []
  const customRolePermissions = new Map(
    customRoles.map((role) => [role.id, role.permissions]),
  )

  for (const membership of memberships) {
    if (
      membership.isSystemRole &&
      (membership.roleId === SYSTEM_ROLES_ENUM.OWNER ||
        membership.roleId === SYSTEM_ROLES_ENUM.ADMIN)
    ) {
      organizerTeamIds.add(membership.teamId)
      continue
    }

    if (!membership.isSystemRole) {
      const permissions = customRolePermissions.get(membership.roleId) ?? []
      if (permissions.includes(TEAM_PERMISSIONS.MANAGE_COMPETITIONS)) {
        organizerTeamIds.add(membership.teamId)
      }
    }
  }

  return [...organizerTeamIds]
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
