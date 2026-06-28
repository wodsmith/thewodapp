// @lat: [[crew#Day Of Operations Board]]
import { and, desc, eq } from "drizzle-orm"
import { getDb } from "../db"
import { createCrewAssignmentConfirmationId } from "../db/schemas/common"
import {
  competitionHeatsTable,
  competitionVenuesTable,
} from "../db/schemas/competitions"
import {
  CREW_ASSIGNMENT_CONFIRMATION_STATUS,
  CREW_ASSIGNMENT_CONFIRMATION_TYPE,
  type CrewAssignmentConfirmationType,
  crewAssignmentConfirmationsTable,
} from "../db/schemas/crew-imports"
import {
  CREW_VOLUNTEER_HISTORY_ASSIGNMENT_TYPE,
  CREW_VOLUNTEER_HISTORY_EVENT_TYPE,
  CREW_VOLUNTEER_IDENTITY_SOURCE,
} from "../db/schemas/crew-volunteer-intelligence"
import {
  programmingTracksTable,
  trackWorkoutsTable,
} from "../db/schemas/programming"
import { teamMembershipTable } from "../db/schemas/teams"
import { userTable } from "../db/schemas/users"
import {
  judgeHeatAssignmentsTable,
  VOLUNTEER_ROLE_TYPES,
  type VolunteerRoleType,
  volunteerShiftAssignmentsTable,
  volunteerShiftsTable,
} from "../db/schemas/volunteers"
import {
  generateCrewAssignmentConfirmationToken,
  hashCrewAssignmentConfirmationToken,
  resolveCrewAssignmentConfirmationOrganizerStateUpdate,
} from "../lib/crew/assignment-confirmations"
import {
  buildCrewDayOfOperationsBoard,
  type CrewDayOfOperationsBoard,
} from "../lib/crew/day-of-operations"
import {
  assertCrewDepartmentLeadCanManageRosterTarget,
  assertCrewDepartmentLeadCanManageShift,
} from "../lib/crew/department-leads"
import { parseCrewRosterMetadata } from "../lib/crew/roster-shifts"
import {
  type CrewStaffingReportEvent,
  type CrewStaffingReportForDayOfData,
  getCrewStaffingReportForDayOf,
} from "../server-fns/crew-staffing-fns.server"
import {
  requireCrewDepartmentLeadEvent,
  resolveCrewDepartmentLeadAccess,
} from "./crew-department-lead.server"
import { recordCrewVolunteerHistoryEvent } from "./crew-volunteer-history.server"

export interface CrewDayOfOperationsPageData {
  event: CrewStaffingReportEvent
  board: CrewDayOfOperationsBoard
  sources: CrewStaffingReportForDayOfData["sources"]
}

export async function getCrewDayOfOperationsPage(data: {
  eventId: string
}): Promise<CrewDayOfOperationsPageData> {
  const staffing = await getCrewStaffingReportForDayOf(data.eventId)
  const now = new Date()

  return {
    event: staffing.event,
    board: buildCrewDayOfOperationsBoard({
      matrix: staffing.matrix,
      report: staffing.report,
      staffingInput: staffing.matrixInput,
      now,
    }),
    sources: staffing.sources,
  }
}

type DbClient = ReturnType<typeof getDb>

export interface CrewDayOfAssignmentMutationInput {
  eventId: string
  assignmentType: Extract<
    CrewAssignmentConfirmationType,
    "volunteer_shift" | "judge_heat"
  >
  assignmentId: string
}

export interface ReplaceCrewAssignmentInput
  extends CrewDayOfAssignmentMutationInput {
  replacementMembershipId: string
}

export async function markCrewAssignmentCheckedIn(
  data: CrewDayOfAssignmentMutationInput,
) {
  return updateCrewDayOfAssignmentState(data, "checked_in")
}

export async function markCrewAssignmentNoShow(
  data: CrewDayOfAssignmentMutationInput,
) {
  return updateCrewDayOfAssignmentState(data, "no_show")
}

