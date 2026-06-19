// @lat: [[crew#Import CSV Preview#Preview Records]]
import { createId } from "@paralleldrive/cuid2"
import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import {
  CREW_IMPORT_KIND,
  CREW_IMPORT_ROW_ACTION,
  CREW_IMPORT_ROW_TARGET_TYPE,
  CREW_IMPORT_STATUS,
  crewImportRowsTable,
  crewImportsTable,
  type CrewImport,
  type CrewImportRow,
} from "../db/schemas/crew-imports"
import {
  createCompetitionHeatId,
  createCompetitionVenueId,
  createCrewImportId,
  createProgrammingTrackId,
  createTeamInvitationId,
  createTrackWorkoutId,
} from "../db/schemas/common"
import {
  competitionHeatsTable,
  competitionVenuesTable,
  competitionsTable,
} from "../db/schemas/competitions"
import { crewEventSettingsTable } from "../db/schemas/crew-event-settings"
import {
  PROGRAMMING_TRACK_TYPE,
  programmingTracksTable,
  trackWorkoutsTable,
} from "../db/schemas/programming"
import { scalingLevelsTable } from "../db/schemas/scaling"
import {
  INVITATION_STATUS,
  SYSTEM_ROLES_ENUM,
  teamInvitationTable,
  teamMembershipTable,
} from "../db/schemas/teams"
import { userTable } from "../db/schemas/users"
import { workouts } from "../db/schemas/workouts"
import { getDb } from "../db"
import {
  buildHeatScheduleApplyPlan,
  buildTrackWorkoutLookup,
  buildVolunteerApplyPlan,
  normalizeLookupValue,
  type CrewApplySummary,
  type ExistingVolunteerInvitation,
  type ExistingVolunteerMembership,
  type HeatApplyContext,
  type HeatApplyRowPlan,
  type HeatApplyTrackWorkout,
  type HeatApplyVenue,
  type VolunteerApplyRowPlan,
} from "../lib/crew/imports/apply"
import {
  buildCrewImportPreview,
  defaultCrewImportRoleLabels,
} from "../lib/crew/imports/preview"
import {
  CREW_IMPORT_PARSER_VERSION,
  type ColumnMapping,
  type CrewImportKind,
  type CrewImportPreview,
  type CrewImportPreviewContext,
  type HeatScheduleImportRow,
  type ImportIssue,
  type PreviewImportRow,
  type VolunteerImportRow,
} from "../lib/crew/imports/types"
import { parseCompetitionSettings } from "../utils/competition-settings"
import { DEFAULT_TIMEZONE } from "../utils/timezone-utils"
import { requireLocalCrewOperatorAccess } from "./crew-local-access"

export const MAX_CREW_IMPORT_BYTES = 1_000_000

type DbClient = ReturnType<typeof getDb>
type CrewEventRecord = Awaited<ReturnType<typeof requireCrewEvent>>

export type CrewImportErrorCode =
  | "EVENT_NOT_FOUND"
  | "IMPORT_NOT_FOUND"
  | "IMPORT_ALREADY_APPLIED"
  | "INVALID_IMPORT_STATUS"
  | "CONFIRMATION_REQUIRED"
  | "UNSUPPORTED_IMPORT_KIND"
  | "INVALID_FILE_TYPE"
  | "INVALID_COLUMN_MAPPING"
  | "PAYLOAD_TOO_LARGE"

export class CrewImportError extends Error {
  constructor(
    public readonly code: CrewImportErrorCode,
    public readonly publicMessage: string,
    public readonly status = 400,
  ) {
    super(publicMessage)
    this.name = "CrewImportError"
  }
}

const uploadCrewImportInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  kind: z.enum([CREW_IMPORT_KIND.VOLUNTEERS, CREW_IMPORT_KIND.HEAT_SCHEDULE]),
  csvText: z.string(),
  originalFilename: z.string().min(1, "Filename is required"),
  mimeType: z.string().nullable().optional(),
  fileSize: z.number().int().min(0),
  sourcePlatform: z.string().trim().max(100).nullable().optional(),
  columnMapping: z.record(z.string(), z.string()).optional(),
})

const applyCrewImportInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  importId: z.string().min(1, "Import ID is required"),
  confirmed: z.literal(true),
})

export interface CrewImportHistoryItem {
  id: string
  kind: CrewImport["kind"]
  status: CrewImport["status"]
  sourcePlatform: string | null
  originalFilename: string | null
  rowCount: number
  warningCount: number
  errorCount: number
  createdCount: number
  updatedCount: number
  skippedCount: number
  createdAt: Date
  updatedAt: Date
}

type CrewImportApplySummaryValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | boolean[]

export interface CrewImportApplyResult {
  importId: string
  kind: CrewImport["kind"]
  status: CrewImport["status"]
  createdCount: number
  updatedCount: number
  skippedCount: number
  errorCount: number
  warningCount: number
  summary: Record<string, CrewImportApplySummaryValue>
}

