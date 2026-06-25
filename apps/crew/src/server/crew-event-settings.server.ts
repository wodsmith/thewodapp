import { createId } from "@paralleldrive/cuid2"
import { count, desc, eq, inArray, or } from "drizzle-orm"
import { getDb } from "../db"
import {
  type Competition,
  competitionHeatsTable,
  competitionsTable,
} from "../db/schemas/competitions"
import {
  type CrewConciergeStatus,
  type CrewEventLifecycle,
  type CrewEventSettings,
  type CrewPlan,
  crewEventSettingsTable,
} from "../db/schemas/crew-event-settings"
import { teamTable } from "../db/schemas/teams"
import {
  judgeHeatAssignmentsTable,
  volunteerShiftAssignmentsTable,
  volunteerShiftsTable,
} from "../db/schemas/volunteers"
import type {
  CrewEventNavigationState,
  CrewViewerRole,
} from "../lib/crew/navigation"
import {
  getCrewAuthState,
  getCrewManageCompetitionTeamIds,
  requireCrewEventManagerAccess,
  requireCrewPersonalTeamId,
} from "../server/crew-auth.server"
import { generateSlug } from "../utils/slugify"
import { requireCrewDepartmentLeadFullAccess } from "./crew-department-lead.server"

type CrewEventCompetition = Pick<
  Competition,
  | "id"
  | "organizingTeamId"
  | "competitionTeamId"
  | "slug"
  | "name"
  | "description"
  | "startDate"
  | "endDate"
  | "timezone"
  | "status"
  | "visibility"
  | "competitionType"
>

export interface CrewEventDetails {
  settings: CrewEventSettings
  competition: CrewEventCompetition
  navigationState?: CrewEventNavigationState
}

export interface CrewEventResult {
  event: CrewEventDetails | null
  viewerRole?: CrewViewerRole
}

type NullableTextInput = string | null | undefined

interface GetCrewEventInput {
  eventId: string
}

interface CreateCrewEventInput {
  organizingTeamId?: string
  name: string
  slug: string
  startDate: string
  endDate: string
  description?: NullableTextInput
  timezone: string
  sourcePlatform?: NullableTextInput
  sourceEventUrl?: NullableTextInput
  externalRegistrationUrl?: NullableTextInput
  acquisitionSource?: NullableTextInput
  crewPlan: CrewPlan
  settings?: NullableTextInput
}

interface CreateCrewSettingsForCompetitionInput {
  competitionId: string
  sourcePlatform?: NullableTextInput
  sourceEventUrl?: NullableTextInput
  externalRegistrationUrl?: NullableTextInput
  acquisitionSource?: NullableTextInput
  crewPlan: CrewPlan
  settings?: NullableTextInput
}

interface UpdateCrewEventSettingsInput {
  competitionId: string
  crewOnly?: boolean
  name?: string
  startDate?: string
  endDate?: string
  timezone?: string
  sourcePlatform?: NullableTextInput
  sourceEventUrl?: NullableTextInput
  externalRegistrationUrl?: NullableTextInput
  lifecycle?: CrewEventLifecycle
  conciergeStatus?: CrewConciergeStatus
  crewPlan?: CrewPlan
  acquisitionSource?: NullableTextInput
  settings?: NullableTextInput
}

const crewEventSelect = {
  settings: crewEventSettingsTable,
  competition: {
    id: competitionsTable.id,
    organizingTeamId: competitionsTable.organizingTeamId,
    competitionTeamId: competitionsTable.competitionTeamId,
    slug: competitionsTable.slug,
    name: competitionsTable.name,
    description: competitionsTable.description,
    startDate: competitionsTable.startDate,
    endDate: competitionsTable.endDate,
    timezone: competitionsTable.timezone,
    status: competitionsTable.status,
    visibility: competitionsTable.visibility,
    competitionType: competitionsTable.competitionType,
  },
}

async function requireCrewEventCompetition(competitionId: string) {
  const db = getDb()
  const [competition] = await db
    .select({
      organizingTeamId: competitionsTable.organizingTeamId,
      competitionTeamId: competitionsTable.competitionTeamId,
    })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))
    .limit(1)

  if (!competition) {
    throw new Error("Crew event not found")
  }

  return competition
}

async function requireOrganizingTeam(organizingTeamId: string) {
  const db = getDb()
  const [team] = await db
    .select({ id: teamTable.id })
    .from(teamTable)
    .where(eq(teamTable.id, organizingTeamId))
    .limit(1)

  if (!team) {
    throw new Error("Organizing team not found")
  }
}

async function getCrewEventByCompetitionId(
  competitionId: string,
): Promise<CrewEventDetails | null> {
  const db = getDb()
  const [event] = await db
    .select(crewEventSelect)
    .from(crewEventSettingsTable)
    .innerJoin(
      competitionsTable,
      eq(crewEventSettingsTable.competitionId, competitionsTable.id),
    )
    .where(eq(crewEventSettingsTable.competitionId, competitionId))
    .limit(1)

  if (!event) return null

  return {
    ...event,
    navigationState: await loadCrewEventNavigationState(competitionId),
  }
}