export async function replaceCrewAssignment(data: ReplaceCrewAssignmentInput) {
  const event = await requireCrewDepartmentLeadEvent(data.eventId)
  const access = await resolveCrewDepartmentLeadAccess(event)
  const db = getDb()
  const now = new Date()

  return await db.transaction(async (tx) => {
    const assignment = await loadDayOfAssignmentForUpdate(tx, data)
    assertCrewDepartmentLeadCanManageShift(access, assignment.shiftTarget)

    const replacement = await loadReplacementMembership(tx, {
      event,
      membershipId: data.replacementMembershipId,
    })
    if (replacement.membershipId === assignment.membershipId) {
      throw new Error("Choose a different replacement volunteer.")
    }
    assertCrewDepartmentLeadCanManageRosterTarget(access, {
      membershipId: replacement.membershipId,
      roleTypes: replacement.roleTypes,
    })

    if (!replacement.roleTypes.includes(assignment.roleType)) {
      throw new Error("Replacement volunteer does not match this assignment.")
    }

    await markOriginalDayOfConfirmationReplaced(tx, {
      event,
      assignment,
      now,
    })

    if (data.assignmentType === CREW_ASSIGNMENT_CONFIRMATION_TYPE.JUDGE_HEAT) {
      await tx
        .update(judgeHeatAssignmentsTable)
        .set({
          membershipId: replacement.membershipId,
          isManualOverride: true,
          updatedAt: now,
        })
        .where(eq(judgeHeatAssignmentsTable.id, data.assignmentId))
    } else {
      await tx
        .update(volunteerShiftAssignmentsTable)
        .set({
          membershipId: replacement.membershipId,
          updatedAt: now,
        })
        .where(eq(volunteerShiftAssignmentsTable.id, data.assignmentId))
    }

    await createReplacementDayOfConfirmation(tx, {
      event,
      assignment,
      membership: replacement,
      now: new Date(now.getTime() + 1),
    })

    await recordCrewVolunteerHistoryEvent({
      db: tx as unknown as DbClient,
      teamId: event.organizingTeamId,
      competitionId: event.id,
      groupId: event.groupId,
      eventType: CREW_VOLUNTEER_HISTORY_EVENT_TYPE.REPLACED,
      identity: {
        userId: assignment.membershipUserId,
        email: assignment.email,
        phone: assignment.phone,
        sourceMembershipId: assignment.membershipId,
        identitySource: CREW_VOLUNTEER_IDENTITY_SOURCE.MEMBERSHIP,
      },
      assignmentType: toHistoryAssignmentType(data.assignmentType),
      assignmentId: data.assignmentId,
      roleType: assignment.roleType,
      occurredAt: now,
      sourceType: "crew_day_of",
      sourceId: data.assignmentId,
      sourceUserId: null,
    })

    return { success: true }
  })
}

async function updateCrewDayOfAssignmentState(
  data: CrewDayOfAssignmentMutationInput,
  state: "checked_in" | "no_show",
) {
  const event = await requireCrewDepartmentLeadEvent(data.eventId)
  const access = await resolveCrewDepartmentLeadAccess(event)
  const db = getDb()
  const now = new Date()

  return await db.transaction(async (tx) => {
    const assignment = await loadDayOfAssignmentForUpdate(tx, data)
    assertCrewDepartmentLeadCanManageShift(access, assignment.shiftTarget)

    const result = await upsertDayOfConfirmation(tx, {
      event,
      assignment,
      membership: assignment,
      state,
      note: null,
      now,
    })

    const eventType =
      state === "checked_in"
        ? CREW_VOLUNTEER_HISTORY_EVENT_TYPE.CONFIRMED
        : CREW_VOLUNTEER_HISTORY_EVENT_TYPE.NO_SHOW
    await recordCrewVolunteerHistoryEvent({
      db: tx as unknown as DbClient,
      teamId: event.organizingTeamId,
      competitionId: event.id,
      groupId: event.groupId,
      eventType,
      identity: {
        userId: assignment.membershipUserId,
        email: assignment.email,
        phone: assignment.phone,
        sourceMembershipId: assignment.membershipId,
        identitySource: CREW_VOLUNTEER_IDENTITY_SOURCE.MEMBERSHIP,
      },
      assignmentType: toHistoryAssignmentType(data.assignmentType),
      assignmentId: data.assignmentId,
      roleType: assignment.roleType,
      occurredAt: result.respondedAt ?? now,
      sourceType: "crew_assignment_confirmation",
      sourceId: result.confirmationId,
      sourceUserId: null,
    })

    return { success: true }
  })
}

