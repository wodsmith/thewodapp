// @lat: [[crew#Department Leads]]
import { and, asc, eq, or, sql } from "drizzle-orm"
import { getDb } from "@/db"
import { createCrewDepartmentLeadId } from "@/db/schemas/common"
import { competitionsTable } from "@/db/schemas/competitions"
import {
  CREW_DEPARTMENT_LEAD_STATUS,
  crewDepartmentLeadsTable,
  type CrewDepartmentLeadStatus,
} from "@/db/schemas/crew-self-serve-presets"
import { crewEventSettingsTable } from "@/db/schemas/crew-event-settings"
import {
  SYSTEM_ROLES_ENUM,
  TEAM_PERMISSIONS,
  teamMembershipTable,
} from "@/db/schemas/teams"
import { ROLES_ENUM, userTable } from "@/db/schemas/users"
import type { VolunteerRoleType } from "@/db/schemas/volunteers"
import {
  buildCrewDepartmentLeadScopePayload,
  type CrewDepartmentLeadAccess,
  getCrewDepartmentLeadFloorFromScope,
  normalizeCrewDepartmentLeadScope,
  parseCrewDepartmentLeadDateTimeLocal,
} from "@/lib/crew/department-leads"
import { getSessionFromCookie } from "@/utils/auth"
import { hasLocalCrewOperatorAccess } from "./crew-local-access"

export interface CrewDepartmentLeadEvent {
  id: string
  organizingTeamId: string
  competitionTeamId: string
  timezone: string | null
}

export interface CrewDepartmentLeadListItem {
  id: string
  email: string | null
  name: string | null
  membershipId: string | null
  roleType: VolunteerRoleType
  floor: string | null
  startsAt: Date | null
  endsAt: Date | null
  status: CrewDepartmentLeadStatus
  notes: string | null
}

export interface CrewDepartmentLeadsPageData {
  event: CrewDepartmentLeadEvent
  leads: CrewDepartmentLeadListItem[]
  volunteerOptions: Array<{
    membershipId: string
    name: string
    email: string
  }>
}

interface CrewDepartmentLeadInput {
  eventId: string
  email?: string | null
  name?: string | null
  membershipId?: string | null
  roleType: VolunteerRoleType
  floor?: string | null
  startsAt?: string | null
  endsAt?: string | null
  status?: CrewDepartmentLeadStatus
  notes?: string | null
}

interface UpdateCrewDepartmentLeadInput extends CrewDepartmentLeadInput {
  leadId: string
}

interface RevokeCrewDepartmentLeadInput {
  eventId: string
  leadId: string
}

export async function getCrewDepartmentLeadsPage(data: {
  eventId: string
}): Promise<CrewDepartmentLeadsPageData> {
  const event = await requireCrewDepartmentLeadEvent(data.eventId)
  await requireCrewDepartmentLeadFullAccess(event)

  const [leads, volunteerOptions] = await Promise.all([
    loadCrewDepartmentLeads(event.id),
    loadCrewDepartmentLeadVolunteerOptions(event.competitionTeamId),
  ])

  return { event, leads, volunteerOptions }
}

export async function createCrewDepartmentLead(data: CrewDepartmentLeadInput) {
  const event = await requireCrewDepartmentLeadEvent(data.eventId)
  await requireCrewDepartmentLeadFullAccess(event)

  const now = new Date()
  const db = getDb()
  await db.insert(crewDepartmentLeadsTable).values({
    id: createCrewDepartmentLeadId(),
    teamId: event.competitionTeamId,
    competitionId: event.id,
    membershipId: emptyToNull(data.membershipId),
    email: normalizeEmail(data.email),
    name: emptyToNull(data.name),
    roleType: data.roleType,
    startsAt: parseCrewDepartmentLeadDateTimeLocal(
      data.startsAt,
      event.timezone,
    ),
    endsAt: parseCrewDepartmentLeadDateTimeLocal(data.endsAt, event.timezone),
    scope: buildCrewDepartmentLeadScopePayload(data.floor),
    status: data.status ?? CREW_DEPARTMENT_LEAD_STATUS.INVITED,
    notes: emptyToNull(data.notes),
    createdAt: now,
    updatedAt: now,
  })

  return { success: true }
}