async function loadCrewEventNavigationState(
  competitionId: string,
): Promise<CrewEventNavigationState> {
  const db = getDb()
  const [shiftAssignments, judgeAssignments] = await Promise.all([
    db
      .select({ count: count() })
      .from(volunteerShiftAssignmentsTable)
      .innerJoin(
        volunteerShiftsTable,
        eq(volunteerShiftAssignmentsTable.shiftId, volunteerShiftsTable.id),
      )
      .where(eq(volunteerShiftsTable.competitionId, competitionId)),
    db
      .select({ count: count() })
      .from(judgeHeatAssignmentsTable)
      .innerJoin(
        competitionHeatsTable,
        eq(judgeHeatAssignmentsTable.heatId, competitionHeatsTable.id),
      )
      .where(eq(competitionHeatsTable.competitionId, competitionId)),
  ])
  const shiftCount = shiftAssignments[0]?.count ?? 0
  const assignmentCount = judgeAssignments[0]?.count ?? 0

  return {
    assignmentCount,
    shiftCount,
    hasEventDayData: assignmentCount > 0 || shiftCount > 0,
    hasPrintPacketData: assignmentCount > 0 || shiftCount > 0,
  }
}

export async function listCrewEvents(): Promise<{
  events: CrewEventDetails[]
}> {
  const auth = await getCrewAuthState()

  if (!auth.session) {
    throw new Error("NOT_AUTHORIZED: Crew events require sign-in")
  }

  const db = getDb()
  const baseQuery = db
    .select(crewEventSelect)
    .from(crewEventSettingsTable)
    .innerJoin(
      competitionsTable,
      eq(crewEventSettingsTable.competitionId, competitionsTable.id),
    )

  const canListAllEvents = auth.isAdmin
  const managedTeamIds = getCrewManageCompetitionTeamIds(auth.session)

  if (!canListAllEvents && managedTeamIds.size === 0) {
    return { events: [] }
  }

  const events = canListAllEvents
    ? await baseQuery.orderBy(desc(crewEventSettingsTable.createdAt))
    : await baseQuery
        .where(
          or(
            inArray(
              competitionsTable.organizingTeamId,
              Array.from(managedTeamIds),
            ),
            inArray(
              competitionsTable.competitionTeamId,
              Array.from(managedTeamIds),
            ),
          ),
        )
        .orderBy(desc(crewEventSettingsTable.createdAt))

  return { events }
}

export async function getCrewEvent(
  data: GetCrewEventInput,
): Promise<CrewEventResult> {
  const event = await getCrewEventByCompetitionId(data.eventId)
  let viewerRole: CrewViewerRole | undefined

  if (event) {
    await requireCrewDepartmentLeadFullAccess({
      id: event.competition.id,
      organizingTeamId: event.competition.organizingTeamId,
      competitionTeamId: event.competition.competitionTeamId,
      timezone: event.competition.timezone,
    })
    viewerRole = "organizer_admin"
  }

  return { event, viewerRole }
}

export async function createCrewSettingsForCompetition(
  data: CreateCrewSettingsForCompetitionInput,
): Promise<{ event: CrewEventDetails }> {
  const competition = await requireCrewEventCompetition(data.competitionId)
  await requireCrewEventManagerAccess(competition, "Crew event settings")

  const db = getDb()
  const existing = await getCrewEventByCompetitionId(data.competitionId)
  if (existing) return { event: existing }

  await db.insert(crewEventSettingsTable).values({
    competitionId: data.competitionId,
    sourcePlatform: data.sourcePlatform,
    sourceEventUrl: data.sourceEventUrl,
    externalRegistrationUrl: data.externalRegistrationUrl,
    acquisitionSource: data.acquisitionSource,
    crewPlan: data.crewPlan,
    settings: data.settings,
  })

  const event = await getCrewEventByCompetitionId(data.competitionId)
  if (!event) {
    throw new Error("Failed to create Crew event settings")
  }

  return { event }
}

