import { render } from "@react-email/render"
// @lat: [[crew#Assignment Confirmation Responses]]
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm"
import { getDb } from "../db"
import { competitionsTable, type Competition } from "../db/schemas/competitions"
import { createCrewAssignmentConfirmationId } from "../db/schemas/common"
import {
  CREW_ASSIGNMENT_CONFIRMATION_STATUS,
  CREW_ASSIGNMENT_CONFIRMATION_TYPE,
  crewAssignmentConfirmationsTable,
  type CrewAssignmentConfirmationStatus,
} from "../db/schemas/crew-imports"
import {
  CREW_EVENT_LIFECYCLE,
  crewEventSettingsTable,
} from "../db/schemas/crew-event-settings"
import { teamMembershipTable } from "../db/schemas/teams"
import { userTable } from "../db/schemas/users"
import {
  volunteerShiftAssignmentsTable,
  volunteerShiftsTable,
  type VolunteerRoleType,
} from "../db/schemas/volunteers"
import {
  buildCrewAssignmentConfirmationUrls,
  generateCrewAssignmentConfirmationToken,
  getCrewAssignmentConfirmationTokenState,
  hashCrewAssignmentConfirmationToken,
  resolveCrewAssignmentConfirmationResponse,
  statusForCrewAssignmentResponseAction,
  summarizeCrewAssignmentConfirmations,
  type CrewAssignmentConfirmationStatusSummary,
  type CrewAssignmentResponseAction,
  type CrewAssignmentTokenState,
} from "../lib/crew/assignment-confirmations"
import {
  formatVolunteerRole,
  getCrewRosterRoleTypes,
  parseCrewRosterMetadata,
} from "../lib/crew/roster-shifts"
import { getAppUrl } from "../lib/env"
import { CrewAssignmentConfirmationEmail } from "../react-email/crew-assignment-confirmation"
import {
  DEFAULT_TIMEZONE,
  formatDateTimeInTimezone,
} from "../utils/timezone-utils"
import { getFirstExecuteValue } from "../server-fns/db-execute"

type DbClient = ReturnType<typeof getDb>

type CrewConfirmationCompetition = Pick<
  Competition,
  "id" | "slug" | "name" | "timezone" | "startDate" | "endDate"
>

export interface CrewAssignmentConfirmationDisplay {
  id: string
  status: CrewAssignmentConfirmationStatus
  sentAt: Date | null
  respondedAt: Date | null
  expiresAt: Date | null
  responseNote: string | null
}

export interface CrewAssignmentConfirmationTokenData {
  status: CrewAssignmentTokenState
  event: CrewConfirmationCompetition | null
  volunteer: {
    name: string
    email: string
    roleTypes: VolunteerRoleType[]
  } | null
  assignment: {
    id: string
    shiftId: string
    name: string
    roleType: VolunteerRoleType
    roleLabel: string
    startTime: Date
    endTime: Date
    location: string | null
    notes: string | null
  } | null
  confirmation: CrewAssignmentConfirmationDisplay | null
}

export interface CrewAssignmentConfirmationResponseResult
  extends CrewAssignmentConfirmationTokenData {
  success: boolean
  outcome:
    | "updated"
    | "idempotent"
    | "expired"
    | "cancelled"
    | "already_responded"
    | "missing"
    | "bad"
  message: string
}

export interface CrewShiftAssignmentConfirmationStatus {
  id: string
  status: CrewAssignmentConfirmationStatus
  respondedAt: Date | null
  responseNote: string | null
}

export interface CrewAssignmentConfirmationEmailMessage {
  kind: "crew-assignment-confirmation"
  confirmationId: string
  assignmentId: string
  competitionId: string
  email: string
  subject: string
  bodyHtml: string
  replyTo?: string
}

export type EnsureCrewShiftAssignmentConfirmationResult =
  | {
      id: string
      action: "existing"
      token: null
    }
  | {
      id: string
      action: "created"
      token: string
    }