export async function updateCrewDepartmentLead(
  data: UpdateCrewDepartmentLeadInput,
) {
  const event = await requireCrewDepartmentLeadEvent(data.eventId)
  await requireCrewDepartmentLeadFullAccess(event)

  const db = getDb()
  const updateValues: Partial<typeof crewDepartmentLeadsTable.$inferInsert> = {
    membershipId: emptyToNull(data.membershipId),
    email: normalizeEmail(data.email),
    name: emptyToNull(data.name),
    roleType: data.roleType,
    startsAt: parseCrewDepartmentLeadDateTimeLocal(
      data.startsAt,
      event.timezone,
    ),
    endsAt: parseCrewDepartmentLeadDateTimeLocal(data.endsAt, event.timezone),
    scope: buildCrewDepartmentLeadScopePayload(data.floor),
    notes: emptyToNull(data.notes),
    updatedAt: new Date(),
  }

  if (data.status !== undefined) {
    updateValues.status = data.status
    updateValues.revokedAt =
      data.status === CREW_DEPARTMENT_LEAD_STATUS.REVOKED ? new Date() : null
  }

  const result = await db
    .update(crewDepartmentLeadsTable)
    .set(updateValues)
    .where(
      and(
        eq(crewDepartmentLeadsTable.id, data.leadId),
        eq(crewDepartmentLeadsTable.competitionId, event.id),
      ),
    )

  if (getAffectedRows(result) === 0) {
    throw new Error("Department lead not found")
  }

  return { success: true }
}

export async function revokeCrewDepartmentLead(
  data: RevokeCrewDepartmentLeadInput,
) {
  const event = await requireCrewDepartmentLeadEvent(data.eventId)
  await requireCrewDepartmentLeadFullAccess(event)

  const now = new Date()
  const db = getDb()
  const result = await db
    .update(crewDepartmentLeadsTable)
    .set({
      status: CREW_DEPARTMENT_LEAD_STATUS.REVOKED,
      revokedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(crewDepartmentLeadsTable.id, data.leadId),
        eq(crewDepartmentLeadsTable.competitionId, event.id),
      ),
    )

  if (getAffectedRows(result) === 0) {
    throw new Error("Department lead not found")
  }

  return { success: true }
}

export async function requireCrewDepartmentLeadEvent(
  eventId: string,
): Promise<CrewDepartmentLeadEvent> {
  const db = getDb()
  const [event] = await db
    .select({
      id: competitionsTable.id,
      organizingTeamId: competitionsTable.organizingTeamId,
      competitionTeamId: competitionsTable.competitionTeamId,
      timezone: competitionsTable.timezone,
    })
    .from(crewEventSettingsTable)
    .innerJoin(
      competitionsTable,
      eq(crewEventSettingsTable.competitionId, competitionsTable.id),
    )
    .where(eq(crewEventSettingsTable.competitionId, eventId))
    .limit(1)

  if (!event?.competitionTeamId) {
    throw new Error("Crew event not found")
  }

  return {
    id: event.id,
    organizingTeamId: event.organizingTeamId,
    competitionTeamId: event.competitionTeamId,
    timezone: event.timezone,
  }
}