export interface CrewImportReferenceData {
  roleLabels: string[]
  divisions: CrewImportPreviewContext["divisions"]
  workouts: CrewImportPreviewContext["workouts"]
  heats: CrewImportPreviewContext["heats"]
}

export interface PersistedCrewImportPreview extends CrewImportPreview {
  importId: string
  status: CrewImport["status"]
  originalFilename: string
  sourcePlatform: string | null
  createdAt: Date
}

export interface CrewImportsPageData {
  history: CrewImportHistoryItem[]
  reference: CrewImportReferenceData
}

export async function loadCrewImportsPageData(
  eventId: string,
): Promise<CrewImportsPageData> {
  requireLocalCrewOperatorAccess("Crew imports")

  const [reference, history] = await Promise.all([
    loadCrewImportReferenceData(eventId),
    listCrewImportHistory(eventId),
  ])

  return { reference, history }
}

export async function createCrewImportPreviewRecord(input: {
  eventId: string
  kind: CrewImportKind
  csvText: string
  originalFilename: string
  mimeType?: string | null
  fileSize: number
  sourcePlatform?: string | null
  columnMapping?: ColumnMapping
}): Promise<PersistedCrewImportPreview> {
  requireLocalCrewOperatorAccess("Crew imports")

  const data = uploadCrewImportInputSchema.parse(input)
  const fileSize = Math.max(data.fileSize, getCsvByteLength(data.csvText))

  if (fileSize > MAX_CREW_IMPORT_BYTES) {
    throw new CrewImportError(
      "PAYLOAD_TOO_LARGE",
      "CSV is larger than the Crew preview limit.",
      413,
    )
  }

  if (!isCsvUpload(data.originalFilename, data.mimeType)) {
    throw new CrewImportError(
      "INVALID_FILE_TYPE",
      "Crew import preview accepts CSV files only.",
      415,
    )
  }

  const reference = await loadCrewImportReferenceData(data.eventId)
  const preview = buildCrewImportPreview({
    csvText: data.csvText,
    kind: data.kind,
    columnMapping: data.columnMapping,
    context: reference,
  })
  const importId = createCrewImportId()
  const status =
    preview.fileIssues.some((issue) => issue.severity === "error") &&
    preview.rows.length === 0
      ? CREW_IMPORT_STATUS.FAILED
      : CREW_IMPORT_STATUS.PREVIEWED
  const createdAt = new Date()

  await persistCrewImportPreview({
    eventId: data.eventId,
    importId,
    preview,
    status,
    originalFilename: data.originalFilename,
    mimeType: data.mimeType ?? null,
    fileSize,
    sourcePlatform: data.sourcePlatform ?? null,
    createdAt,
  })

  return {
    ...preview,
    importId,
    status,
    originalFilename: data.originalFilename,
    sourcePlatform: data.sourcePlatform ?? null,
    createdAt,
  }
}

export async function applyCrewImportRecord(input: {
  eventId: string
  importId: string
  confirmed: true
}): Promise<CrewImportApplyResult> {
  requireLocalCrewOperatorAccess("Crew imports")

  const data = applyCrewImportInputSchema.parse(input)
  if (!data.confirmed) {
    throw new CrewImportError(
      "CONFIRMATION_REQUIRED",
      "Confirm the import apply before mutating Crew data.",
      400,
    )
  }

  const [event, importRecord, rows] = await Promise.all([
    requireCrewEvent(data.eventId),
    requireCrewImport(data.eventId, data.importId),
    listCrewImportRows(data.importId),
  ])

  if (importRecord.status === CREW_IMPORT_STATUS.APPLIED) {
    throw new CrewImportError(
      "IMPORT_ALREADY_APPLIED",
      "This import has already been applied.",
      409,
    )
  }

  if (importRecord.status !== CREW_IMPORT_STATUS.PREVIEWED) {
    throw new CrewImportError(
      "INVALID_IMPORT_STATUS",
      "Only previewed imports can be applied.",
      409,
    )
  }

  const previewRows = rows.map((row) =>
    toPersistedPreviewRow(importRecord.kind, row),
  )

  if (importRecord.kind === CREW_IMPORT_KIND.VOLUNTEERS) {
    return await applyVolunteerImport({
      event,
      importRecord,
      previewRows,
    })
  }

  if (importRecord.kind === CREW_IMPORT_KIND.HEAT_SCHEDULE) {
    return await applyHeatScheduleImport({
      event,
      importRecord,
      previewRows,
    })
  }

  throw new CrewImportError(
    "UNSUPPORTED_IMPORT_KIND",
    "This import kind does not have an apply path yet.",
    400,
  )
}