interface PublicTokenInput {
  slug: string
  token: string
}

interface PublicTokenResponseInput extends PublicTokenInput {
  action: CrewAssignmentResponseAction
  responseNote?: string
}

export async function getCrewAssignmentConfirmationToken(
  data: PublicTokenInput,
): Promise<CrewAssignmentConfirmationTokenData> {
  return await getCrewAssignmentConfirmationByToken(data)
}

export async function respondCrewAssignmentConfirmationToken(
  data: PublicTokenResponseInput,
): Promise<CrewAssignmentConfirmationResponseResult> {
  const db = getDb()
  const tokenHash = await hashCrewAssignmentConfirmationToken(data.token)
  const responseState: {
    outcome: CrewAssignmentConfirmationResponseResult["outcome"]
    message: string
  } = {
    outcome: "missing",
    message: "Assignment confirmation link was not found.",
  }

  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        confirmation: crewAssignmentConfirmationsTable,
      })
      .from(crewAssignmentConfirmationsTable)
      .innerJoin(
        competitionsTable,
        eq(
          crewAssignmentConfirmationsTable.competitionId,
          competitionsTable.id,
        ),
      )
      .innerJoin(
        crewEventSettingsTable,
        eq(crewEventSettingsTable.competitionId, competitionsTable.id),
      )
      .where(
        and(
          eq(crewAssignmentConfirmationsTable.tokenHash, tokenHash),
          eq(competitionsTable.slug, data.slug),
          eq(crewEventSettingsTable.crewOnly, true),
          ne(crewEventSettingsTable.lifecycle, CREW_EVENT_LIFECYCLE.ARCHIVED),
        ),
      )
      .for("update")
      .limit(1)

    if (!row) {
      responseState.outcome = "missing"
      return
    }

    const tokenState = getCrewAssignmentConfirmationTokenState(row.confirmation)
    if (tokenState !== "valid") {
      responseState.outcome = tokenState
      responseState.message =
        tokenState === "expired"
          ? "This assignment response link has expired."
          : "This assignment response link is no longer valid."
      return
    }

    const resolution = resolveCrewAssignmentConfirmationResponse(
      row.confirmation,
      data.action,
      data.responseNote,
    )

    if (!resolution.ok) {
      responseState.outcome = resolution.reason
      responseState.message = resolution.message
      return
    }

    responseState.outcome = resolution.outcome
    responseState.message =
      resolution.outcome === "idempotent"
        ? "Your assignment response was already recorded."
        : getResponseSuccessMessage(data.action)

    if (resolution.outcome === "updated") {
      await tx
        .update(crewAssignmentConfirmationsTable)
        .set({
          status: resolution.status,
          responseNote: resolution.responseNote,
          respondedAt: resolution.respondedAt,
          updatedAt: resolution.respondedAt,
        })
        .where(eq(crewAssignmentConfirmationsTable.id, row.confirmation.id))
    }
  })

  const freshData = await getCrewAssignmentConfirmationByToken(data)

  return {
    ...freshData,
    success:
      responseState.outcome === "updated" ||
      responseState.outcome === "idempotent",
    outcome: responseState.outcome,
    message: responseState.message,
  }
}