export async function resolveCrewDepartmentLeadAccess(
  event: CrewDepartmentLeadEvent,
): Promise<CrewDepartmentLeadAccess> {
  if (hasLocalCrewOperatorAccess()) {
    return { kind: "full", scopes: [] }
  }

  const session = await getSessionFromCookie().catch(() => null)
  if (!session?.userId) {
    throw new Error("NOT_AUTHORIZED: Not authenticated")
  }

  if (
    session.user.role === ROLES_ENUM.ADMIN ||
    session.teams?.some(
      (team) =>
        (team.id === event.organizingTeamId ||
          team.id === event.competitionTeamId) &&
        team.permissions.includes(TEAM_PERMISSIONS.MANAGE_COMPETITIONS),
    )
  ) {
    return { kind: "full", scopes: [] }
  }

  const db = getDb()
  const membershipIdentityCondition = and(
    eq(teamMembershipTable.userId, session.userId),
    eq(teamMembershipTable.teamId, event.competitionTeamId),
    eq(teamMembershipTable.isActive, true),
  )
  const identityCondition = session.user.email
    ? or(
        membershipIdentityCondition,
        sql`lower(${crewDepartmentLeadsTable.email}) = ${session.user.email.toLowerCase()}`,
      )
    : membershipIdentityCondition
  const rows = await db
    .select({
      id: crewDepartmentLeadsTable.id,
      roleType: crewDepartmentLeadsTable.roleType,
      venueId: crewDepartmentLeadsTable.venueId,
      startsAt: crewDepartmentLeadsTable.startsAt,
      endsAt: crewDepartmentLeadsTable.endsAt,
      scope: crewDepartmentLeadsTable.scope,
    })
    .from(crewDepartmentLeadsTable)
    .leftJoin(
      teamMembershipTable,
      eq(crewDepartmentLeadsTable.membershipId, teamMembershipTable.id),
    )
    .where(
      and(
        eq(crewDepartmentLeadsTable.competitionId, event.id),
        eq(crewDepartmentLeadsTable.teamId, event.competitionTeamId),
        eq(crewDepartmentLeadsTable.status, CREW_DEPARTMENT_LEAD_STATUS.ACTIVE),
        identityCondition,
      ),
    )

  if (rows.length === 0) {
    throw new Error("FORBIDDEN: Department lead access was not found")
  }

  return {
    kind: "department_lead",
    scopes: rows.map((row) =>
      normalizeCrewDepartmentLeadScope({
        ...row,
        scope: row.scope,
      }),
    ),
  }
}

export async function requireCrewDepartmentLeadFullAccess(
  event: CrewDepartmentLeadEvent,
) {
  const access = await resolveCrewDepartmentLeadAccess(event)
  if (access.kind !== "full") {
    throw new Error("FORBIDDEN: Organizer access is required")
  }
}

async function loadCrewDepartmentLeads(
  competitionId: string,
): Promise<CrewDepartmentLeadListItem[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: crewDepartmentLeadsTable.id,
      email: crewDepartmentLeadsTable.email,
      name: crewDepartmentLeadsTable.name,
      membershipId: crewDepartmentLeadsTable.membershipId,
      roleType: crewDepartmentLeadsTable.roleType,
      scope: crewDepartmentLeadsTable.scope,
      startsAt: crewDepartmentLeadsTable.startsAt,
      endsAt: crewDepartmentLeadsTable.endsAt,
      status: crewDepartmentLeadsTable.status,
      notes: crewDepartmentLeadsTable.notes,
    })
    .from(crewDepartmentLeadsTable)
    .where(eq(crewDepartmentLeadsTable.competitionId, competitionId))
    .orderBy(
      asc(crewDepartmentLeadsTable.status),
      asc(crewDepartmentLeadsTable.email),
    )

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    membershipId: row.membershipId,
    roleType: row.roleType ?? "general",
    floor: getCrewDepartmentLeadFloorFromScope(row.scope),
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: row.status,
    notes: row.notes,
  }))
}

async function loadCrewDepartmentLeadVolunteerOptions(teamId: string) {
  const db = getDb()
  const rows = await db
    .select({
      membershipId: teamMembershipTable.id,
      firstName: userTable.firstName,
      lastName: userTable.lastName,
      email: userTable.email,
    })
    .from(teamMembershipTable)
    .innerJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
    .where(
      and(
        eq(teamMembershipTable.teamId, teamId),
        eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
        eq(teamMembershipTable.isSystemRole, true),
        eq(teamMembershipTable.isActive, true),
      ),
    )
    .orderBy(asc(userTable.email))

  return rows.map((row) => ({
    membershipId: row.membershipId,
    name:
      [row.firstName, row.lastName].filter(Boolean).join(" ") ||
      row.email ||
      "Volunteer",
    email: row.email ?? "",
  }))
}

function normalizeEmail(value: string | null | undefined) {
  return emptyToNull(value)?.toLowerCase() ?? null
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function getAffectedRows(result: unknown) {
  return Number(
    (result as { rowsAffected?: number }).rowsAffected ??
      (result as { affectedRows?: number }).affectedRows ??
      (Array.isArray(result)
        ? (result[0] as { affectedRows?: number } | undefined)?.affectedRows
        : undefined) ??
      0,
  )
}