async function markOriginalDayOfConfirmationReplaced(
  tx: DbClient,
  params: {
    event: Awaited<ReturnType<typeof requireCrewDepartmentLeadEvent>>
    assignment: DayOfAssignmentRecord
    now: Date
  },
) {
  const [latestConfirmation] = await tx
    .select({
      id: crewAssignmentConfirmationsTable.id,
    })
    .from(crewAssignmentConfirmationsTable)
    .where(
      and(
        eq(
          crewAssignmentConfirmationsTable.assignmentType,
          params.assignment.assignmentType,
        ),
        eq(
          crewAssignmentConfirmationsTable.assignmentId,
          params.assignment.assignmentId,
        ),
        eq(
          crewAssignmentConfirmationsTable.membershipId,
          params.assignment.membershipId,
        ),
      ),
    )
    .orderBy(desc(crewAssignmentConfirmationsTable.updatedAt))
    .limit(1)

  if (latestConfirmation) {
    await tx
      .update(crewAssignmentConfirmationsTable)
      .set({
        status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED,
        respondedAt: null,
        responseNote: "Replaced on event day.",
        updatedAt: params.now,
      })
      .where(eq(crewAssignmentConfirmationsTable.id, latestConfirmation.id))
    return
  }

  const token = generateCrewAssignmentConfirmationToken()
  const tokenHash = await hashCrewAssignmentConfirmationToken(token)

  await tx.insert(crewAssignmentConfirmationsTable).values({
    id: createCrewAssignmentConfirmationId(),
    competitionId: params.event.id,
    assignmentType: params.assignment.assignmentType,
    assignmentId: params.assignment.assignmentId,
    membershipId: params.assignment.membershipId,
    email: params.assignment.email,
    tokenHash,
    status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED,
    respondedAt: null,
    expiresAt: getAssignmentConfirmationExpiry(params.now),
    responseNote: "Replaced on event day.",
    createdAt: params.now,
    updatedAt: params.now,
  })
}

async function createReplacementDayOfConfirmation(
  tx: DbClient,
  params: {
    event: Awaited<ReturnType<typeof requireCrewDepartmentLeadEvent>>
    assignment: DayOfAssignmentRecord
    membership: DayOfMembershipRecord
    now: Date
  },
) {
  const token = generateCrewAssignmentConfirmationToken()
  const tokenHash = await hashCrewAssignmentConfirmationToken(token)

  await tx.insert(crewAssignmentConfirmationsTable).values({
    id: createCrewAssignmentConfirmationId(),
    competitionId: params.event.id,
    assignmentType: params.assignment.assignmentType,
    assignmentId: params.assignment.assignmentId,
    membershipId: params.membership.membershipId,
    email: params.membership.email,
    tokenHash,
    status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CHECKED_IN,
    respondedAt: params.now,
    expiresAt: getAssignmentConfirmationExpiry(params.now),
    responseNote: null,
    createdAt: params.now,
    updatedAt: params.now,
  })
}

async function upsertDayOfConfirmation(
  tx: DbClient,
  params: {
    event: Awaited<ReturnType<typeof requireCrewDepartmentLeadEvent>>
    assignment: DayOfAssignmentRecord
    membership: DayOfMembershipRecord
    state: "checked_in" | "no_show"
    note: string | null
    now: Date
  },
) {
  const [latestConfirmation] = await tx
    .select({
      id: crewAssignmentConfirmationsTable.id,
      status: crewAssignmentConfirmationsTable.status,
      sentAt: crewAssignmentConfirmationsTable.sentAt,
    })
    .from(crewAssignmentConfirmationsTable)
    .where(
      and(
        eq(
          crewAssignmentConfirmationsTable.assignmentType,
          params.assignment.assignmentType,
        ),
        eq(
          crewAssignmentConfirmationsTable.assignmentId,
          params.assignment.assignmentId,
        ),
      ),
    )
    .orderBy(desc(crewAssignmentConfirmationsTable.updatedAt))
    .limit(1)

  let confirmation = latestConfirmation ?? null
  if (!confirmation) {
    const token = generateCrewAssignmentConfirmationToken()
    const tokenHash = await hashCrewAssignmentConfirmationToken(token)
    const confirmationId = createCrewAssignmentConfirmationId()

    await tx.insert(crewAssignmentConfirmationsTable).values({
      id: confirmationId,
      competitionId: params.event.id,
      assignmentType: params.assignment.assignmentType,
      assignmentId: params.assignment.assignmentId,
      membershipId: params.membership.membershipId,
      email: params.membership.email,
      tokenHash,
      status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
      expiresAt: getAssignmentConfirmationExpiry(params.now),
      createdAt: params.now,
      updatedAt: params.now,
    })

    confirmation = {
      id: confirmationId,
      status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
      sentAt: null,
    }
  }

  const update = resolveCrewAssignmentConfirmationOrganizerStateUpdate(
    params.state,
    params.note,
    params.now,
    confirmation,
  )

  await tx
    .update(crewAssignmentConfirmationsTable)
    .set({
      membershipId: params.membership.membershipId,
      email: params.membership.email,
      status: update.status,
      sentAt: update.sentAt,
      respondedAt: update.respondedAt,
      responseNote: update.responseNote,
      updatedAt: params.now,
    })
    .where(eq(crewAssignmentConfirmationsTable.id, confirmation.id))

  return {
    confirmationId: confirmation.id,
    respondedAt: update.respondedAt,
  }
}

