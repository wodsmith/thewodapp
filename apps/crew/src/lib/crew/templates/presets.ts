// @lat: [[crew#Role And Shift Templates]]
import {
  VOLUNTEER_ROLE_TYPE_VALUES,
  type VolunteerRoleType,
} from "../../../db/schemas/volunteers"
import type {
  CrewRoleShiftTemplate,
  CrewRoleShiftTemplateRole,
  CrewRoleShiftTemplateShift,
} from "./types"

const presetSchemaVersion = 1
const maxRoles = 40
const maxShifts = 120

export interface CrewRoleShiftTemplatePresetPayload {
  schemaVersion: 1
  sourceTemplateId: string | null
  roles: CrewRoleShiftTemplateRole[]
  shifts: CrewRoleShiftTemplateShift[]
  staffingAssumptions: string
}

export function serializeCrewTemplatePresetPayload(
  template: CrewRoleShiftTemplate,
): CrewRoleShiftTemplatePresetPayload {
  return {
    schemaVersion: presetSchemaVersion,
    sourceTemplateId: template.source === "built_in" ? template.id : null,
    roles: normalizeRoles(template.roles),
    shifts: normalizeShifts(template.shifts),
    staffingAssumptions: template.staffingAssumptions.trim(),
  }
}

export function parseCrewTemplatePresetPayload(
  value: unknown,
): CrewRoleShiftTemplatePresetPayload | null {
  if (!isPlainObject(value) || value.schemaVersion !== presetSchemaVersion) {
    return null
  }

  const roles = Array.isArray(value.roles) ? normalizeRoles(value.roles) : []
  const shifts = Array.isArray(value.shifts)
    ? normalizeShifts(value.shifts)
    : []
  const staffingAssumptions =
    typeof value.staffingAssumptions === "string"
      ? value.staffingAssumptions.trim()
      : ""

  if (roles.length === 0 && shifts.length === 0 && !staffingAssumptions) {
    return null
  }

  return {
    schemaVersion: presetSchemaVersion,
    sourceTemplateId:
      typeof value.sourceTemplateId === "string"
        ? value.sourceTemplateId
        : null,
    roles,
    shifts,
    staffingAssumptions,
  }
}

export function buildTemplateFromPreset(input: {
  presetId: string
  name: string
  description: string | null
  payload: CrewRoleShiftTemplatePresetPayload
}): CrewRoleShiftTemplate {
  return {
    id: `preset:${input.presetId}`,
    presetId: input.presetId,
    name: input.name,
    description: input.description ?? "Saved team template",
    source: "team_preset",
    roles: input.payload.roles,
    shifts: input.payload.shifts,
    staffingAssumptions: input.payload.staffingAssumptions,
  }
}

function normalizeRoles(values: unknown[]) {
  const roles: CrewRoleShiftTemplateRole[] = []
  const seen = new Set<VolunteerRoleType>()

  for (const value of values) {
    if (!isPlainObject(value) || roles.length >= maxRoles) continue
    const roleType = readRoleType(value.roleType)
    if (!roleType || seen.has(roleType)) continue
    seen.add(roleType)
    roles.push({
      roleType,
      targetCount: readPositiveInteger(value.targetCount, 1, 500),
      notes: readOptionalText(value.notes, 1000),
    })
  }

  return roles
}

function normalizeShifts(values: unknown[]) {
  const shifts: CrewRoleShiftTemplateShift[] = []
  const seen = new Set<string>()

  for (const value of values) {
    if (!isPlainObject(value) || shifts.length >= maxShifts) continue
    const roleType = readRoleType(value.roleType)
    const name = readRequiredText(value.name, 200)
    const key = readRequiredText(value.key, 100) || slugKey(name)
    const startTime = readTime(value.startTime)
    const endTime = readTime(value.endTime)
    if (!roleType || !name || !startTime || !endTime || seen.has(key)) {
      continue
    }
    seen.add(key)
    shifts.push({
      key,
      name,
      roleType,
      dayOffset: readInteger(value.dayOffset, 0, 30),
      startTime,
      endTime,
      capacity: readPositiveInteger(value.capacity, 1, 500),
      location: readOptionalText(value.location, 200),
      notes: readOptionalText(value.notes, 1000),
    })
  }

  return shifts
}

function readRoleType(value: unknown): VolunteerRoleType | null {
  return typeof value === "string" &&
    VOLUNTEER_ROLE_TYPE_VALUES.includes(value as VolunteerRoleType)
    ? (value as VolunteerRoleType)
    : null
}

function readRequiredText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function readOptionalText(value: unknown, maxLength: number) {
  const text = readRequiredText(value, maxLength)
  return text || undefined
}

function readInteger(value: unknown, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return min
  return Math.min(Math.max(Math.trunc(parsed), min), max)
}

function readPositiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const rounded = Math.trunc(parsed)
  return rounded > 0 ? Math.min(rounded, max) : fallback
}

function readTime(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return /^([01]?\d|2[0-3]):([0-5]\d)$/.test(trimmed) ? trimmed : null
}

function slugKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
