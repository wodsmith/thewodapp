// @lat: [[crew#Pilot Exports]]
// @lat: [[crew#Event Day Export Packet]]
import type {
  CrewAssignmentConfirmationStatus,
  CrewAssignmentConfirmationType,
} from "../../../db/schemas/crew-imports"
import {
  VOLUNTEER_ROLE_LABELS,
  VOLUNTEER_ROLE_TYPES,
  type VolunteerRoleType,
} from "../../../db/schemas/volunteers"

export interface CrewPilotExportEventInput {
  id: string
  name: string
  slug?: string | null
  timezone?: string | null
  startDate?: string | null
  endDate?: string | null
}

export interface CrewPilotExportVenueInput {
  id: string
  name: string
  laneCount?: number | null
  sortOrder?: number | null
}

export interface CrewPilotExportWorkoutInput {
  id: string
  name: string
  sortOrder?: number | null
}

export interface CrewPilotExportHeatInput {
  id: string
  trackWorkoutId: string
  heatNumber: number
  venueId?: string | null
  scheduledTime?: Date | string | null
  durationMinutes?: number | null
  laneCount?: number | null
}

export interface CrewPilotExportHeatLaneInput {
  heatId: string
  laneNumber: number
}

export interface CrewPilotExportConfirmationInput {
  type: CrewAssignmentConfirmationType
  status: CrewAssignmentConfirmationStatus
  sentAt?: Date | string | null
  respondedAt?: Date | string | null
  responseNote?: string | null
}

export interface CrewPilotExportAssignmentInput {
  id: string
  membershipId: string
  volunteerName: string
  email?: string | null
  confirmation?: CrewPilotExportConfirmationInput | null
}

export interface CrewPilotExportShiftInput {
  id: string
  name: string
  roleType: VolunteerRoleType
  startTime: Date | string
  endTime: Date | string
  capacity: number
  location?: string | null
  assignments: CrewPilotExportAssignmentInput[]
}

export interface CrewPilotExportJudgeAssignmentInput
  extends CrewPilotExportAssignmentInput {
  heatId: string
  laneNumber?: number | null
  position?: VolunteerRoleType | null
}

export interface CrewPilotExportInput {
  event: CrewPilotExportEventInput
  generatedAt: Date | string
  shifts?: CrewPilotExportShiftInput[]
  venues?: CrewPilotExportVenueInput[]
  workouts?: CrewPilotExportWorkoutInput[]
  heats?: CrewPilotExportHeatInput[]
  heatLaneAssignments?: CrewPilotExportHeatLaneInput[]
  judgeAssignments?: CrewPilotExportJudgeAssignmentInput[]
}

export type CrewPilotExportBlockType = "shift" | "heat"

export interface CrewPilotMasterScheduleRow {
  blockType: CrewPilotExportBlockType
  blockId: string
  startsAt: string | null
  endsAt: string | null
  label: string
  location: string
  role: string
  needed: number
  assigned: number
  open: number
  people: string
  confirmationSummary: string
}

export interface CrewPilotMasterScheduleDaySection {
  dayKey: string
  rows: CrewPilotMasterScheduleRow[]
}

export interface CrewPilotJudgeLaneRow {
  heatId: string
  workoutName: string
  heatNumber: number
  venueName: string
  startsAt: string | null
  endsAt: string | null
  laneNumber: number
  assignmentId: string | null
  judgeName: string
  email: string
  position: string
  confirmationStatus: string
}

export interface CrewPilotJudgeHeatLaneSheet {
  heatId: string
  label: string
  heatNumber: number
  startsAt: string | null
  endsAt: string | null
  venueName: string
  rows: CrewPilotJudgeLaneRow[]
}

export interface CrewPilotJudgeEventSection {
  workoutId: string
  workoutName: string
  heats: CrewPilotJudgeHeatLaneSheet[]
}

export interface CrewPilotShiftSheetRow {
  rowKey: string
  assignmentId: string | null
  volunteerName: string
  confirmationStatus: string
  isOpen: boolean
}

export interface CrewPilotShiftSheet {
  shiftId: string
  name: string
  roleType: VolunteerRoleType
  roleLabel: string
  startsAt: string | null
  endsAt: string | null
  location: string
  needed: number
  assigned: number
  open: number
  rows: CrewPilotShiftSheetRow[]
}