interface DayOfMembershipRecord {
  membershipId: string
  membershipUserId: string | null
  email: string | null
  phone: string | null
  roleTypes: VolunteerRoleType[]
}

interface DayOfAssignmentRecord extends DayOfMembershipRecord {
  assignmentType: CrewDayOfAssignmentMutationInput["assignmentType"]
  assignmentId: string
  roleType: VolunteerRoleType
  shiftTarget: Parameters<typeof assertCrewDepartmentLeadCanManageShift>[1]
}

async function loadDayOfAssignmentForUpdate(
  tx: DbClient,
  data: CrewDayOfAssignmentMutationInput,
): Promise<DayOfAssignmentRecord> {
  if (data.assignmentType === CREW_ASSIGNMENT_CONFIRMATION_TYPE.JUDGE_HEAT) {
    const [row] = await tx
      .select({
        assignmentId: judgeHeatAssignmentsTable.id,
        membershipId: judgeHeatAssignmentsTable.membershipId,
        roleType: judgeHeatAssignmentsTable.position,
        membershipUserId: teamMembershipTable.userId,
        membershipMetadata: teamMembershipTable.metadata,
        userEmail: userTable.email,
        heatStartTime: competitionHeatsTable.scheduledTime,
        heatDurationMinutes: competitionHeatsTable.durationMinutes,
        venueName: competitionVenuesTable.name,
        venueId: competitionVenuesTable.id,
      })
      .from(judgeHeatAssignmentsTable)
      .innerJoin(
        competitionHeatsTable,
        eq(judgeHeatAssignmentsTable.heatId, competitionHeatsTable.id),
      )
      .innerJoin(
        trackWorkoutsTable,
        eq(competitionHeatsTable.trackWorkoutId, trackWorkoutsTable.id),
      )
      .innerJoin(
        programmingTracksTable,
        eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
      )
      .leftJoin(
        competitionVenuesTable,
        eq(competitionHeatsTable.venueId, competitionVenuesTable.id),
      )
      .leftJoin(
        teamMembershipTable,
        eq(judgeHeatAssignmentsTable.membershipId, teamMembershipTable.id),
      )
      .leftJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
      .where(
        and(
          eq(judgeHeatAssignmentsTable.id, data.assignmentId),
          eq(programmingTracksTable.competitionId, data.eventId),
        ),
      )
      .for("update")
      .limit(1)

    if (!row) throw new Error("Assignment not found")
    // Day-of check-in / replacement currently operates on account-backed
    // memberships. Invitation-based (imported / manual) judges can be assigned
    // to heats but are not yet supported in this membership-keyed flow.
    if (!row.membershipId) {
      throw new Error(
        "Day-of actions are not yet available for imported judges without an account.",
      )
    }
    const metadata = parseCrewRosterMetadata(row.membershipMetadata)
    const roleType = row.roleType ?? VOLUNTEER_ROLE_TYPES.JUDGE
    const startTime = row.heatStartTime
    const endTime =
      startTime && row.heatDurationMinutes
        ? new Date(startTime.getTime() + row.heatDurationMinutes * 60_000)
        : startTime
    return {
      assignmentType: data.assignmentType,
      assignmentId: row.assignmentId,
      membershipId: row.membershipId,
      membershipUserId: row.membershipUserId,
      email: metadata.signupEmail ?? row.userEmail,
      phone: metadata.signupPhone ?? null,
      roleTypes: metadata.volunteerRoleTypes ?? [roleType],
      roleType,
      shiftTarget: {
        roleType,
        startTime: startTime ?? "",
        endTime: endTime ?? startTime ?? "",
        location: row.venueName,
        venueId: row.venueId,
      },
    }
  }

  const [row] = await tx
    .select({
      assignmentId: volunteerShiftAssignmentsTable.id,
      membershipId: volunteerShiftAssignmentsTable.membershipId,
      membershipUserId: teamMembershipTable.userId,
      membershipMetadata: teamMembershipTable.metadata,
      userEmail: userTable.email,
      roleType: volunteerShiftsTable.roleType,
      startTime: volunteerShiftsTable.startTime,
      endTime: volunteerShiftsTable.endTime,
      location: volunteerShiftsTable.location,
    })
    .from(volunteerShiftAssignmentsTable)
    .innerJoin(
      volunteerShiftsTable,
      eq(volunteerShiftAssignmentsTable.shiftId, volunteerShiftsTable.id),
    )
    .leftJoin(
      teamMembershipTable,
      eq(volunteerShiftAssignmentsTable.membershipId, teamMembershipTable.id),
    )
    .leftJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
    .where(
      and(
        eq(volunteerShiftAssignmentsTable.id, data.assignmentId),
        eq(volunteerShiftsTable.competitionId, data.eventId),
      ),
    )
    .for("update")
    .limit(1)

  if (!row) throw new Error("Assignment not found")
  // Day-of check-in / replacement currently operates on account-backed
  // memberships. Invitation-based (imported / manual) volunteers can be staffed
  // onto shifts but are not yet supported in this membership-keyed flow.
  if (!row.membershipId) {
    throw new Error(
      "Day-of actions are not yet available for imported volunteers without an account.",
    )
  }
  const metadata = parseCrewRosterMetadata(row.membershipMetadata)
  return {
    assignmentType: data.assignmentType,
    assignmentId: row.assignmentId,
    membershipId: row.membershipId,
    membershipUserId: row.membershipUserId,
    email: metadata.signupEmail ?? row.userEmail,
    phone: metadata.signupPhone ?? null,
    roleTypes: metadata.volunteerRoleTypes ?? [row.roleType],
    roleType: row.roleType,
    shiftTarget: {
      roleType: row.roleType,
      startTime: row.startTime,
      endTime: row.endTime,
      location: row.location,
    },
  }
}

