// @lat: [[crew#Role And Shift Templates]]
import { and, desc, eq } from "drizzle-orm"
import { getDb } from "../db"
import { competitionsTable } from "../db/schemas/competitions"
import { crewEventSettingsTable } from "../db/schemas/crew-event-settings"
import {
  CREW_TEMPLATE_PRESET_KIND,
  type CrewTemplatePresetData,
  type CrewTemplatePresetMetadata,
  crewTemplatePresetsTable,
} from "../db/schemas/crew-self-serve-presets"
import { volunteerShiftsTable } from "../db/schemas/volunteers"
import {
  parseCrewSettings,
  serializeCrewSettings,
} from "../lib/crew-event-setup"
import {
  buildCrewTemplateApplyPlan,
  buildCrewTemplatePreview,
  buildTemplateFromPreset,
  builtInCrewRoleShiftTemplates,
  getBuiltInCrewRoleShiftTemplate,
  parseCrewTemplatePresetPayload,
  serializeCrewTemplatePresetPayload,
  type CrewRoleShiftTemplate,
  type CrewRoleShiftTemplateRef,
  type CrewTemplateEventContext,
  type CrewTemplatePreview,
} from "../lib/crew/templates"
import { normalizeCrewShiftTimes } from "../lib/crew/roster-shifts"
import { requireLocalCrewOperatorAccess } from "./crew-local-access"
import { DEFAULT_TIMEZONE } from "../utils/timezone-utils"

type DbClient = ReturnType<typeof getDb>

interface CrewTemplateEventInput {
  eventId: string
}

interface CrewTemplateMutationInput extends CrewTemplateEventInput {
  templateRef: CrewRoleShiftTemplateRef
}

interface ApplyCrewTemplateInput extends CrewTemplateMutationInput {
  mode: "append_missing"
  fillEmptyAssumptions: boolean
}

interface SaveCrewTemplatePresetInput extends CrewTemplateMutationInput {
  name: string
  description?: string | null
}

interface CrewTemplateEvent {
  id: string
  name: string
  organizingTeamId: string
  startDate: string | null
  endDate: string | null
  timezone: string | null
  settingsText: string | null
}

export interface CrewTemplatePageData {
  event: {
    id: string
    name: string
    startDate: string | null
    endDate: string | null
    timezone: string
  }
  templates: CrewRoleShiftTemplate[]
  context: CrewTemplateEventContext
}

export interface ApplyCrewTemplateResult {
  success: true
  preview: CrewTemplatePreview
  createdShiftCount: number
  skippedShiftCount: number
  assumptionsUpdated: boolean
}

export interface SaveCrewTemplatePresetResult {
  success: true
  presetId: string
  template: CrewRoleShiftTemplate
}

export async function getCrewTemplatePage(
  data: CrewTemplateEventInput,
): Promise<CrewTemplatePageData> {
  requireLocalCrewOperatorAccess("Crew templates")

  const event = await requireCrewTemplateEvent(data.eventId)
  const [savedTemplates, context] = await Promise.all([
    loadTeamPresetTemplates(event.organizingTeamId),
    buildTemplateEventContext(event),
  ])

  return {
    event: {
      id: event.id,
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      timezone: event.timezone ?? DEFAULT_TIMEZONE,
    },
    templates: [...builtInCrewRoleShiftTemplates, ...savedTemplates],
    context,
  }
}