async function persistCrewImportPreview({
  eventId,
  importId,
  preview,
  status,
  originalFilename,
  mimeType,
  fileSize,
  sourcePlatform,
  createdAt,
}: {
  eventId: string
  importId: string
  preview: CrewImportPreview
  status: CrewImport["status"]
  originalFilename: string
  mimeType: string | null
  fileSize: number
  sourcePlatform: string | null
  createdAt: Date
}) {
  const db = getDb()

  await db.transaction(async (tx) => {
    await tx.insert(crewImportsTable).values({
      id: importId,
      competitionId: eventId,
      kind: preview.kind,
      sourcePlatform,
      originalFilename,
      mimeType,
      status,
      parserVersion: CREW_IMPORT_PARSER_VERSION,
      headers: preview.headers,
      columnMapping: preview.columnMapping,
      rowCount: preview.rowCount,
      warningCount: preview.warningCount,
      errorCount: preview.errorCount,
      skippedCount: preview.rows.filter((row) => row.action === "skip").length,
      summary: {
        fileSize,
        fileIssues: preview.fileIssues,
        skippedRowCount: preview.skippedRowCount,
        previewRowCount: preview.rows.length,
      },
      createdAt,
      updatedAt: createdAt,
    })

    if (preview.rows.length === 0) return

    await tx
      .insert(crewImportRowsTable)
      .values(
        preview.rows.map((row) =>
          toCrewImportRowInsert(importId, row, createdAt),
        ),
      )
  })
}

async function applyVolunteerImport({
  event,
  importRecord,
  previewRows,
}: {
  event: CrewEventRecord
  importRecord: CrewImport
  previewRows: PreviewImportRow[]
}): Promise<CrewImportApplyResult> {
  const db = getDb()
  const [existingInvitations, existingMemberships] = await Promise.all([
    listVolunteerInvitations(db, event.competitionTeamId),
    listVolunteerMemberships(db, event.competitionTeamId),
  ])
  const invitationMetadataById = new Map(
    existingInvitations.map((invitation) => [
      invitation.id,
      invitation.metadata,
    ]),
  )
  const membershipMetadataById = new Map(
    existingMemberships.map((membership) => [
      membership.id,
      membership.metadata,
    ]),
  )
  const plan = buildVolunteerApplyPlan(previewRows, {
    importId: importRecord.id,
    existingInvitations,
    existingMemberships,
  })
  const timestamp = new Date()

  await db.transaction(async (tx) => {
    const client = tx as unknown as DbClient

    for (const row of plan.rows) {
      if (row.operation === "create_invitation") {
        row.targetId = await createVolunteerInvitation(
          client,
          event.competitionTeamId,
          row,
          timestamp,
        )
      } else if (row.operation === "update_invitation" && row.targetId) {
        await updateVolunteerInvitation(
          client,
          row.targetId,
          mergeJsonMetadata(
            invitationMetadataById.get(row.targetId),
            row.metadata,
          ),
          timestamp,
        )
      } else if (row.operation === "update_membership" && row.targetId) {
        await updateVolunteerMembership(
          client,
          row.targetId,
          mergeJsonMetadata(
            membershipMetadataById.get(row.targetId),
            row.metadata,
          ),
          timestamp,
        )
      }

      await updateImportRowAudit(client, importRecord.id, row, timestamp)
    }

    await updateImportApplySummary(
      client,
      importRecord,
      plan.summary,
      timestamp,
      {
        kind: CREW_IMPORT_KIND.VOLUNTEERS,
        appliedRowCount: plan.summary.createdCount + plan.summary.updatedCount,
        knownLimitations: [
          "Pending no-account volunteers are written as team invitations and are not assignable until they accept or become approved memberships.",
        ],
      },
    )
  })

  return toApplyResult(importRecord, plan.summary, {
    kind: CREW_IMPORT_KIND.VOLUNTEERS,
    appliedRowCount: plan.summary.createdCount + plan.summary.updatedCount,
  })
}

async function applyHeatScheduleImport({
  event,
  importRecord,
  previewRows,
}: {
  event: CrewEventRecord
  importRecord: CrewImport
  previewRows: PreviewImportRow[]
}): Promise<CrewImportApplyResult> {
  const db = getDb()
  const timestamp = new Date()
  let resultSummary: CrewApplySummary | null = null
  let extraSummary: CrewImportApplyResult["summary"] = {}

  await db.transaction(async (tx) => {
    const client = tx as unknown as DbClient
    const trackWorkoutResult = await ensureImportedTrackWorkouts(
      client,
      event,
      previewRows,
      timestamp,
      importRecord.id,
    )
    const venueResult = await ensureImportedVenues(
      client,
      event.id,
      previewRows,
      timestamp,
    )
    const divisions = await listDivisionsForCrewEvent(client, event)
    const existingHeats = await listExistingHeats(
      client,
      event.id,
      trackWorkoutResult.trackWorkouts.map((workout) => workout.id),
    )
    const plan = buildHeatScheduleApplyPlan(previewRows, {
      competitionStartDate: event.startDate,
      timezone: event.timezone ?? DEFAULT_TIMEZONE,
      trackWorkouts: trackWorkoutResult.trackWorkouts,
      divisions,
      venues: venueResult.venues,
      existingHeats,
    })

    for (const row of plan.rows) {
      if (row.operation === "create_heat") {
        row.targetId = await createImportedHeat(
          client,
          event.id,
          row,
          timestamp,
        )
      } else if (row.operation === "update_heat" && row.targetId) {
        await updateImportedHeat(client, row, timestamp)
      }

      await updateImportRowAudit(client, importRecord.id, row, timestamp)
    }

    resultSummary = plan.summary
    extraSummary = {
      kind: CREW_IMPORT_KIND.HEAT_SCHEDULE,
      appliedRowCount: plan.summary.createdCount + plan.summary.updatedCount,
      createdTrackWorkoutCount: trackWorkoutResult.createdTrackWorkoutCount,
      createdVenueCount: venueResult.createdVenueCount,
      updatedVenueCount: venueResult.updatedVenueCount,
      timezone: event.timezone ?? DEFAULT_TIMEZONE,
      schedulePublishedAt: null,
    }

    await updateImportApplySummary(
      client,
      importRecord,
      plan.summary,
      timestamp,
      extraSummary,
    )
  })

  if (!resultSummary) {
    throw new CrewImportError(
      "INVALID_IMPORT_STATUS",
      "Heat schedule import could not be applied.",
      500,
    )
  }

  return toApplyResult(importRecord, resultSummary, extraSummary)
}