async function loadReplacementMembership(
  tx: DbClient,
  params: {
    event: Awaited<ReturnType<typeof requireCrewDepartmentLeadEvent>>
    membershipId: string
  },
): Promise<DayOfMembershipRecord> {
  const [row] = await tx
    .select({
      membershipId: teamMembershipTable.id,
      membershipUserId: teamMembershipTable.userId,
      membershipMetadata: teamMembershipTable.metadata,
      isActive: teamMembershipTable.isActive,
      userEmail: userTable.email,
    })
    .from(teamMembershipTable)
    .leftJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
    .where(
      and(
        eq(teamMembershipTable.id, params.membershipId),
        eq(teamMembershipTable.teamId, params.event.competitionTeamId),
      ),
    )
    .limit(1)

  if (!row || !row.isActive) {
    throw new Error("Replacement volunteer not found")
  }

  const metadata = parseCrewRosterMetadata(row.membershipMetadata)
  return {
    membershipId: row.membershipId,
    membershipUserId: row.membershipUserId,
    email: metadata.signupEmail ?? row.userEmail,
    phone: metadata.signupPhone ?? null,
    roleTypes: metadata.volunteerRoleTypes ?? [],
  }
}

function toHistoryAssignmentType(
  assignmentType: CrewDayOfAssignmentMutationInput["assignmentType"],
) {
  return assignmentType === CREW_ASSIGNMENT_CONFIRMATION_TYPE.JUDGE_HEAT
    ? CREW_VOLUNTEER_HISTORY_ASSIGNMENT_TYPE.JUDGE_HEAT
    : CREW_VOLUNTEER_HISTORY_ASSIGNMENT_TYPE.VOLUNTEER_SHIFT
}

function getAssignmentConfirmationExpiry(now: Date) {
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + 14)
  return expiresAt
}