export interface CrewPilotExports {
  generatedAt: string
  summary: {
    masterScheduleRows: number
    masterScheduleDaySections: number
    judgeEventSections: number
    judgeHeatSheets: number
    shiftSheets: number
  }
  masterScheduleRows: CrewPilotMasterScheduleRow[]
  masterScheduleDaySections: CrewPilotMasterScheduleDaySection[]
  masterScheduleCsv: string
  judgeEventSections: CrewPilotJudgeEventSection[]
  shiftSheets: CrewPilotShiftSheet[]
}

interface NormalizedHeat {
  input: CrewPilotExportHeatInput
  workoutId: string
  workoutName: string
  workoutSortOrder: number | null
  venueName: string
  startsAt: Date | null
  endsAt: Date | null
  laneNumbers: number[]
}

export function buildCrewPilotExports(
  input: CrewPilotExportInput,
): CrewPilotExports {
  const generatedAt = toIsoString(input.generatedAt)
  if (!generatedAt) {
    throw new Error("Crew pilot exports generatedAt is required")
  }

  const venues = [...(input.venues ?? [])].sort(compareVenue)
  const workouts = [...(input.workouts ?? [])].sort(compareWorkout)
  const shifts = [...(input.shifts ?? [])].sort(compareShift)
  const heats = [...(input.heats ?? [])].sort(compareHeat)
  const heatLaneAssignments = [...(input.heatLaneAssignments ?? [])].sort(
    compareHeatLaneAssignment,
  )
  const judgeAssignments = [...(input.judgeAssignments ?? [])].sort(
    compareJudgeAssignment,
  )
  const venueById = new Map(venues.map((venue) => [venue.id, venue]))
  const workoutById = new Map(workouts.map((workout) => [workout.id, workout]))
  const judgeAssignmentsByHeatId = groupBy(
    judgeAssignments,
    (assignment) => assignment.heatId,
  )
  const normalizedHeats = heats.map((heat) =>
    normalizeHeat(heat, {
      venueById,
      workoutById,
      heatLaneAssignments,
    }),
  )

  const masterScheduleRows = [
    ...shifts.map(buildShiftMasterScheduleRow),
    ...normalizedHeats.map((heat) =>
      buildHeatMasterScheduleRow(
        heat,
        judgeAssignmentsByHeatId.get(heat.input.id) ?? [],
      ),
    ),
  ].sort(compareMasterScheduleRow)
  const masterScheduleDaySections = buildMasterScheduleDaySections(
    masterScheduleRows,
    input.event.timezone,
  )
  const judgeHeatLaneSheets = normalizedHeats.map((heat) =>
    buildJudgeHeatLaneSheet(
      heat,
      judgeAssignmentsByHeatId.get(heat.input.id) ?? [],
    ),
  )
  const sheetByHeatId = new Map(
    judgeHeatLaneSheets.map((sheet) => [sheet.heatId, sheet]),
  )
  const judgeEventSections = buildJudgeEventSections(
    normalizedHeats,
    sheetByHeatId,
  )
  const shiftSheets = buildShiftSheets(shifts)

  return {
    generatedAt,
    summary: {
      masterScheduleRows: masterScheduleRows.length,
      masterScheduleDaySections: masterScheduleDaySections.length,
      judgeEventSections: judgeEventSections.length,
      judgeHeatSheets: judgeHeatLaneSheets.length,
      shiftSheets: shiftSheets.length,
    },
    masterScheduleRows,
    masterScheduleDaySections,
    masterScheduleCsv: buildCsv(
      [
        "Type",
        "Start",
        "End",
        "Label",
        "Location",
        "Role",
        "Needed",
        "Assigned",
        "Open",
        "People",
        "Confirmations",
      ],
      masterScheduleRows.map((row) => [
        row.blockType,
        row.startsAt ?? "",
        row.endsAt ?? "",
        row.label,
        row.location,
        row.role,
        row.needed,
        row.assigned,
        row.open,
        row.people,
        row.confirmationSummary,
      ]),
    ),
    judgeEventSections,
    shiftSheets,
  }
}

function buildShiftMasterScheduleRow(
  shift: CrewPilotExportShiftInput,
): CrewPilotMasterScheduleRow {
  const assigned = shift.assignments.length
  return {
    blockType: "shift",
    blockId: shift.id,
    startsAt: toIsoString(shift.startTime),
    endsAt: toIsoString(shift.endTime),
    label: shift.name,
    location: shift.location || "Unassigned",
    role: formatRole(shift.roleType),
    needed: shift.capacity,
    assigned,
    open: Math.max(shift.capacity - assigned, 0),
    people: formatPeople(shift.assignments),
    confirmationSummary: formatConfirmationSummary(shift.assignments),
  }
}

