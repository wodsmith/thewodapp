import { createId } from "@paralleldrive/cuid2"
import { desc, eq } from "drizzle-orm"
import { getDb } from "../db"
import {
  type CrewConciergeStatus,
  type CrewEventSettings,
  type CrewEventLifecycle,
  type CrewPlan,
  crewEventSettingsTable,
} from "../db/schemas/crew-event-settings"
import { type Competition, competitionsTable } from "../db/schemas/competitions"
import { teamTable } from "../db/schemas/teams"
import { requireLocalCrewOperatorAccess } from "./crew-local-access"
import { generateSlug } from "../utils/slugify"
import {
  requireCrewDepartmentLeadFullAccess,
  resolveCrewDepartmentLeadAccess,
} from "./crew-department-lead.server"

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
}

function requireLocalCrewSettingsAccess() {
  requireLocalCrewOperatorAccess("Crew event settings")
}

type NullableTextInput = string | null | undefined

interface GetCrewEventInput {
  eventId: string
}

interface CreateCrewEventInput {
  organizingTeamId: string
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
  sourcePlatform?: NullableTextInput
  sourceEventUrl?: NullableTextInput
  externalRegistrationUrl?: NullableTextInput
  lifecycle?: CrewEventLifecycle
  conciergeStatus?: CrewConciergeStatus
  crewPlan?: CrewPlan
  fullPlatformCreditCents?: number
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
    })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))
    .limit(1)

  if (!competition) {
    throw new Error("Crew event not found")
  }
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

  return event ?? null
}

export async function listCrewEvents(): Promise<{
  events: CrewEventDetails[]
}> {
  requireLocalCrewSettingsAccess()

  const db = getDb()
  const events = await db
    .select(crewEventSelect)
    .from(crewEventSettingsTable)
    .innerJoin(
      competitionsTable,
      eq(crewEventSettingsTable.competitionId, competitionsTable.id),
    )
    .orderBy(desc(crewEventSettingsTable.createdAt))

  return { events }
}

export async function getCrewEvent(
  data: GetCrewEventInput,
): Promise<{ event: CrewEventDetails | null }> {
  const event = await getCrewEventByCompetitionId(data.eventId)
  if (event) {
    await resolveCrewDepartmentLeadAccess({
      id: event.competition.id,
      organizingTeamId: event.competition.organizingTeamId,
      competitionTeamId: event.competition.competitionTeamId,
    })
  }

  return { event }
}

export async function createCrewSettingsForCompetition(
  data: CreateCrewSettingsForCompetitionInput,
): Promise<{ event: CrewEventDetails }> {
  requireLocalCrewSettingsAccess()
  await requireCrewEventCompetition(data.competitionId)

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
  requireLocalCrewSettingsAccess()

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

  await requireOrganizingTeam(data.organizingTeamId)

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
      parentOrganizationId: data.organizingTeamId,
      description: `Competition event team for ${data.name}`,
      creditBalance: 0,
    })

    await tx.insert(competitionsTable).values({
      id: competitionId,
      organizingTeamId: data.organizingTeamId,
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
  if (data.fullPlatformCreditCents !== undefined) {
    updateData.fullPlatformCreditCents = data.fullPlatformCreditCents
  }
  if (data.acquisitionSource !== undefined) {
    updateData.acquisitionSource = data.acquisitionSource
  }
  if (data.settings !== undefined) updateData.settings = data.settings

  const db = getDb()
  await db
    .update(crewEventSettingsTable)
    .set(updateData)
    .where(eq(crewEventSettingsTable.competitionId, data.competitionId))

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
  }
}