export async function ensureCrewShiftAssignmentConfirmation(params: {
  db: DbClient
  competitionId: string
  assignmentId: string
  membershipId: string
  email: string | null
  expiresAt: Date
  now?: Date
}): Promise<EnsureCrewShiftAssignmentConfirmationResult> {
  const now = params.now ?? new Date()
  return await withCrewAssignmentConfirmationLock(
    params.db,
    params.assignmentId,
    async () => {
      const [existing] = await params.db
        .select({
          id: crewAssignmentConfirmationsTable.id,
          status: crewAssignmentConfirmationsTable.status,
        })
        .from(crewAssignmentConfirmationsTable)
        .where(
          and(
            eq(
              crewAssignmentConfirmationsTable.assignmentType,
              CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
            ),
            eq(
              crewAssignmentConfirmationsTable.assignmentId,
              params.assignmentId,
            ),
            ne(
              crewAssignmentConfirmationsTable.status,
              CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED,
            ),
          ),
        )
        .limit(1)

      if (existing) {
        return { id: existing.id, action: "existing", token: null }
      }

      const token = generateCrewAssignmentConfirmationToken()
      const tokenHash = await hashCrewAssignmentConfirmationToken(token)
      const confirmationId = createCrewAssignmentConfirmationId()

      await params.db.insert(crewAssignmentConfirmationsTable).values({
        id: confirmationId,
        competitionId: params.competitionId,
        assignmentType: CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
        assignmentId: params.assignmentId,
        membershipId: params.membershipId,
        email: params.email,
        tokenHash,
        status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
        expiresAt: params.expiresAt,
        createdAt: now,
        updatedAt: now,
      })

      return { id: confirmationId, action: "created", token }
    },
  )
}

export async function cancelCrewShiftAssignmentConfirmations(params: {
  db: DbClient
  assignmentIds: string[]
  now?: Date
}) {
  if (params.assignmentIds.length === 0) return

  const now = params.now ?? new Date()
  await params.db
    .update(crewAssignmentConfirmationsTable)
    .set({
      status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED,
      updatedAt: now,
    })
    .where(
      and(
        eq(
          crewAssignmentConfirmationsTable.assignmentType,
          CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
        ),
        inArray(
          crewAssignmentConfirmationsTable.assignmentId,
          params.assignmentIds,
        ),
        eq(
          crewAssignmentConfirmationsTable.status,
          CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
        ),
      ),
    )
}

export async function loadCrewShiftAssignmentConfirmationMap(
  db: DbClient,
  assignmentIds: string[],
) {
  if (assignmentIds.length === 0) {
    return new Map<string, CrewShiftAssignmentConfirmationStatus>()
  }

  const rows = await db
    .select({
      assignmentId: crewAssignmentConfirmationsTable.assignmentId,
      id: crewAssignmentConfirmationsTable.id,
      status: crewAssignmentConfirmationsTable.status,
      respondedAt: crewAssignmentConfirmationsTable.respondedAt,
      responseNote: crewAssignmentConfirmationsTable.responseNote,
      updatedAt: crewAssignmentConfirmationsTable.updatedAt,
    })
    .from(crewAssignmentConfirmationsTable)
    .where(
      and(
        eq(
          crewAssignmentConfirmationsTable.assignmentType,
          CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
        ),
        inArray(crewAssignmentConfirmationsTable.assignmentId, assignmentIds),
      ),
    )
    .orderBy(desc(crewAssignmentConfirmationsTable.updatedAt))

  const byAssignment = new Map<string, CrewShiftAssignmentConfirmationStatus>()
  for (const row of rows) {
    if (byAssignment.has(row.assignmentId)) continue
    byAssignment.set(row.assignmentId, {
      id: row.id,
      status: row.status,
      respondedAt: row.respondedAt,
      responseNote: row.responseNote,
    })
  }
  return byAssignment
}

export function summarizeCrewShiftAssignmentConfirmations(
  confirmations: Array<CrewShiftAssignmentConfirmationStatus | null>,
): CrewAssignmentConfirmationStatusSummary {
  return summarizeCrewAssignmentConfirmations(
    confirmations.map((confirmation) => confirmation?.status),
  )
}