function buildHeatMasterScheduleRow(
  heat: NormalizedHeat,
  assignments: CrewPilotExportJudgeAssignmentInput[],
): CrewPilotMasterScheduleRow {
  const laneCount = heat.laneNumbers.length
  const assignedLanes = new Set(
    assignments
      .map((assignment) => positiveIntegerOrNull(assignment.laneNumber))
      .filter((laneNumber): laneNumber is number =>
        laneNumber ? heat.laneNumbers.includes(laneNumber) : false,
      ),
  ).size
  return {
    blockType: "heat",
    blockId: heat.input.id,
    startsAt: toIsoString(heat.startsAt),
    endsAt: toIsoString(heat.endsAt),
    label: `${heat.workoutName} - Heat ${heat.input.heatNumber}`,
    location: heat.venueName,
    role: "Judge lanes",
    needed: laneCount,
    assigned: assignedLanes,
    open: Math.max(laneCount - assignedLanes, 0),
    people: formatPeople(assignments),
    confirmationSummary: formatConfirmationSummary(assignments),
  }
}

function buildJudgeHeatLaneSheet(
  heat: NormalizedHeat,
  assignments: CrewPilotExportJudgeAssignmentInput[],
): CrewPilotJudgeHeatLaneSheet {
  const assignmentsByLane = new Map<
    number,
    CrewPilotExportJudgeAssignmentInput
  >()
  for (const assignment of assignments) {
    const laneNumber = positiveIntegerOrNull(assignment.laneNumber)
    if (!laneNumber || assignmentsByLane.has(laneNumber)) continue
    assignmentsByLane.set(laneNumber, assignment)
  }

  const rows = heat.laneNumbers.map<CrewPilotJudgeLaneRow>((laneNumber) => {
    const assignment = assignmentsByLane.get(laneNumber)
    return {
      heatId: heat.input.id,
      workoutName: heat.workoutName,
      heatNumber: heat.input.heatNumber,
      venueName: heat.venueName,
      startsAt: toIsoString(heat.startsAt),
      endsAt: toIsoString(heat.endsAt),
      laneNumber,
      assignmentId: assignment?.id ?? null,
      judgeName: assignment?.volunteerName ?? "OPEN",
      email: assignment?.email ?? "",
      position: formatRole(getJudgeRoleType(assignment?.position)),
      confirmationStatus: formatConfirmationStatus(
        assignment?.confirmation ?? null,
      ),
    }
  })

  return {
    heatId: heat.input.id,
    label: `${heat.workoutName} - Heat ${heat.input.heatNumber}`,
    heatNumber: heat.input.heatNumber,
    startsAt: toIsoString(heat.startsAt),
    endsAt: toIsoString(heat.endsAt),
    venueName: heat.venueName,
    rows,
  }
}

function buildJudgeEventSections(
  normalizedHeats: NormalizedHeat[],
  sheetByHeatId: Map<string, CrewPilotJudgeHeatLaneSheet>,
): CrewPilotJudgeEventSection[] {
  const heatsByWorkoutId = groupBy(normalizedHeats, (heat) => heat.workoutId)

  return [...heatsByWorkoutId.entries()]
    .map(([workoutId, heats]) => ({
      workoutId,
      workoutName: heats[0]?.workoutName ?? "Workout",
      sortOrder: heats[0]?.workoutSortOrder ?? null,
      heats: heats
        .map((heat) => sheetByHeatId.get(heat.input.id))
        .filter((sheet): sheet is CrewPilotJudgeHeatLaneSheet =>
          Boolean(sheet),
        ),
    }))
    .sort(
      (left, right) =>
        (left.sortOrder ?? Number.POSITIVE_INFINITY) -
          (right.sortOrder ?? Number.POSITIVE_INFINITY) ||
        compareText(left.workoutName, right.workoutName) ||
        compareText(left.workoutId, right.workoutId),
    )
    .map(({ sortOrder: _sortOrder, ...section }) => section)
}