export async function createCrewEvent(
  data: CreateCrewEventInput,
): Promise<{ event: CrewEventDetails }> {
  const db = getDb()
  const existingCompetition = await db
    .select({ id: competitionsTable.id })
    .from(competitionsTable)
    .where(eq(competitionsTable.slug, data.slug))
    .limit(1)

  if (existingCompetition[0]) {
    throw new Error(
      "A competition with this slug already exists. Please choose a different slug.",
    )
  }

  // The new event form does not surface a team; default to the creator's
  // personal team when no organizing team is explicitly provided.
  const organizingTeamId =
    data.organizingTeamId ?? (await requireCrewPersonalTeamId())

  await requireOrganizingTeam(organizingTeamId)
  await requireCrewEventManagerAccess(
    { organizingTeamId },
    "Crew event creation",
  )

  let teamSlug = generateSlug(`${data.name}-event`)
  let teamSlugIsUnique = false
  let attempts = 0

  while (!teamSlugIsUnique && attempts < 5) {
    const existingTeam = await db
      .select({ id: teamTable.id })
      .from(teamTable)
      .where(eq(teamTable.slug, teamSlug))
      .limit(1)

    if (!existingTeam[0]) {
      teamSlugIsUnique = true
    } else {
      teamSlug = `${generateSlug(`${data.name}-event`)}-${createId().substring(0, 4)}`
      attempts++
    }
  }

  if (!teamSlugIsUnique) {
    throw new Error("Could not generate unique slug for competition team")
  }

  const competitionTeamId = `team_${createId()}`
  const competitionId = `comp_${createId()}`

  await db.transaction(async (tx) => {
    await tx.insert(teamTable).values({
      id: competitionTeamId,
      name: `${data.name} (Event)`,
      slug: teamSlug,
      type: "competition_event",
      parentOrganizationId: organizingTeamId,
      description: `Competition event team for ${data.name}`,
      creditBalance: 0,
    })

    await tx.insert(competitionsTable).values({
      id: competitionId,
      organizingTeamId,
      competitionTeamId,
      name: data.name,
      slug: data.slug,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      timezone: data.timezone,
      competitionType: "in-person",
    })

    await tx.insert(crewEventSettingsTable).values({
      competitionId,
      sourcePlatform: data.sourcePlatform,
      sourceEventUrl: data.sourceEventUrl,
      externalRegistrationUrl: data.externalRegistrationUrl,
      acquisitionSource: data.acquisitionSource,
      crewPlan: data.crewPlan,
      settings: data.settings,
    })
  })

  const event = await getCrewEventByCompetitionId(competitionId)
  if (!event) {
    throw new Error("Failed to create Crew event")
  }

  return { event }
}

export async function updateCrewEventSettings(
  data: UpdateCrewEventSettingsInput,
): Promise<{ event: CrewEventDetails }> {
  await requireCrewEventCompetition(data.competitionId)
  const eventAccess = await requireCrewDepartmentLeadEventForSettings(
    data.competitionId,
  )
  await requireCrewDepartmentLeadFullAccess(eventAccess)

  const updateData: Partial<typeof crewEventSettingsTable.$inferInsert> = {
    updatedAt: new Date(),
  }

  if (data.crewOnly !== undefined) updateData.crewOnly = data.crewOnly
  if (data.sourcePlatform !== undefined) {
    updateData.sourcePlatform = data.sourcePlatform
  }
  if (data.sourceEventUrl !== undefined) {
    updateData.sourceEventUrl = data.sourceEventUrl
  }
  if (data.externalRegistrationUrl !== undefined) {
    updateData.externalRegistrationUrl = data.externalRegistrationUrl
  }
  if (data.lifecycle !== undefined) updateData.lifecycle = data.lifecycle
  if (data.conciergeStatus !== undefined) {
    updateData.conciergeStatus = data.conciergeStatus
  }
  if (data.crewPlan !== undefined) updateData.crewPlan = data.crewPlan
  if (data.acquisitionSource !== undefined) {
    updateData.acquisitionSource = data.acquisitionSource
  }
  if (data.settings !== undefined) updateData.settings = data.settings

  const competitionUpdate: Partial<typeof competitionsTable.$inferInsert> = {}
  if (data.name !== undefined) competitionUpdate.name = data.name
  if (data.startDate !== undefined) competitionUpdate.startDate = data.startDate
  if (data.endDate !== undefined) competitionUpdate.endDate = data.endDate
  if (data.timezone !== undefined) competitionUpdate.timezone = data.timezone

  if (
    competitionUpdate.startDate !== undefined &&
    competitionUpdate.endDate !== undefined &&
    competitionUpdate.endDate < competitionUpdate.startDate
  ) {
    throw new Error("End date must be on or after the start date")
  }

  const db = getDb()
  await db
    .update(crewEventSettingsTable)
    .set(updateData)
    .where(eq(crewEventSettingsTable.competitionId, data.competitionId))

  if (Object.keys(competitionUpdate).length > 0) {
    await db
      .update(competitionsTable)
      .set(competitionUpdate)
      .where(eq(competitionsTable.id, data.competitionId))
  }

  const event = await getCrewEventByCompetitionId(data.competitionId)
  if (!event) {
    throw new Error("Crew event not found")
  }

  return { event }
}

async function requireCrewDepartmentLeadEventForSettings(
  competitionId: string,
) {
  const db = getDb()
  const [event] = await db
    .select({
      id: competitionsTable.id,
      organizingTeamId: competitionsTable.organizingTeamId,
      competitionTeamId: competitionsTable.competitionTeamId,
      timezone: competitionsTable.timezone,
    })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))
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