export async function buildCrewAssignmentConfirmationEmailMessage(params: {
  confirmationId: string
  event: CrewConfirmationCompetition
  volunteer: { name: string; email: string }
  assignment: {
    id: string
    shiftName: string
    roleLabel: string
    startTime: Date
    endTime: Date
    location: string | null
  }
  token: string
}) {
  const urls = buildCrewAssignmentConfirmationUrls({
    appUrl: getAppUrl(),
    slug: params.event.slug,
    token: params.token,
  })
  const timezone = params.event.timezone ?? DEFAULT_TIMEZONE
  const subject = `${params.event.name}: confirm ${params.assignment.shiftName}`
  const bodyHtml = await render(
    CrewAssignmentConfirmationEmail({
      eventName: params.event.name,
      volunteerName: params.volunteer.name,
      shiftName: params.assignment.shiftName,
      roleLabel: params.assignment.roleLabel,
      startsAtLabel: formatDateTimeInTimezone(
        params.assignment.startTime,
        timezone,
        "EEE, MMM d h:mm a",
      ),
      endsAtLabel: formatDateTimeInTimezone(
        params.assignment.endTime,
        timezone,
        "h:mm a",
      ),
      location: params.assignment.location,
      confirmUrl: urls.confirmUrl,
      scheduleUrl: urls.scheduleUrl,
    }),
  )

  return {
    kind: "crew-assignment-confirmation",
    confirmationId: params.confirmationId,
    assignmentId: params.assignment.id,
    competitionId: params.event.id,
    email: params.volunteer.email,
    subject,
    bodyHtml,
  } satisfies CrewAssignmentConfirmationEmailMessage
}

async function getCrewAssignmentConfirmationByToken({
  slug,
  token,
}: {
  slug: string
  token: string
}): Promise<CrewAssignmentConfirmationTokenData> {
  const db = getDb()
  const tokenHash = await hashCrewAssignmentConfirmationToken(token)
  const [row] = await db
    .select({
      event: {
        id: competitionsTable.id,
        slug: competitionsTable.slug,
        name: competitionsTable.name,
        timezone: competitionsTable.timezone,
        startDate: competitionsTable.startDate,
        endDate: competitionsTable.endDate,
      },
      confirmation: {
        id: crewAssignmentConfirmationsTable.id,
        status: crewAssignmentConfirmationsTable.status,
        sentAt: crewAssignmentConfirmationsTable.sentAt,
        respondedAt: crewAssignmentConfirmationsTable.respondedAt,
        expiresAt: crewAssignmentConfirmationsTable.expiresAt,
        responseNote: crewAssignmentConfirmationsTable.responseNote,
        tokenHash: crewAssignmentConfirmationsTable.tokenHash,
      },
      shift: {
        id: volunteerShiftsTable.id,
        name: volunteerShiftsTable.name,
        roleType: volunteerShiftsTable.roleType,
        startTime: volunteerShiftsTable.startTime,
        endTime: volunteerShiftsTable.endTime,
        location: volunteerShiftsTable.location,
        notes: volunteerShiftsTable.notes,
      },
      assignment: {
        id: volunteerShiftAssignmentsTable.id,
      },
      confirmationEmail: crewAssignmentConfirmationsTable.email,
      membership: {
        metadata: teamMembershipTable.metadata,
      },
      user: {
        firstName: userTable.firstName,
        lastName: userTable.lastName,
        email: userTable.email,
      },
    })
    .from(crewAssignmentConfirmationsTable)
    .innerJoin(
      competitionsTable,
      eq(crewAssignmentConfirmationsTable.competitionId, competitionsTable.id),
    )
    .innerJoin(
      crewEventSettingsTable,
      eq(crewEventSettingsTable.competitionId, competitionsTable.id),
    )
    .leftJoin(
      volunteerShiftAssignmentsTable,
      eq(
        crewAssignmentConfirmationsTable.assignmentId,
        volunteerShiftAssignmentsTable.id,
      ),
    )
    .leftJoin(
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
        eq(crewAssignmentConfirmationsTable.tokenHash, tokenHash),
        eq(
          crewAssignmentConfirmationsTable.assignmentType,
          CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
        ),
        eq(competitionsTable.slug, slug),
        eq(crewEventSettingsTable.crewOnly, true),
        ne(crewEventSettingsTable.lifecycle, CREW_EVENT_LIFECYCLE.ARCHIVED),
      ),
    )
    .limit(1)

  if (!row) {
    return emptyTokenData("missing")
  }

  const tokenState = getCrewAssignmentConfirmationTokenState(row.confirmation)
  const status =
    tokenState === "valid" && (!row.assignment?.id || !row.shift?.id)
      ? "bad"
      : tokenState
  if (status !== "valid") {
    return {
      status,
      event: row.event,
      volunteer: null,
      assignment: null,
      confirmation: toConfirmationDisplay(row.confirmation),
    }
  }

  const assignment = row.assignment
  const shift = row.shift
  if (!assignment || !shift) {
    return {
      status: "bad",
      event: row.event,
      volunteer: null,
      assignment: null,
      confirmation: toConfirmationDisplay(row.confirmation),
    }
  }

  const metadata = parseCrewRosterMetadata(row.membership?.metadata)
  const name =
    metadata.signupName ||
    [row.user?.firstName, row.user?.lastName].filter(Boolean).join(" ") ||
    row.user?.email ||
    row.confirmationEmail ||
    "Volunteer"
  const email =
    row.confirmationEmail ?? metadata.signupEmail ?? row.user?.email ?? ""

  return {
    status,
    event: row.event,
    volunteer: {
      name,
      email,
      roleTypes: getCrewRosterRoleTypes(metadata.volunteerRoleTypes),
    },
    assignment: {
      id: assignment.id,
      shiftId: shift.id,
      name: shift.name,
      roleType: shift.roleType,
      roleLabel: formatVolunteerRole(shift.roleType),
      startTime: shift.startTime,
      endTime: shift.endTime,
      location: shift.location,
      notes: shift.notes,
    },
    confirmation: toConfirmationDisplay(row.confirmation),
  }
}