function buildShiftSheets(
  shifts: CrewPilotExportShiftInput[],
): CrewPilotShiftSheet[] {
  return shifts.map((shift) => {
    const assigned = shift.assignments.length
    const rows: CrewPilotShiftSheetRow[] = shift.assignments
      .map((assignment) => ({
        rowKey: assignment.id,
        assignmentId: assignment.id,
        volunteerName: assignment.volunteerName,
        confirmationStatus: formatConfirmationStatus(assignment.confirmation),
        isOpen: false,
      }))
      .sort((left, right) =>
        compareText(left.volunteerName, right.volunteerName),
      )
    for (let index = assigned; index < shift.capacity; index++) {
      rows.push({
        rowKey: `open:${shift.id}:${index}`,
        assignmentId: null,
        volunteerName: "OPEN",
        confirmationStatus: "open",
        isOpen: true,
      })
    }

    return {
      shiftId: shift.id,
      name: shift.name,
      roleType: shift.roleType,
      roleLabel: formatRole(shift.roleType),
      startsAt: toIsoString(shift.startTime),
      endsAt: toIsoString(shift.endTime),
      location: shift.location || "Unassigned",
      needed: shift.capacity,
      assigned,
      open: Math.max(shift.capacity - assigned, 0),
      rows,
    }
  })
}

function buildMasterScheduleDaySections(
  rows: CrewPilotMasterScheduleRow[],
  timezone: string | null | undefined,
) {
  const rowsByDay = groupBy(rows, (row) =>
    getDayKey(row.startsAt ?? row.endsAt, timezone),
  )
  return [...rowsByDay.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([dayKey, dayRows]) => ({
      dayKey,
      rows: dayRows.sort(compareMasterScheduleRow),
    }))
}

function normalizeHeat(
  heat: CrewPilotExportHeatInput,
  context: {
    venueById: Map<string, CrewPilotExportVenueInput>
    workoutById: Map<string, CrewPilotExportWorkoutInput>
    heatLaneAssignments: CrewPilotExportHeatLaneInput[]
  },
): NormalizedHeat {
  const venue = heat.venueId ? context.venueById.get(heat.venueId) : undefined
  const workout = context.workoutById.get(heat.trackWorkoutId)
  const startsAt = toDateOrNull(heat.scheduledTime)
  const durationMinutes = positiveIntegerOrNull(heat.durationMinutes)
  const endsAt =
    startsAt && durationMinutes
      ? new Date(startsAt.getTime() + durationMinutes * 60_000)
      : null
  const explicitLaneNumbers = context.heatLaneAssignments
    .filter((assignment) => assignment.heatId === heat.id)
    .map((assignment) => positiveIntegerOrNull(assignment.laneNumber))
    .filter((laneNumber): laneNumber is number => Boolean(laneNumber))
  const laneNumbers = explicitLaneNumbers.length
    ? [...new Set(explicitLaneNumbers)].sort(compareNumber)
    : Array.from(
        {
          length:
            positiveIntegerOrNull(heat.laneCount) ??
            positiveIntegerOrNull(venue?.laneCount) ??
            0,
        },
        (_, index) => index + 1,
      )

  return {
    input: heat,
    workoutId: heat.trackWorkoutId,
    workoutName: workout?.name ?? "Workout",
    workoutSortOrder: workout?.sortOrder ?? null,
    venueName: venue?.name ?? "Unassigned",
    startsAt,
    endsAt,
    laneNumbers,
  }
}

function formatConfirmationSummary(
  assignments: CrewPilotExportAssignmentInput[],
) {
  if (assignments.length === 0) return "none"
  const counts = new Map<string, number>()
  for (const assignment of assignments) {
    const label = formatConfirmationStatus(assignment.confirmation)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([label, count]) => `${label}:${count}`)
    .join("; ")
}

function formatConfirmationStatus(
  confirmation: CrewPilotExportConfirmationInput | null | undefined,
) {
  return confirmation?.status ?? "missing"
}

function formatPeople(assignments: CrewPilotExportAssignmentInput[]) {
  return assignments
    .map((assignment) => assignment.volunteerName)
    .filter(Boolean)
    .sort(compareText)
    .join("; ")
}

function formatRole(roleType: VolunteerRoleType) {
  return VOLUNTEER_ROLE_LABELS[roleType] ?? roleType.replaceAll("_", " ")
}

function getJudgeRoleType(roleType: VolunteerRoleType | null | undefined) {
  return roleType === VOLUNTEER_ROLE_TYPES.HEAD_JUDGE
    ? VOLUNTEER_ROLE_TYPES.HEAD_JUDGE
    : VOLUNTEER_ROLE_TYPES.JUDGE
}

