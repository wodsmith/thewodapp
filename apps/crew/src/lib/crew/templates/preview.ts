// @lat: [[crew#Role And Shift Templates]]
import { formatDateTimeInTimezone } from "../../../utils/timezone-utils"
import { normalizeCrewShiftTimes } from "../roster-shifts"
import type {
  CrewRoleShiftTemplate,
  CrewTemplateApplyPlan,
  CrewTemplateEventContext,
  CrewTemplatePreview,
  CrewTemplateShiftPreview,
} from "./types"

export function buildCrewTemplatePreview(
  template: CrewRoleShiftTemplate,
  context: CrewTemplateEventContext,
): CrewTemplatePreview {
  const shifts = template.shifts.map((shift) =>
    buildShiftPreview(template.id, shift, context),
  )
  const warnings = buildPreviewWarnings(context, shifts)
  const duplicateShifts = shifts.filter(
    (shift) => shift.status === "already_exists",
  ).length
  const outsideEventDateShifts = shifts.filter(
    (shift) => shift.status === "outside_event_dates",
  ).length

  return {
    template,
    roles: template.roles,
    shifts,
    staffingAssumptions: template.staffingAssumptions,
    summary: {
      roles: template.roles.length,
      shifts: shifts.length,
      newShifts: shifts.filter((shift) => shift.status === "new").length,
      duplicateShifts,
      outsideEventDateShifts,
      canFillAssumptions:
        template.staffingAssumptions.trim().length > 0 &&
        context.existingAssumptions.trim().length === 0,
      warnings,
    },
  }
}

export function buildCrewTemplateApplyPlan(
  preview: CrewTemplatePreview,
  options: { fillEmptyAssumptions: boolean },
): CrewTemplateApplyPlan {
  return {
    mode: "append_missing",
    shiftsToCreate: preview.shifts.filter((shift) => shift.status === "new"),
    assumptionsToWrite:
      options.fillEmptyAssumptions && preview.summary.canFillAssumptions
        ? preview.staffingAssumptions
        : null,
  }
}

function buildShiftPreview(
  templateId: string,
  shift: CrewRoleShiftTemplate["shifts"][number],
  context: CrewTemplateEventContext,
): CrewTemplateShiftPreview {
  const date = addDaysToDateString(context.startDate, shift.dayOffset)
  const existingShiftId = date
    ? findMatchingExistingShiftId(
        {
          name: shift.name,
          roleType: shift.roleType,
          date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          location: shift.location ?? null,
        },
        context,
      )
    : null
  const outsideEventDates =
    date !== null &&
    ((context.startDate !== null && date < context.startDate) ||
      (context.endDate !== null && date > context.endDate))

  return {
    key: `${templateId}:${shift.key}`,
    name: shift.name,
    roleType: shift.roleType,
    date,
    startTime: shift.startTime,
    endTime: shift.endTime,
    capacity: shift.capacity,
    location: emptyToNull(shift.location),
    notes: emptyToNull(shift.notes),
    status: existingShiftId
      ? "already_exists"
      : outsideEventDates || date === null
        ? "outside_event_dates"
        : "new",
    existingShiftId,
  }
}

function findMatchingExistingShiftId(
  shift: {
    name: string
    roleType: string
    date: string
    startTime: string
    endTime: string
    location: string | null
  },
  context: CrewTemplateEventContext,
) {
  const normalized = normalizeCrewShiftTimes({
    date: shift.date,
    startTime: shift.startTime,
    endTime: shift.endTime,
    timezone: context.timezone,
  })
  const startMs = normalized.startTime.getTime()
  const endMs = normalized.endTime.getTime()
  const location = normalizeText(shift.location)

  return (
    context.existingShifts.find((existing) => {
      const existingStart = toDate(existing.startTime)
      const existingEnd = toDate(existing.endTime)
      return (
        normalizeText(existing.name) === normalizeText(shift.name) &&
        existing.roleType === shift.roleType &&
        existingStart?.getTime() === startMs &&
        existingEnd?.getTime() === endMs &&
        normalizeText(existing.location) === location
      )
    })?.id ?? null
  )
}

function buildPreviewWarnings(
  context: CrewTemplateEventContext,
  shifts: CrewTemplateShiftPreview[],
) {
  const warnings: string[] = []

  if (!context.startDate) {
    warnings.push("Event start date is required before shifts can be applied.")
  }
  if (
    shifts.some((shift) => shift.status === "outside_event_dates") &&
    context.endDate
  ) {
    warnings.push("Some template shifts fall outside the event date range.")
  }

  return warnings
}

function addDaysToDateString(date: string | null, dayOffset: number) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const [year, month, day] = date.split("-").map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + dayOffset))
  if (Number.isNaN(next.getTime())) return null
  return formatDateTimeInTimezone(next, "UTC", "yyyy-MM-dd")
}

function toDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ""
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
