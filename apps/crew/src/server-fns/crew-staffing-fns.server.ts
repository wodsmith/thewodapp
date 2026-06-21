// @lat: [[crew#Staffing Page Gap Report]]
import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { getDb } from "../db"
import {
  competitionHeatAssignmentsTable,
  competitionHeatsTable,
  competitionsTable,
  competitionVenuesTable,
} from "../db/schemas/competitions"
import {
  CREW_ASSIGNMENT_CONFIRMATION_TYPE,
  crewAssignmentConfirmationsTable,
} from "../db/schemas/crew-imports"
import { crewEventSettingsTable } from "../db/schemas/crew-event-settings"
import {
  programmingTracksTable,
  trackWorkoutsTable,
} from "../db/schemas/programming"
import {
  judgeAssignmentVersionsTable,
  judgeHeatAssignmentsTable,
} from "../db/schemas/volunteers"
import { workouts as workoutsTable } from "../db/schemas/workouts"
import {
  buildCrewStaffingMatrix,
  buildCrewStaffingReport,
  type CrewStaffingConfirmationInput,
  type CrewStaffingMatrix,
  type CrewStaffingReport,
} from "../lib/crew/staffing"
import {
  filterCrewDepartmentLeadRoster,
  type CrewDepartmentLeadAccess,
} from "../lib/crew/department-leads"
import { filterCrewStaffingInputForDepartmentLead } from "../lib/crew/staffing/department-lead-scope"
import { resolveCrewDepartmentLeadAccess } from "../server/crew-department-lead.server"
import {
  loadCrewRoster,
  loadCrewShifts,
  type CrewShiftBoardItem,
} from "../server/crew-roster-shift.server"

type DbClient = ReturnType<typeof getDb>

export interface CrewStaffingReportEvent {
  id: string
  name: string
  slug: string
  organizingTeamId: string
  competitionTeamId: string
  timezone: string | null
  startDate: string | null
  endDate: string | null
}

export interface CrewStaffingReportPageData {
  event: CrewStaffingReportEvent
  matrix: CrewStaffingMatrix
  report: CrewStaffingReport
  sources: CrewStaffingReport["sourceCounts"] & {
    activeJudgeVersions: number
  }
}

export async function getCrewStaffingReportPage(
  eventId: string,
): Promise<CrewStaffingReportPageData> {
  const event = await requireCrewStaffingEvent(eventId)
  const access = await resolveCrewDepartmentLeadAccess(event)
  const { input, activeJudgeVersions } = await loadCrewStaffingMatrixInput(
    event,
    access,
  )
  const matrix = buildCrewStaffingMatrix(input)
  const report = buildCrewStaffingReport(input, matrix)

  return {
    event,
    matrix,
    report,
    sources: {
      ...report.sourceCounts,
      activeJudgeVersions,
    },
  }
}