export async function applyCrewTemplate(
  data: ApplyCrewTemplateInput,
): Promise<ApplyCrewTemplateResult> {
  requireLocalCrewOperatorAccess("Crew templates")

  if (data.mode !== "append_missing") {
    throw new Error("Unsupported template apply mode")
  }

  const db = getDb()
  const event = await requireCrewTemplateEvent(data.eventId)
  const template = await resolveCrewTemplate(event.organizingTeamId, data)
  const context = await buildTemplateEventContext(event)
  const preview = buildCrewTemplatePreview(template, context)
  const plan = buildCrewTemplateApplyPlan(preview, {
    fillEmptyAssumptions: data.fillEmptyAssumptions,
  })

  let createdShiftCount = 0
  let assumptionsUpdated = false

  await db.transaction(async (tx) => {
    const client = tx as unknown as DbClient
    const lockedEvent = await requireCrewTemplateEventForUpdate(
      client,
      event.id,
    )
    const transactionContext = await buildTemplateEventContext(
      lockedEvent,
      client,
    )
    const transactionPreview = buildCrewTemplatePreview(
      template,
      transactionContext,
    )
    const transactionPlan = buildCrewTemplateApplyPlan(transactionPreview, {
      fillEmptyAssumptions: data.fillEmptyAssumptions,
    })

    for (const shift of transactionPlan.shiftsToCreate) {
      if (!shift.date) continue
      const { startTime, endTime } = normalizeCrewShiftTimes({
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        timezone: transactionContext.timezone,
      })
      await tx.insert(volunteerShiftsTable).values({
        competitionId: lockedEvent.id,
        name: shift.name,
        roleType: shift.roleType,
        startTime,
        endTime,
        location: shift.location,
        capacity: shift.capacity,
        notes: shift.notes,
      })
      createdShiftCount += 1
    }

    if (transactionPlan.assumptionsToWrite) {
      const parsed = parseCrewSettings(lockedEvent.settingsText)
      if (parsed.setup.assumptions.trim().length === 0) {
        await tx
          .update(crewEventSettingsTable)
          .set({
            settings: serializeCrewSettings(lockedEvent.settingsText, {
              ...parsed.setup,
              assumptions: transactionPlan.assumptionsToWrite,
              checklist: {
                ...parsed.setup.checklist,
                staffingPlanDrafted: true,
              },
            }),
            updatedAt: new Date(),
          })
          .where(eq(crewEventSettingsTable.competitionId, lockedEvent.id))
        assumptionsUpdated = true
      }
    }
  })

  return {
    success: true,
    preview,
    createdShiftCount,
    skippedShiftCount: plan.shiftsToCreate.length - createdShiftCount,
    assumptionsUpdated,
  }
}

export async function saveCrewTemplatePreset(
  data: SaveCrewTemplatePresetInput,
): Promise<SaveCrewTemplatePresetResult> {
  requireLocalCrewOperatorAccess("Crew templates")

  const event = await requireCrewTemplateEvent(data.eventId)
  const template = await resolveCrewTemplate(event.organizingTeamId, data)
  const db = getDb()
  const [inserted] = await db
    .insert(crewTemplatePresetsTable)
    .values({
      teamId: event.organizingTeamId,
      competitionId: event.id,
      kind: CREW_TEMPLATE_PRESET_KIND.STAFFING_TEMPLATE,
      name: data.name.trim(),
      description: emptyToNull(data.description),
      presetData: serializeCrewTemplatePresetPayload(
        template,
      ) as unknown as CrewTemplatePresetData,
      metadata: {
        sourceTemplateId: template.source === "built_in" ? template.id : null,
        sourcePresetId: template.presetId ?? null,
        savedFromEventId: event.id,
      } satisfies CrewTemplatePresetMetadata,
    })
    .$returningId()

  if (!inserted?.id) {
    throw new Error("Template preset could not be saved")
  }

  const savedTemplate = await loadTeamPresetTemplate(
    event.organizingTeamId,
    inserted.id,
  )
  if (!savedTemplate) {
    throw new Error("Template preset could not be loaded")
  }

  return {
    success: true,
    presetId: inserted.id,
    template: savedTemplate,
  }
}

async function requireCrewTemplateEvent(
  eventId: string,
): Promise<CrewTemplateEvent> {
  const db = getDb()
  const [event] = await db
    .select({
      id: competitionsTable.id,
      name: competitionsTable.name,
      organizingTeamId: competitionsTable.organizingTeamId,
      startDate: competitionsTable.startDate,
      endDate: competitionsTable.endDate,
      timezone: competitionsTable.timezone,
      settingsText: crewEventSettingsTable.settings,
    })
    .from(crewEventSettingsTable)
    .innerJoin(
      competitionsTable,
      eq(crewEventSettingsTable.competitionId, competitionsTable.id),
    )
    .where(eq(crewEventSettingsTable.competitionId, eventId))
    .limit(1)

  if (!event) {
    throw new Error("Crew event not found")
  }

  return event
}