async function listVolunteerInvitations(
  db: DbClient,
  competitionTeamId: string,
): Promise<Array<ExistingVolunteerInvitation & { metadata: string | null }>> {
  return await db
    .select({
      id: teamInvitationTable.id,
      email: teamInvitationTable.email,
      acceptedAt: teamInvitationTable.acceptedAt,
      status: teamInvitationTable.status,
      metadata: teamInvitationTable.metadata,
    })
    .from(teamInvitationTable)
    .where(
      and(
        eq(teamInvitationTable.teamId, competitionTeamId),
        eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
        eq(teamInvitationTable.isSystemRole, true),
      ),
    )
}

async function listVolunteerMemberships(
  db: DbClient,
  competitionTeamId: string,
): Promise<Array<ExistingVolunteerMembership & { metadata: string | null }>> {
  const rows = await db
    .select({
      id: teamMembershipTable.id,
      email: userTable.email,
      isActive: teamMembershipTable.isActive,
      metadata: teamMembershipTable.metadata,
    })
    .from(teamMembershipTable)
    .innerJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
    .where(
      and(
        eq(teamMembershipTable.teamId, competitionTeamId),
        eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
        eq(teamMembershipTable.isSystemRole, true),
      ),
    )

  return rows.flatMap((row) =>
    row.email
      ? [
          {
            ...row,
            email: row.email,
          },
        ]
      : [],
  )
}