export async function requireCrewStaffingEvent(
  eventId: string,
): Promise<CrewStaffingReportEvent> {
  const db = getDb()
  const [event] = await db
    .select({
      id: competitionsTable.id,
      name: competitionsTable.name,
      slug: competitionsTable.slug,
      organizingTeamId: competitionsTable.organizingTeamId,
      competitionTeamId: competitionsTable.competitionTeamId,
      timezone: competitionsTable.timezone,
      startDate: competitionsTable.startDate,
      endDate: competitionsTable.endDate,
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

export async function loadCrewStaffingMatrixInput(
  event: CrewStaffingReportEvent,
  access: CrewDepartmentLeadAccess,
) {
  const [roster, shifts, venues, workouts, heats] = await Promise.all([
    loadCrewRoster(event.competitionTeamId),
    loadCrewShifts(event.id),
    loadStaffingVenues(event.id),
    loadStaffingWorkouts(event.id),
    loadStaffingHeats(event.id),
  ])
  const heatIds = heats.map((heat) => heat.id)
  const trackWorkoutIds = [...new Set(heats.map((heat) => heat.trackWorkoutId))]
  const [heatLaneAssignments, judgeData] = await Promise.all([
    loadHeatLaneAssignments(heatIds),
    loadActiveJudgeAssignments(heatIds, trackWorkoutIds),
  ])
  const baseInput = {
    event: {
      id: event.id,
      name: event.name,
      timezone: event.timezone,
      startDate: event.startDate,
      endDate: event.endDate,
    },
    venues,
    workouts,
    heats,
    heatLaneAssignments,
    shifts: toStaffingShifts(shifts),
    judgeAssignments: judgeData.judgeAssignments,
  }
  const scopedStaffingInput = filterCrewStaffingInputForDepartmentLead(
    baseInput,
    access,
  )
  const scopedShiftIds = new Set(
    scopedStaffingInput.shifts?.map((shift) => shift.id),
  )
  const scopedRoster = filterCrewDepartmentLeadRoster(
    roster,
    access,
    shifts.filter((shift) => scopedShiftIds.has(shift.id)),
  )

  const input = {
    ...scopedStaffingInput,
    roster: scopedRoster.flatMap((volunteer) => {
      if (!volunteer.membershipId) return []
      return {
        membershipId: volunteer.membershipId,
        name: volunteer.name,
        email: volunteer.email,
        roleTypes: volunteer.roleTypes,
        availability: volunteer.availability,
        credentials: volunteer.credentials,
        isActive: volunteer.status === "active",
      }
    }),
  }

  return {
    input,
    activeJudgeVersions: judgeData.activeVersionCount,
  }
}

async function loadStaffingVenues(competitionId: string) {
  const db = getDb()
  return db
    .select({
      id: competitionVenuesTable.id,
      name: competitionVenuesTable.name,
      laneCount: competitionVenuesTable.laneCount,
      sortOrder: competitionVenuesTable.sortOrder,
    })
    .from(competitionVenuesTable)
    .where(eq(competitionVenuesTable.competitionId, competitionId))
    .orderBy(
      asc(competitionVenuesTable.sortOrder),
      asc(competitionVenuesTable.name),
    )
}

async function loadStaffingWorkouts(competitionId: string) {
  const db = getDb()
  const rows = await db
    .select({
      id: trackWorkoutsTable.id,
      name: workoutsTable.name,
      sortOrder: trackWorkoutsTable.trackOrder,
    })
    .from(trackWorkoutsTable)
    .innerJoin(
      programmingTracksTable,
      eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
    )
    .leftJoin(workoutsTable, eq(trackWorkoutsTable.workoutId, workoutsTable.id))
    .where(eq(programmingTracksTable.competitionId, competitionId))
    .orderBy(asc(trackWorkoutsTable.trackOrder), asc(trackWorkoutsTable.id))

  return rows.map((row) => ({
    id: row.id,
    name: row.name ?? "Workout",
    sortOrder: Number(row.sortOrder ?? 0),
  }))
}

async function loadStaffingHeats(competitionId: string) {
  const db = getDb()
  return db
    .select({
      id: competitionHeatsTable.id,
      trackWorkoutId: competitionHeatsTable.trackWorkoutId,
      heatNumber: competitionHeatsTable.heatNumber,
      venueId: competitionHeatsTable.venueId,
      scheduledTime: competitionHeatsTable.scheduledTime,
      durationMinutes: competitionHeatsTable.durationMinutes,
    })
    .from(competitionHeatsTable)
    .where(eq(competitionHeatsTable.competitionId, competitionId))
    .orderBy(
      asc(competitionHeatsTable.scheduledTime),
      asc(competitionHeatsTable.heatNumber),
      asc(competitionHeatsTable.id),
    )
}

async function loadHeatLaneAssignments(heatIds: string[]) {
  if (heatIds.length === 0) return []

  const db = getDb()
  return db
    .select({
      heatId: competitionHeatAssignmentsTable.heatId,
      laneNumber: competitionHeatAssignmentsTable.laneNumber,
    })
    .from(competitionHeatAssignmentsTable)
    .where(inArray(competitionHeatAssignmentsTable.heatId, heatIds))
    .orderBy(
      asc(competitionHeatAssignmentsTable.heatId),
      asc(competitionHeatAssignmentsTable.laneNumber),
    )
}

async function loadActiveJudgeAssignments(
  heatIds: string[],
  trackWorkoutIds: string[],
) {
  if (heatIds.length === 0 || trackWorkoutIds.length === 0) {
    return {
      activeVersionCount: 0,
      judgeAssignments: [],
    }
  }

  const db = getDb()
  const activeVersions = await db
    .select({
      id: judgeAssignmentVersionsTable.id,
    })
    .from(judgeAssignmentVersionsTable)
    .where(
      and(
        inArray(judgeAssignmentVersionsTable.trackWorkoutId, trackWorkoutIds),
        eq(judgeAssignmentVersionsTable.isActive, true),
      ),
    )
  const versionIds = activeVersions.map((version) => version.id)

  if (versionIds.length === 0) {
    return {
      activeVersionCount: 0,
      judgeAssignments: [],
    }
  }

  const assignments = await db
    .select({
      id: judgeHeatAssignmentsTable.id,
      heatId: judgeHeatAssignmentsTable.heatId,
      membershipId: judgeHeatAssignmentsTable.membershipId,
      laneNumber: judgeHeatAssignmentsTable.laneNumber,
      position: judgeHeatAssignmentsTable.position,
      versionId: judgeHeatAssignmentsTable.versionId,
      rotationId: judgeHeatAssignmentsTable.rotationId,
    })
    .from(judgeHeatAssignmentsTable)
    .where(
      and(
        inArray(judgeHeatAssignmentsTable.heatId, heatIds),
        inArray(judgeHeatAssignmentsTable.versionId, versionIds),
      ),
    )
    .orderBy(
      asc(judgeHeatAssignmentsTable.heatId),
      asc(judgeHeatAssignmentsTable.laneNumber),
      asc(judgeHeatAssignmentsTable.id),
    )
  const confirmationMap = await loadJudgeAssignmentConfirmationMap(
    db,
    assignments.map((assignment) => assignment.id),
  )

  return {
    activeVersionCount: activeVersions.length,
    judgeAssignments: assignments.map((assignment) => ({
      ...assignment,
      confirmation: confirmationMap.get(assignment.id) ?? null,
    })),
  }
}

async function loadJudgeAssignmentConfirmationMap(
  db: DbClient,
  assignmentIds: string[],
) {
  if (assignmentIds.length === 0) {
    return new Map<string, CrewStaffingConfirmationInput>()
  }

  const rows = await db
    .select({
      assignmentId: crewAssignmentConfirmationsTable.assignmentId,
      type: crewAssignmentConfirmationsTable.assignmentType,
      status: crewAssignmentConfirmationsTable.status,
      sentAt: crewAssignmentConfirmationsTable.sentAt,
      respondedAt: crewAssignmentConfirmationsTable.respondedAt,
      responseNote: crewAssignmentConfirmationsTable.responseNote,
      updatedAt: crewAssignmentConfirmationsTable.updatedAt,
    })
    .from(crewAssignmentConfirmationsTable)
    .where(
      and(
        eq(
          crewAssignmentConfirmationsTable.assignmentType,
          CREW_ASSIGNMENT_CONFIRMATION_TYPE.JUDGE_HEAT,
        ),
        inArray(crewAssignmentConfirmationsTable.assignmentId, assignmentIds),
      ),
    )
    .orderBy(desc(crewAssignmentConfirmationsTable.updatedAt))

  const byAssignment = new Map<string, CrewStaffingConfirmationInput>()
  for (const row of rows) {
    if (byAssignment.has(row.assignmentId)) continue
    byAssignment.set(row.assignmentId, {
      type: row.type,
      status: row.status,
      sentAt: row.sentAt,
      respondedAt: row.respondedAt,
      responseNote: row.responseNote,
    })
  }
  return byAssignment
}

function toStaffingShifts(shifts: CrewShiftBoardItem[]) {
  return shifts.map((shift) => ({
    id: shift.id,
    name: shift.name,
    roleType: shift.roleType,
    startTime: shift.startTime,
    endTime: shift.endTime,
    capacity: shift.capacity,
    location: shift.location,
    assignments: shift.assignments.map((assignment) => ({
      id: assignment.id,
      membershipId: assignment.membershipId,
      confirmation: assignment.confirmation
        ? {
            type: CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
            status: assignment.confirmation.status,
            sentAt: assignment.confirmation.sentAt,
            respondedAt: assignment.confirmation.respondedAt,
            responseNote: assignment.confirmation.responseNote,
          }
        : null,
    })),
  }))
}
