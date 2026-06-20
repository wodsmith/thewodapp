// @lat: [[crew#Pilot Exports]]
import {
  CREW_ASSIGNMENT_CONFIRMATION_STATUS,
  type CrewAssignmentConfirmationStatus,
  type CrewAssignmentConfirmationType,
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
export type CrewPilotExportResponseReason =
  | "missing_confirmation"
  | "no_response"
  | "declined"
  | "change_requested"

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

export interface CrewPilotRoleSheetAssignmentRow {
  rowKey: string
  assignmentType: CrewPilotExportBlockType
  assignmentId: string | null
  blockId: string
  volunteerName: string
  email: string
  startsAt: string | null
  endsAt: string | null
  location: string
  blockLabel: string
  confirmationStatus: string
  responseNote: string
}

export interface CrewPilotRoleSheet {
  roleType: VolunteerRoleType
  roleLabel: string
  rows: CrewPilotRoleSheetAssignmentRow[]
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
  startsAt: string | null
  venueName: string
  rows: CrewPilotJudgeLaneRow[]
}

export interface CrewPilotResponseRow {
  assignmentType: CrewPilotExportBlockType
  assignmentId: string
  membershipId: string
  volunteerName: string
  email: string
  startsAt: string | null
  endsAt: string | null
  location: string
  blockLabel: string
  role: string
  status: string
  reason: CrewPilotExportResponseReason
  responseNote: string
}

export interface CrewPilotFloorLeadSheet {
  floorName: string
  rows: CrewPilotMasterScheduleRow[]
  judgeRows: CrewPilotJudgeLaneRow[]
}

export interface CrewPilotExports {
  generatedAt: string
  summary: {
    masterScheduleRows: number
    roleSheets: number
    judgeHeatSheets: number
    responseRows: number
    floorLeadSheets: number
  }
  masterScheduleRows: CrewPilotMasterScheduleRow[]
  masterScheduleCsv: string
  roleSheets: CrewPilotRoleSheet[]
  judgeHeatLaneSheets: CrewPilotJudgeHeatLaneSheet[]
  responseRows: CrewPilotResponseRow[]
  responseCsv: string
  floorLeadSheets: CrewPilotFloorLeadSheet[]
}

interface NormalizedHeat {
  input: CrewPilotExportHeatInput
  workoutName: string
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
  const heatById = new Map(normalizedHeats.map((heat) => [heat.input.id, heat]))

  const masterScheduleRows = [
    ...shifts.map(buildShiftMasterScheduleRow),
    ...normalizedHeats.map((heat) =>
      buildHeatMasterScheduleRow(
        heat,
        judgeAssignmentsByHeatId.get(heat.input.id) ?? [],
      ),
    ),
  ].sort(compareMasterScheduleRow)
  const roleSheets = buildRoleSheets({ shifts, judgeAssignments, heatById })
  const judgeHeatLaneSheets = normalizedHeats.map((heat) =>
    buildJudgeHeatLaneSheet(
      heat,
      judgeAssignmentsByHeatId.get(heat.input.id) ?? [],
    ),
  )
  const responseRows = buildResponseRows({
    shifts,
    judgeAssignments,
    heatById,
  })
  const floorLeadSheets = buildFloorLeadSheets({
    masterScheduleRows,
    judgeHeatLaneSheets,
  })

  return {
    generatedAt,
    summary: {
      masterScheduleRows: masterScheduleRows.length,
      roleSheets: roleSheets.length,
      judgeHeatSheets: judgeHeatLaneSheets.length,
      responseRows: responseRows.length,
      floorLeadSheets: floorLeadSheets.length,
    },
    masterScheduleRows,
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
    roleSheets,
    judgeHeatLaneSheets,
    responseRows,
    responseCsv: buildCsv(
      [
        "Type",
        "Assignment ID",
        "Volunteer",
        "Email",
        "Start",
        "End",
        "Location",
        "Block",
        "Role",
        "Status",
        "Reason",
        "Note",
      ],
      responseRows.map((row) => [
        row.assignmentType,
        row.assignmentId,
        row.volunteerName,
        row.email,
        row.startsAt ?? "",
        row.endsAt ?? "",
        row.location,
        row.blockLabel,
        row.role,
        row.status,
        row.reason,
        row.responseNote,
      ]),
    ),
    floorLeadSheets,
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

function buildRoleSheets(input: {
  shifts: CrewPilotExportShiftInput[]
  judgeAssignments: CrewPilotExportJudgeAssignmentInput[]
  heatById: Map<string, NormalizedHeat>
}) {
  const rowsByRoleType = new Map<
    VolunteerRoleType,
    CrewPilotRoleSheetAssignmentRow[]
  >()

  for (const shift of input.shifts) {
    const roleRows = rowsByRoleType.get(shift.roleType) ?? []
    for (const assignment of shift.assignments) {
      roleRows.push({
        rowKey: assignment.id,
        assignmentType: "shift",
        assignmentId: assignment.id,
        blockId: shift.id,
        volunteerName: assignment.volunteerName,
        email: assignment.email ?? "",
        startsAt: toIsoString(shift.startTime),
        endsAt: toIsoString(shift.endTime),
        location: shift.location || "Unassigned",
        blockLabel: shift.name,
        confirmationStatus: formatConfirmationStatus(assignment.confirmation),
        responseNote: assignment.confirmation?.responseNote ?? "",
      })
    }
    for (
      let index = shift.assignments.length;
      index < shift.capacity;
      index++
    ) {
      roleRows.push({
        rowKey: `open:${shift.id}:${index}`,
        assignmentType: "shift",
        assignmentId: null,
        blockId: shift.id,
        volunteerName: "OPEN",
        email: "",
        startsAt: toIsoString(shift.startTime),
        endsAt: toIsoString(shift.endTime),
        location: shift.location || "Unassigned",
        blockLabel: shift.name,
        confirmationStatus: "open",
        responseNote: "",
      })
    }
    rowsByRoleType.set(shift.roleType, roleRows)
  }

  for (const assignment of input.judgeAssignments) {
    const roleType = getJudgeRoleType(assignment.position)
    const heat = input.heatById.get(assignment.heatId)
    const roleRows = rowsByRoleType.get(roleType) ?? []
    roleRows.push({
      rowKey: assignment.id,
      assignmentType: "heat",
      assignmentId: assignment.id,
      blockId: assignment.heatId,
      volunteerName: assignment.volunteerName,
      email: assignment.email ?? "",
      startsAt: toIsoString(heat?.startsAt),
      endsAt: toIsoString(heat?.endsAt),
      location: heat?.venueName ?? "Unassigned",
      blockLabel: heat
        ? `${heat.workoutName} - Heat ${heat.input.heatNumber}`
        : assignment.heatId,
      confirmationStatus: formatConfirmationStatus(assignment.confirmation),
      responseNote: assignment.confirmation?.responseNote ?? "",
    })
    rowsByRoleType.set(roleType, roleRows)
  }

  return [...rowsByRoleType.entries()]
    .map(([roleType, rows]) => ({
      roleType,
      roleLabel: formatRole(roleType),
      rows: rows.sort(compareRoleSheetRow),
    }))
    .sort((left, right) => compareText(left.roleLabel, right.roleLabel))
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
    startsAt: toIsoString(heat.startsAt),
    venueName: heat.venueName,
    rows,
  }
}

function buildResponseRows(input: {
  shifts: CrewPilotExportShiftInput[]
  judgeAssignments: CrewPilotExportJudgeAssignmentInput[]
  heatById: Map<string, NormalizedHeat>
}) {
  const shiftRows = input.shifts.flatMap((shift) =>
    shift.assignments.flatMap((assignment) => {
      const reason = getResponseReason(assignment.confirmation)
      if (!reason) return []
      return {
        assignmentType: "shift" as const,
        assignmentId: assignment.id,
        membershipId: assignment.membershipId,
        volunteerName: assignment.volunteerName,
        email: assignment.email ?? "",
        startsAt: toIsoString(shift.startTime),
        endsAt: toIsoString(shift.endTime),
        location: shift.location || "Unassigned",
        blockLabel: shift.name,
        role: formatRole(shift.roleType),
        status: formatConfirmationStatus(assignment.confirmation),
        reason,
        responseNote: assignment.confirmation?.responseNote ?? "",
      }
    }),
  )
  const judgeRows = input.judgeAssignments.flatMap((assignment) => {
    const reason = getResponseReason(assignment.confirmation)
    if (!reason) return []
    const heat = input.heatById.get(assignment.heatId)
    return {
      assignmentType: "heat" as const,
      assignmentId: assignment.id,
      membershipId: assignment.membershipId,
      volunteerName: assignment.volunteerName,
      email: assignment.email ?? "",
      startsAt: toIsoString(heat?.startsAt),
      endsAt: toIsoString(heat?.endsAt),
      location: heat?.venueName ?? "Unassigned",
      blockLabel: heat
        ? `${heat.workoutName} - Heat ${heat.input.heatNumber}`
        : assignment.heatId,
      role: formatRole(getJudgeRoleType(assignment.position)),
      status: formatConfirmationStatus(assignment.confirmation),
      reason,
      responseNote: assignment.confirmation?.responseNote ?? "",
    }
  })

  return [...shiftRows, ...judgeRows].sort(compareResponseRow)
}

function buildFloorLeadSheets(input: {
  masterScheduleRows: CrewPilotMasterScheduleRow[]
  judgeHeatLaneSheets: CrewPilotJudgeHeatLaneSheet[]
}) {
  const scheduleRowsByFloor = groupBy(
    input.masterScheduleRows,
    (row) => row.location || "Unassigned",
  )
  const judgeRowsByFloor = groupBy(
    input.judgeHeatLaneSheets.flatMap((sheet) => sheet.rows),
    (row) => row.venueName || "Unassigned",
  )
  const floorNames = [
    ...new Set([...scheduleRowsByFloor.keys(), ...judgeRowsByFloor.keys()]),
  ].sort(compareText)

  return floorNames.map((floorName) => ({
    floorName,
    rows: (scheduleRowsByFloor.get(floorName) ?? []).sort(
      compareMasterScheduleRow,
    ),
    judgeRows: (judgeRowsByFloor.get(floorName) ?? []).sort(
      compareJudgeLaneRow,
    ),
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
    workoutName: workout?.name ?? "Workout",
    venueName: venue?.name ?? "Unassigned",
    startsAt,
    endsAt,
    laneNumbers,
  }
}

function getResponseReason(
  confirmation: CrewPilotExportConfirmationInput | null | undefined,
): CrewPilotExportResponseReason | null {
  if (!confirmation) return "missing_confirmation"
  if (confirmation.status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING) {
    return confirmation.sentAt ? "no_response" : "missing_confirmation"
  }
  if (confirmation.status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.DECLINED) {
    return "declined"
  }
  if (
    confirmation.status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.CHANGE_REQUESTED
  ) {
    return "change_requested"
  }
  return null
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

function compareRoleSheetRow(
  left: CrewPilotRoleSheetAssignmentRow,
  right: CrewPilotRoleSheetAssignmentRow,
) {
  return (
    compareDateString(left.startsAt, right.startsAt) ||
    compareText(left.location, right.location) ||
    compareText(left.blockLabel, right.blockLabel) ||
    Number(isOpenRoleRow(left)) - Number(isOpenRoleRow(right)) ||
    compareText(left.volunteerName, right.volunteerName) ||
    compareText(left.assignmentId ?? "", right.assignmentId ?? "")
  )
}

function isOpenRoleRow(row: CrewPilotRoleSheetAssignmentRow) {
  return row.assignmentId === null
}

function compareResponseRow(
  left: CrewPilotResponseRow,
  right: CrewPilotResponseRow,
) {
  return (
    compareDateString(left.startsAt, right.startsAt) ||
    compareText(left.reason, right.reason) ||
    compareText(left.volunteerName, right.volunteerName) ||
    compareText(left.assignmentId, right.assignmentId)
  )
}

function compareJudgeLaneRow(
  left: CrewPilotJudgeLaneRow,
  right: CrewPilotJudgeLaneRow,
) {
  return (
    compareDateString(left.startsAt, right.startsAt) ||
    left.heatNumber - right.heatNumber ||
    left.laneNumber - right.laneNumber ||
    compareText(left.assignmentId ?? "", right.assignmentId ?? "")
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

function positiveIntegerOrNull(value: number | null | undefined) {
  if (!Number.isFinite(value)) return null
  const rounded = Math.floor(Number(value))
  return rounded > 0 ? rounded : null
}