async function createVolunteerInvitation(
  db: DbClient,
  competitionTeamId: string,
  row: VolunteerApplyRowPlan,
  timestamp: Date,
) {
  const invitationId = createTeamInvitationId()
  const expiresAt = new Date(timestamp)
  expiresAt.setDate(expiresAt.getDate() + 30)

  await db.insert(teamInvitationTable).values({
    id: invitationId,
    teamId: competitionTeamId,
    email: row.email,
    roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
    isSystemRole: true,
    token: createId(),
    invitedBy: null,
    expiresAt,
    status: INVITATION_STATUS.PENDING,
    metadata: row.metadata,
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  return invitationId
}

async function updateVolunteerInvitation(
  db: DbClient,
  invitationId: string,
  metadata: string | null,
  timestamp: Date,
) {
  const expiresAt = new Date(timestamp)
  expiresAt.setDate(expiresAt.getDate() + 30)

  await db
    .update(teamInvitationTable)
    .set({
      roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
      isSystemRole: true,
      status: INVITATION_STATUS.PENDING,
      expiresAt,
      metadata,
      updatedAt: timestamp,
    })
    .where(eq(teamInvitationTable.id, invitationId))
}

async function updateVolunteerMembership(
  db: DbClient,
  membershipId: string,
  metadata: string | null,
  timestamp: Date,
) {
  await db
    .update(teamMembershipTable)
    .set({
      roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
      isSystemRole: true,
      isActive: true,
      metadata,
      updatedAt: timestamp,
    })
    .where(eq(teamMembershipTable.id, membershipId))
}

async function ensureImportedTrackWorkouts(
  db: DbClient,
  event: CrewEventRecord,
  rows: PreviewImportRow[],
  timestamp: Date,
  importId: string,
) {
  const trackWorkouts = await listWorkoutsForCompetitionWithDb(db, event.id)
  const lookup = buildTrackWorkoutLookup(trackWorkouts)
  const labels = getRequiredHeatWorkoutLabels(rows).filter(
    (label) => !lookup.has(normalizeLookupValue(label)),
  )

  if (labels.length === 0) {
    return { trackWorkouts, createdTrackWorkoutCount: 0 }
  }

  const track = await ensureCompetitionTrack(db, event, timestamp)
  let nextOrder =
    trackWorkouts.reduce(
      (maxOrder, workout) => Math.max(maxOrder, workout.trackOrder),
      0,
    ) + 1

  for (const label of labels) {
    const workoutId = `workout_${createId()}`
    await db.insert(workouts).values({
      id: workoutId,
      name: label,
      description: `Imported from Crew heat schedule import ${importId}. Update workout details before publishing scores.`,
      scope: "private",
      scheme: "time",
      scoreType: "min",
      roundsToScore: 1,
      teamId: event.organizingTeamId,
      scalingGroupId: getCrewEventScalingGroupId(event),
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    const trackWorkoutId = createTrackWorkoutId()
    const trackOrder = nextOrder
    nextOrder += 1
    await db.insert(trackWorkoutsTable).values({
      id: trackWorkoutId,
      trackId: track.id,
      workoutId,
      trackOrder,
      pointsMultiplier: 100,
      heatStatus: "draft",
      eventStatus: "draft",
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    trackWorkouts.push({ id: trackWorkoutId, label, trackOrder })
    lookup.set(normalizeLookupValue(label), {
      id: trackWorkoutId,
      label,
      trackOrder,
    })
  }

  return {
    trackWorkouts,
    createdTrackWorkoutCount: labels.length,
  }
}

async function ensureCompetitionTrack(
  db: DbClient,
  event: CrewEventRecord,
  timestamp: Date,
) {
  const existingTracks = await db
    .select({
      id: programmingTracksTable.id,
      name: programmingTracksTable.name,
    })
    .from(programmingTracksTable)
    .where(eq(programmingTracksTable.competitionId, event.id))
    .limit(1)

  const existingTrack = existingTracks[0]
  if (existingTrack) return existingTrack

  const trackId = createProgrammingTrackId()
  await db.insert(programmingTracksTable).values({
    id: trackId,
    name: `${event.name} - Events`,
    description: `Competition events for ${event.name}`,
    type: PROGRAMMING_TRACK_TYPE.TEAM_OWNED,
    ownerTeamId: event.organizingTeamId,
    scalingGroupId: getCrewEventScalingGroupId(event),
    competitionId: event.id,
    isPublic: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  return { id: trackId, name: `${event.name} - Events` }
}

async function ensureImportedVenues(
  db: DbClient,
  eventId: string,
  rows: PreviewImportRow[],
  timestamp: Date,
) {
  const existingVenues = await db
    .select({
      id: competitionVenuesTable.id,
      name: competitionVenuesTable.name,
      laneCount: competitionVenuesTable.laneCount,
      sortOrder: competitionVenuesTable.sortOrder,
    })
    .from(competitionVenuesTable)
    .where(eq(competitionVenuesTable.competitionId, eventId))
    .orderBy(asc(competitionVenuesTable.sortOrder))

  const venues: HeatApplyVenue[] = existingVenues.map((venue) => ({
    id: venue.id,
    name: venue.name,
  }))
  const venueByName = new Map(
    existingVenues.map((venue) => [normalizeLookupValue(venue.name), venue]),
  )
  const requiredVenues = getRequiredHeatVenues(rows)
  let createdVenueCount = 0
  let updatedVenueCount = 0
  let nextSortOrder =
    existingVenues.reduce(
      (maxOrder, venue) => Math.max(maxOrder, venue.sortOrder),
      0,
    ) + 1

  for (const venue of requiredVenues.values()) {
    const existing = venueByName.get(normalizeLookupValue(venue.name))
    if (existing) {
      if (venue.laneCount !== null && venue.laneCount !== existing.laneCount) {
        await db
          .update(competitionVenuesTable)
          .set({ laneCount: venue.laneCount, updatedAt: timestamp })
          .where(eq(competitionVenuesTable.id, existing.id))
        updatedVenueCount += 1
      }
      continue
    }

    const venueId = createCompetitionVenueId()
    await db.insert(competitionVenuesTable).values({
      id: venueId,
      competitionId: eventId,
      name: venue.name,
      laneCount: venue.laneCount ?? 3,
      sortOrder: nextSortOrder,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    nextSortOrder += 1
    createdVenueCount += 1
    venues.push({ id: venueId, name: venue.name })
    venueByName.set(normalizeLookupValue(venue.name), {
      id: venueId,
      name: venue.name,
      laneCount: venue.laneCount ?? 3,
      sortOrder: nextSortOrder,
    })
  }

  return { venues, createdVenueCount, updatedVenueCount }
}

async function listExistingHeats(
  db: DbClient,
  eventId: string,
  trackWorkoutIds: string[],
): Promise<HeatApplyContext["existingHeats"]> {
  if (trackWorkoutIds.length === 0) return []

  return await db
    .select({
      id: competitionHeatsTable.id,
      trackWorkoutId: competitionHeatsTable.trackWorkoutId,
      heatNumber: competitionHeatsTable.heatNumber,
      schedulePublishedAt: competitionHeatsTable.schedulePublishedAt,
    })
    .from(competitionHeatsTable)
    .where(
      and(
        eq(competitionHeatsTable.competitionId, eventId),
        inArray(competitionHeatsTable.trackWorkoutId, trackWorkoutIds),
      ),
    )
}

async function createImportedHeat(
  db: DbClient,
  eventId: string,
  row: HeatApplyRowPlan,
  timestamp: Date,
) {
  if (!row.trackWorkoutId || row.heatNumber === null) {
    throw new Error(
      "Cannot create imported heat without workout and heat number",
    )
  }

  const heatId = createCompetitionHeatId()
  await db.insert(competitionHeatsTable).values({
    id: heatId,
    competitionId: eventId,
    trackWorkoutId: row.trackWorkoutId,
    heatNumber: row.heatNumber,
    scheduledTime: row.scheduledTime,
    venueId: row.venueId,
    divisionId: row.divisionId,
    durationMinutes: row.durationMinutes,
    notes: row.notes,
    schedulePublishedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  return heatId
}

async function updateImportedHeat(
  db: DbClient,
  row: HeatApplyRowPlan,
  timestamp: Date,
) {
  if (!row.targetId || !row.trackWorkoutId || row.heatNumber === null) {
    throw new Error("Cannot update imported heat without an existing heat")
  }

  await db
    .update(competitionHeatsTable)
    .set({
      trackWorkoutId: row.trackWorkoutId,
      heatNumber: row.heatNumber,
      scheduledTime: row.scheduledTime,
      venueId: row.venueId,
      divisionId: row.divisionId,
      durationMinutes: row.durationMinutes,
      notes: row.notes,
      schedulePublishedAt: null,
      updatedAt: timestamp,
    })
    .where(eq(competitionHeatsTable.id, row.targetId))
}

async function updateImportRowAudit(
  db: DbClient,
  importId: string,
  row: VolunteerApplyRowPlan | HeatApplyRowPlan,
  timestamp: Date,
) {
  await db
    .update(crewImportRowsTable)
    .set({
      targetType: toCrewImportTargetType(row.targetType),
      targetId: row.targetId,
      action: toCrewImportAction(row.action),
      warnings: toIssueList(row.warnings),
      errors: toIssueList(row.errors),
      updatedAt: timestamp,
    })
    .where(
      and(
        eq(crewImportRowsTable.importId, importId),
        eq(crewImportRowsTable.rowNumber, row.rowNumber),
      ),
    )
}

async function updateImportApplySummary(
  db: DbClient,
  importRecord: CrewImport,
  summary: CrewApplySummary,
  timestamp: Date,
  extraSummary: CrewImportApplyResult["summary"],
) {
  await db
    .update(crewImportsTable)
    .set({
      status: CREW_IMPORT_STATUS.APPLIED,
      createdCount: summary.createdCount,
      updatedCount: summary.updatedCount,
      skippedCount: summary.skippedCount,
      warningCount: summary.warningCount,
      errorCount: summary.errorCount,
      appliedAt: timestamp,
      updatedAt: timestamp,
      summary: {
        ...(importRecord.summary ?? {}),
        apply: {
          ...extraSummary,
          createdCount: summary.createdCount,
          updatedCount: summary.updatedCount,
          skippedCount: summary.skippedCount,
          errorRowCount: summary.errorRowCount,
          warningCount: summary.warningCount,
          errorCount: summary.errorCount,
          appliedAt: timestamp.toISOString(),
        },
      },
    })
    .where(eq(crewImportsTable.id, importRecord.id))
}

function toCrewImportRowInsert(
  importId: string,
  row: PreviewImportRow,
  timestamp: Date,
) {
  return {
    importId,
    rowNumber: row.rowNumber,
    rawRow: row.rawRow,
    normalizedRow: toPayload(row.normalizedRow),
    targetType:
      row.targetType === "team_invitation"
        ? CREW_IMPORT_ROW_TARGET_TYPE.TEAM_INVITATION
        : CREW_IMPORT_ROW_TARGET_TYPE.COMPETITION_HEAT,
    action:
      row.action === "skip"
        ? CREW_IMPORT_ROW_ACTION.SKIP
        : row.action === "error"
          ? CREW_IMPORT_ROW_ACTION.ERROR
          : CREW_IMPORT_ROW_ACTION.CREATE,
    warnings: toIssueList(row.warnings),
    errors: toIssueList(row.errors),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

async function requireCrewImport(eventId: string, importId: string) {
  const db = getDb()
  const [importRecord] = await db
    .select()
    .from(crewImportsTable)
    .where(
      and(
        eq(crewImportsTable.id, importId),
        eq(crewImportsTable.competitionId, eventId),
      ),
    )
    .limit(1)

  if (!importRecord) {
    throw new CrewImportError(
      "IMPORT_NOT_FOUND",
      "Crew import preview not found.",
      404,
    )
  }

  return importRecord
}

async function listCrewImportRows(importId: string) {
  const db = getDb()
  return await db
    .select()
    .from(crewImportRowsTable)
    .where(eq(crewImportRowsTable.importId, importId))
    .orderBy(asc(crewImportRowsTable.rowNumber))
}

function toPersistedPreviewRow(
  kind: CrewImport["kind"],
  row: CrewImportRow,
): PreviewImportRow {
  return {
    rowNumber: row.rowNumber,
    rawRow: toRecord(row.rawRow),
    normalizedRow:
      kind === CREW_IMPORT_KIND.VOLUNTEERS
        ? (toRecord(row.normalizedRow) as unknown as VolunteerImportRow)
        : (toRecord(row.normalizedRow) as unknown as HeatScheduleImportRow),
    targetType:
      row.targetType === CREW_IMPORT_ROW_TARGET_TYPE.COMPETITION_HEAT
        ? "competition_heat"
        : "team_invitation",
    action:
      row.action === CREW_IMPORT_ROW_ACTION.SKIP
        ? "skip"
        : row.action === CREW_IMPORT_ROW_ACTION.ERROR
          ? "error"
          : "create",
    warnings: fromIssueList(row.warnings),
    errors: fromIssueList(row.errors),
  }
}

async function listDivisionsForCrewEvent(db: DbClient, event: CrewEventRecord) {
  const scalingGroupId = getCrewEventScalingGroupId(event)
  return scalingGroupId
    ? await listDivisionsForGroupWithDb(db, scalingGroupId)
    : []
}

async function listDivisionsForGroupWithDb(
  db: DbClient,
  scalingGroupId: string,
) {
  return await db
    .select({
      id: scalingLevelsTable.id,
      label: scalingLevelsTable.label,
    })
    .from(scalingLevelsTable)
    .where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))
}

async function listWorkoutsForCompetitionWithDb(
  db: DbClient,
  eventId: string,
): Promise<HeatApplyTrackWorkout[]> {
  const rows = await db
    .select({
      id: trackWorkoutsTable.id,
      label: workouts.name,
      trackOrder: trackWorkoutsTable.trackOrder,
    })
    .from(trackWorkoutsTable)
    .innerJoin(
      programmingTracksTable,
      eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
    )
    .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
    .where(eq(programmingTracksTable.competitionId, eventId))

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    trackOrder: Number(row.trackOrder),
  }))
}

function getCrewEventScalingGroupId(event: CrewEventRecord) {
  const settings = parseCompetitionSettings(event.settings)
  return settings?.divisions?.scalingGroupId ?? null
}

function getRequiredHeatWorkoutLabels(rows: PreviewImportRow[]) {
  const labels = new Map<string, string>()
  for (const row of rows) {
    if (row.action === "error" || row.action === "skip") continue
    if (row.errors.length > 0) continue
    const heat = row.normalizedRow as HeatScheduleImportRow
    if (!heat.workout) continue
    labels.set(normalizeLookupValue(heat.workout), heat.workout)
  }
  return [...labels.values()]
}

function getRequiredHeatVenues(rows: PreviewImportRow[]) {
  const venues = new Map<string, { name: string; laneCount: number | null }>()

  for (const row of rows) {
    if (row.action === "error" || row.action === "skip") continue
    if (row.errors.length > 0) continue
    const heat = row.normalizedRow as HeatScheduleImportRow
    if (!heat.venue) continue

    const key = normalizeLookupValue(heat.venue)
    const current = venues.get(key)
    venues.set(key, {
      name: current?.name ?? heat.venue,
      laneCount: current?.laneCount ?? heat.laneCount,
    })
  }

  return venues
}

function toCrewImportTargetType(
  targetType:
    | VolunteerApplyRowPlan["targetType"]
    | HeatApplyRowPlan["targetType"],
) {
  if (targetType === "team_invitation") {
    return CREW_IMPORT_ROW_TARGET_TYPE.TEAM_INVITATION
  }
  if (targetType === "team_membership") {
    return CREW_IMPORT_ROW_TARGET_TYPE.TEAM_MEMBERSHIP
  }
  if (targetType === "competition_heat") {
    return CREW_IMPORT_ROW_TARGET_TYPE.COMPETITION_HEAT
  }
  return null
}

function toCrewImportAction(action: "create" | "update" | "skip" | "error") {
  if (action === "create") return CREW_IMPORT_ROW_ACTION.CREATE
  if (action === "update") return CREW_IMPORT_ROW_ACTION.UPDATE
  if (action === "skip") return CREW_IMPORT_ROW_ACTION.SKIP
  return CREW_IMPORT_ROW_ACTION.ERROR
}

function toApplyResult(
  importRecord: CrewImport,
  summary: CrewApplySummary,
  extraSummary: CrewImportApplyResult["summary"],
): CrewImportApplyResult {
  return {
    importId: importRecord.id,
    kind: importRecord.kind,
    status: CREW_IMPORT_STATUS.APPLIED,
    createdCount: summary.createdCount,
    updatedCount: summary.updatedCount,
    skippedCount: summary.skippedCount,
    warningCount: summary.warningCount,
    errorCount: summary.errorCount,
    summary: {
      ...extraSummary,
      errorRowCount: summary.errorRowCount,
    },
  }
}

function mergeJsonMetadata(
  existingMetadata: string | null | undefined,
  importedMetadata: string | null,
) {
  if (!existingMetadata) return importedMetadata
  if (!importedMetadata) return existingMetadata

  try {
    const existing = JSON.parse(existingMetadata) as Record<string, unknown>
    const imported = JSON.parse(importedMetadata) as Record<string, unknown>
    return JSON.stringify({ ...existing, ...imported })
  } catch {
    return importedMetadata
  }
}

async function listCrewImportHistory(
  eventId: string,
): Promise<CrewImportHistoryItem[]> {
  await requireCrewEvent(eventId)

  const db = getDb()
  return await db
    .select({
      id: crewImportsTable.id,
      kind: crewImportsTable.kind,
      status: crewImportsTable.status,
      sourcePlatform: crewImportsTable.sourcePlatform,
      originalFilename: crewImportsTable.originalFilename,
      rowCount: crewImportsTable.rowCount,
      warningCount: crewImportsTable.warningCount,
      errorCount: crewImportsTable.errorCount,
      createdCount: crewImportsTable.createdCount,
      updatedCount: crewImportsTable.updatedCount,
      skippedCount: crewImportsTable.skippedCount,
      createdAt: crewImportsTable.createdAt,
      updatedAt: crewImportsTable.updatedAt,
    })
    .from(crewImportsTable)
    .where(eq(crewImportsTable.competitionId, eventId))
    .orderBy(desc(crewImportsTable.createdAt))
    .limit(25)
}

async function loadCrewImportReferenceData(
  eventId: string,
): Promise<CrewImportReferenceData> {
  const competition = await requireCrewEvent(eventId)
  const db = getDb()
  const settings = parseCompetitionSettings(competition.settings)
  const scalingGroupId = settings?.divisions?.scalingGroupId ?? null
  const [divisions, workoutsForEvent, heats] = await Promise.all([
    scalingGroupId ? listDivisionsForGroup(scalingGroupId) : [],
    listWorkoutsForCompetition(eventId),
    db
      .select({
        trackWorkoutId: competitionHeatsTable.trackWorkoutId,
        heatNumber: competitionHeatsTable.heatNumber,
        divisionId: competitionHeatsTable.divisionId,
      })
      .from(competitionHeatsTable)
      .where(eq(competitionHeatsTable.competitionId, eventId)),
  ])

  return {
    roleLabels: defaultCrewImportRoleLabels,
    divisions,
    workouts: workoutsForEvent,
    heats,
  }
}

async function requireCrewEvent(eventId: string) {
  const db = getDb()
  const [event] = await db
    .select({
      id: competitionsTable.id,
      name: competitionsTable.name,
      organizingTeamId: competitionsTable.organizingTeamId,
      competitionTeamId: competitionsTable.competitionTeamId,
      startDate: competitionsTable.startDate,
      timezone: competitionsTable.timezone,
      settings: competitionsTable.settings,
    })
    .from(crewEventSettingsTable)
    .innerJoin(
      competitionsTable,
      eq(crewEventSettingsTable.competitionId, competitionsTable.id),
    )
    .where(eq(crewEventSettingsTable.competitionId, eventId))
    .limit(1)

  if (!event) {
    throw new CrewImportError("EVENT_NOT_FOUND", "Crew event not found.", 404)
  }

  return event
}

async function listDivisionsForGroup(scalingGroupId: string) {
  const db = getDb()
  return await listDivisionsForGroupWithDb(db, scalingGroupId)
}

async function listWorkoutsForCompetition(eventId: string) {
  const db = getDb()
  return await listWorkoutsForCompetitionWithDb(db, eventId)
}

function getCsvByteLength(csvText: string) {
  return new TextEncoder().encode(csvText).byteLength
}

function isCsvUpload(filename: string, mimeType?: string | null) {
  return isCsvFilename(filename) || isCsvMimeType(mimeType)
}

function isCsvMimeType(mimeType?: string | null) {
  if (!mimeType) return false

  const normalizedMimeType = mimeType.split(";")[0]?.trim().toLowerCase()
  return (
    normalizedMimeType === "text/csv" ||
    normalizedMimeType === "application/csv" ||
    normalizedMimeType === "application/vnd.ms-excel"
  )
}

function isCsvFilename(filename: string) {
  return filename.toLowerCase().endsWith(".csv")
}

function toIssueList(issues: PreviewImportRow["warnings"]) {
  return issues.map((issue) => ({ ...issue }) as Record<string, unknown>)
}

function fromIssueList(value: CrewImportRow["warnings"]): ImportIssue[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((issue) => {
    if (!issue || typeof issue !== "object") return []
    const record = issue as Record<string, unknown>
    const code = typeof record.code === "string" ? record.code : "import_issue"
    const severity =
      record.severity === "error" || record.severity === "warning"
        ? record.severity
        : "warning"
    const message =
      typeof record.message === "string" ? record.message : "Import issue."

    return [
      {
        code,
        severity,
        message,
        field: typeof record.field === "string" ? record.field : undefined,
        rowNumber:
          typeof record.rowNumber === "number" ? record.rowNumber : undefined,
        value: typeof record.value === "string" ? record.value : undefined,
      },
    ]
  })
}

function toRecord(value: CrewImportRow["rawRow"]) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, string>)
    : {}
}

function toPayload(row: PreviewImportRow["normalizedRow"]) {
  return { ...row } as Record<string, unknown>
}
