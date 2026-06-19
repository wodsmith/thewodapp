// @lat: [[crew#Import CSV Preview#Preview Records]]
import { desc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import {
  CREW_IMPORT_KIND,
  CREW_IMPORT_ROW_ACTION,
  CREW_IMPORT_ROW_TARGET_TYPE,
  CREW_IMPORT_STATUS,
  crewImportRowsTable,
  crewImportsTable,
  type CrewImport,
} from "../db/schemas/crew-imports"
import { createCrewImportId } from "../db/schemas/common"
import {
  competitionHeatsTable,
  competitionsTable,
} from "../db/schemas/competitions"
import { crewEventSettingsTable } from "../db/schemas/crew-event-settings"
import {
  programmingTracksTable,
  trackWorkoutsTable,
} from "../db/schemas/programming"
import { scalingLevelsTable } from "../db/schemas/scaling"
import { workouts } from "../db/schemas/workouts"
import { getDb } from "../db"
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
  type PreviewImportRow,
} from "../lib/crew/imports/types"
import { parseCompetitionSettings } from "../utils/competition-settings"
import { requireLocalCrewOperatorAccess } from "./crew-local-access"

export const MAX_CREW_IMPORT_BYTES = 1_000_000

export type CrewImportErrorCode =
  | "EVENT_NOT_FOUND"
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
  return await db
    .select({
      id: scalingLevelsTable.id,
      label: scalingLevelsTable.label,
    })
    .from(scalingLevelsTable)
    .where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))
}

async function listWorkoutsForCompetition(eventId: string) {
  const db = getDb()
  const tracks = await db
    .select({ id: programmingTracksTable.id })
    .from(programmingTracksTable)
    .where(eq(programmingTracksTable.competitionId, eventId))

  if (tracks.length === 0) return []

  const trackIds = tracks.map((track) => track.id)
  const rows = await db
    .select({
      id: trackWorkoutsTable.id,
      label: workouts.name,
      trackOrder: trackWorkoutsTable.trackOrder,
    })
    .from(trackWorkoutsTable)
    .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
    .where(inArray(trackWorkoutsTable.trackId, trackIds))

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    trackOrder: Number(row.trackOrder),
  }))
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

function toPayload(row: PreviewImportRow["normalizedRow"]) {
  return { ...row } as Record<string, unknown>
}