async function requireCrewTemplateEventForUpdate(
  db: DbClient,
  eventId: string,
): Promise<CrewTemplateEvent> {
  const [event] = await db
    .select({
      id: competitionsTable.id,
      name: competitionsTable.name,
      organizingTeamId: competitionsTable.organizingTeamId,
      startDate: competitionsTable.startDate,
      endDate: competitionsTable.endDate,
      timezone: competitionsTable.timezone,
      settingsText: crewEventSettingsTable.settings,
    })
    .from(crewEventSettingsTable)
    .innerJoin(
      competitionsTable,
      eq(crewEventSettingsTable.competitionId, competitionsTable.id),
    )
    .where(eq(crewEventSettingsTable.competitionId, eventId))
    .limit(1)
    .for("update")

  if (!event) {
    throw new Error("Crew event not found")
  }

  return event
}

async function buildTemplateEventContext(
  event: CrewTemplateEvent,
  db: DbClient = getDb(),
): Promise<CrewTemplateEventContext> {
  const shifts = await db
    .select({
      id: volunteerShiftsTable.id,
      name: volunteerShiftsTable.name,
      roleType: volunteerShiftsTable.roleType,
      startTime: volunteerShiftsTable.startTime,
      endTime: volunteerShiftsTable.endTime,
      location: volunteerShiftsTable.location,
      capacity: volunteerShiftsTable.capacity,
    })
    .from(volunteerShiftsTable)
    .where(eq(volunteerShiftsTable.competitionId, event.id))

  return {
    eventId: event.id,
    startDate: event.startDate,
    endDate: event.endDate,
    timezone: event.timezone ?? DEFAULT_TIMEZONE,
    existingShifts: shifts,
    existingAssumptions: parseCrewSettings(event.settingsText).setup
      .assumptions,
  }
}

async function resolveCrewTemplate(
  teamId: string,
  data: CrewTemplateMutationInput,
): Promise<CrewRoleShiftTemplate> {
  if (data.templateRef.source === "built_in") {
    const templateId = data.templateRef.templateId ?? ""
    const template = getBuiltInCrewRoleShiftTemplate(templateId)
    if (!template) {
      throw new Error("Built-in Crew template not found")
    }
    return template
  }

  if (data.templateRef.source === "team_preset") {
    const presetId = data.templateRef.presetId ?? ""
    const template = await loadTeamPresetTemplate(teamId, presetId)
    if (!template) {
      throw new Error("Saved Crew template preset not found")
    }
    return template
  }

  throw new Error("Crew template not found")
}

async function loadTeamPresetTemplates(teamId: string) {
  const db = getDb()
  const presets = await db
    .select({
      id: crewTemplatePresetsTable.id,
      name: crewTemplatePresetsTable.name,
      description: crewTemplatePresetsTable.description,
      presetData: crewTemplatePresetsTable.presetData,
    })
    .from(crewTemplatePresetsTable)
    .where(
      and(
        eq(crewTemplatePresetsTable.teamId, teamId),
        eq(
          crewTemplatePresetsTable.kind,
          CREW_TEMPLATE_PRESET_KIND.STAFFING_TEMPLATE,
        ),
        eq(crewTemplatePresetsTable.isArchived, false),
      ),
    )
    .orderBy(desc(crewTemplatePresetsTable.updatedAt))

  return presets.flatMap((preset) => {
    const payload = parseCrewTemplatePresetPayload(preset.presetData)
    return payload
      ? [
          buildTemplateFromPreset({
            presetId: preset.id,
            name: preset.name,
            description: preset.description,
            payload,
          }),
        ]
      : []
  })
}

async function loadTeamPresetTemplate(teamId: string, presetId: string) {
  const db = getDb()
  const [preset] = await db
    .select({
      id: crewTemplatePresetsTable.id,
      name: crewTemplatePresetsTable.name,
      description: crewTemplatePresetsTable.description,
      presetData: crewTemplatePresetsTable.presetData,
    })
    .from(crewTemplatePresetsTable)
    .where(
      and(
        eq(crewTemplatePresetsTable.id, presetId),
        eq(crewTemplatePresetsTable.teamId, teamId),
        eq(
          crewTemplatePresetsTable.kind,
          CREW_TEMPLATE_PRESET_KIND.STAFFING_TEMPLATE,
        ),
        eq(crewTemplatePresetsTable.isArchived, false),
      ),
    )
    .limit(1)

  const payload = preset
    ? parseCrewTemplatePresetPayload(preset.presetData)
    : null
  return preset && payload
    ? buildTemplateFromPreset({
        presetId: preset.id,
        name: preset.name,
        description: preset.description,
        payload,
      })
    : null
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