function buildCsv(headers: string[], rows: Array<Array<unknown>>) {
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\n")
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  const text = neutralizeCsvFormula(String(value))
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replaceAll('"', '""')}"`
}

function neutralizeCsvFormula(text: string) {
  return /^\s*[=+\-@]/.test(text) ? `'${text}` : text
}

function groupBy<T, K>(items: T[], getKey: (item: T) => K) {
  const grouped = new Map<K, T[]>()
  for (const item of items) {
    const key = getKey(item)
    const group = grouped.get(key)
    if (group) {
      group.push(item)
    } else {
      grouped.set(key, [item])
    }
  }
  return grouped
}

function compareMasterScheduleRow(
  left: CrewPilotMasterScheduleRow,
  right: CrewPilotMasterScheduleRow,
) {
  return (
    compareDateString(left.startsAt, right.startsAt) ||
    compareText(left.blockType, right.blockType) ||
    compareText(left.label, right.label) ||
    compareText(left.blockId, right.blockId)
  )
}

function compareJudgeAssignment(
  left: CrewPilotExportJudgeAssignmentInput,
  right: CrewPilotExportJudgeAssignmentInput,
) {
  return (
    compareText(left.heatId, right.heatId) ||
    (left.laneNumber ?? Number.POSITIVE_INFINITY) -
      (right.laneNumber ?? Number.POSITIVE_INFINITY) ||
    compareText(left.id, right.id)
  )
}

function compareShift(
  left: CrewPilotExportShiftInput,
  right: CrewPilotExportShiftInput,
) {
  return (
    compareDateString(
      toIsoString(left.startTime),
      toIsoString(right.startTime),
    ) ||
    compareText(left.name, right.name) ||
    compareText(left.id, right.id)
  )
}

function compareHeat(
  left: CrewPilotExportHeatInput,
  right: CrewPilotExportHeatInput,
) {
  return (
    compareDateString(
      toIsoString(left.scheduledTime),
      toIsoString(right.scheduledTime),
    ) ||
    left.heatNumber - right.heatNumber ||
    compareText(left.id, right.id)
  )
}

function compareVenue(
  left: CrewPilotExportVenueInput,
  right: CrewPilotExportVenueInput,
) {
  return (
    (left.sortOrder ?? Number.POSITIVE_INFINITY) -
      (right.sortOrder ?? Number.POSITIVE_INFINITY) ||
    compareText(left.name, right.name) ||
    compareText(left.id, right.id)
  )
}

function compareWorkout(
  left: CrewPilotExportWorkoutInput,
  right: CrewPilotExportWorkoutInput,
) {
  return (
    (left.sortOrder ?? Number.POSITIVE_INFINITY) -
      (right.sortOrder ?? Number.POSITIVE_INFINITY) ||
    compareText(left.name, right.name) ||
    compareText(left.id, right.id)
  )
}

function compareHeatLaneAssignment(
  left: CrewPilotExportHeatLaneInput,
  right: CrewPilotExportHeatLaneInput,
) {
  return (
    compareText(left.heatId, right.heatId) || left.laneNumber - right.laneNumber
  )
}

function compareDateString(left: string | null, right: string | null) {
  const leftTime = left ? Date.parse(left) : Number.POSITIVE_INFINITY
  const rightTime = right ? Date.parse(right) : Number.POSITIVE_INFINITY
  return leftTime - rightTime
}

function compareText(left: string, right: string) {
  return left.localeCompare(right)
}

function compareNumber(left: number, right: number) {
  return left - right
}

function toDateOrNull(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toIsoString(value: Date | string | null | undefined) {
  return toDateOrNull(value)?.toISOString() ?? null
}

function getDayKey(value: string | null, timezone: string | null | undefined) {
  const date = toDateOrNull(value)
  if (!date) return "Unscheduled"

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date)
    const year = parts.find((part) => part.type === "year")?.value
    const month = parts.find((part) => part.type === "month")?.value
    const day = parts.find((part) => part.type === "day")?.value
    if (year && month && day) return `${year}-${month}-${day}`
  } catch {
    return date.toISOString().slice(0, 10)
  }

  return date.toISOString().slice(0, 10)
}

function positiveIntegerOrNull(value: number | null | undefined) {
  if (!Number.isFinite(value)) return null
  const rounded = Math.floor(Number(value))
  return rounded > 0 ? rounded : null
}