function emptyTokenData(
  status: CrewAssignmentTokenState,
): CrewAssignmentConfirmationTokenData {
  return {
    status,
    event: null,
    volunteer: null,
    assignment: null,
    confirmation: null,
  }
}

function toConfirmationDisplay(confirmation: {
  id: string
  status: CrewAssignmentConfirmationStatus
  sentAt: Date | null
  respondedAt: Date | null
  expiresAt: Date | null
  responseNote: string | null
}): CrewAssignmentConfirmationDisplay {
  return {
    id: confirmation.id,
    status: confirmation.status,
    sentAt: confirmation.sentAt,
    respondedAt: confirmation.respondedAt,
    expiresAt: confirmation.expiresAt,
    responseNote: confirmation.responseNote,
  }
}

function getResponseSuccessMessage(action: CrewAssignmentResponseAction) {
  const status = statusForCrewAssignmentResponseAction(action)
  if (status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED) {
    return "Assignment confirmed. Thank you."
  }
  if (status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.DECLINED) {
    return "Assignment declined. The organizer will see your response."
  }
  return "Change request sent. The organizer will see your note."
}

async function withCrewAssignmentConfirmationLock<T>(
  db: DbClient,
  assignmentId: string,
  callback: () => Promise<T>,
) {
  let acquired = false
  const lockName = await createCrewAssignmentConfirmationLockName(assignmentId)

  try {
    const result = await db.execute(
      sql`SELECT GET_LOCK(${lockName}, 5) FROM dual`,
    )
    acquired = Number(getFirstExecuteValue(result) ?? 0) === 1
    if (!acquired) {
      throw new Error("Assignment confirmation could not be saved")
    }

    return await callback()
  } finally {
    if (acquired) {
      await db.execute(sql`SELECT RELEASE_LOCK(${lockName}) FROM dual`)
    }
  }
}

async function createCrewAssignmentConfirmationLockName(assignmentId: string) {
  const encoded = new TextEncoder().encode(
    `crew-assignment-confirmation:${assignmentId}`,
  )
  const digest = await crypto.subtle.digest("SHA-256", encoded)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")
}
