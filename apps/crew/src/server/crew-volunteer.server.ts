// @lat: [[crew#Import Apply#Confirmed Mutation]]
import { createId } from "@paralleldrive/cuid2"
import { and, asc, desc, eq, ne, notInArray, or, sql } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "../db"
import {
  createCrewAssignmentConfirmationId,
  createTeamInvitationId,
} from "../db/schemas/common"
import {
  competitionRegistrationQuestionsTable,
  competitionsTable,
  volunteerRegistrationAnswersTable,
} from "../db/schemas/competitions"
import {
  CREW_EVENT_LIFECYCLE,
  crewEventSettingsTable,
} from "../db/schemas/crew-event-settings"
import {
  CREW_ASSIGNMENT_CONFIRMATION_STATUS,
  CREW_ASSIGNMENT_CONFIRMATION_TYPE,
  type CrewAssignmentConfirmationStatus,
  crewAssignmentConfirmationsTable,
} from "../db/schemas/crew-imports"
import {
  CREW_VOLUNTEER_HISTORY_ASSIGNMENT_TYPE,
  CREW_VOLUNTEER_HISTORY_EVENT_TYPE,
  CREW_VOLUNTEER_IDENTITY_SOURCE,
  type CrewVolunteerHistoryEventType,
} from "../db/schemas/crew-volunteer-intelligence"
import {
  INVITATION_STATUS,
  SYSTEM_ROLES_ENUM,
  teamInvitationTable,
  teamMembershipTable,
} from "../db/schemas/teams"
import { userTable } from "../db/schemas/users"
import {
  type VolunteerAvailability,
  type VolunteerRoleType,
  volunteerShiftAssignmentsTable,
  volunteerShiftsTable,
} from "../db/schemas/volunteers"
import { waiversTable } from "../db/schemas/waivers"
import {
  type CrewAssignmentResponseAction,
  generateCrewAssignmentConfirmationToken,
  hashCrewAssignmentConfirmationToken,
  resolveCrewAssignmentConfirmationResponse,
} from "../lib/crew/assignment-confirmations"
import {
  formatVolunteerRole,
  getCrewRosterRoleTypes,
  parseCrewRosterMetadata,
} from "../lib/crew/roster-shifts"
import {
  buildCrewVolunteerSelfServiceSchedule,
  type CrewVolunteerSelfServiceAssignmentRecord,
  type CrewVolunteerSelfServiceConfirmation,
  type CrewVolunteerSelfServiceScheduleItem,
} from "../lib/crew/volunteer-self-service"
import {
  buildCrewVolunteerSignupMetadata,
  type crewVolunteerSignupInputSchema,
  getCrewVolunteerTokenState,
  isCrewVolunteerSignupSpam,
  mergeCrewVolunteerSignupMetadata,
  normalizeVolunteerSignupEmail,
  planCrewVolunteerSignup,
  validateCrewVolunteerSignupRequirements,
} from "../lib/crew/volunteer-signup"
import { getFirstExecuteValue } from "../server-fns/db-execute"
import type { QuestionType } from "../server-fns/registration-questions-fns"
import { recordCrewVolunteerHistoryEvent } from "./crew-volunteer-history.server"

type DbClient = ReturnType<typeof getDb>
const PUBLIC_DUPLICATE_VOLUNTEER_SIGNUP_ERROR =
  "This volunteer application could not be submitted. Please contact the organizer if you already signed up."

export interface PublicCrewVolunteerEvent {
  id: string
  slug: string
  name: string
  description: string | null
  startDate: string
  endDate: string
  timezone: string | null
  competitionTeamId: string
}

export interface PublicCrewVolunteerQuestion {
  id: string
  competitionId: string | null
  groupId: string | null
  type: QuestionType
  label: string
  helpText: string | null
  options: string[] | null
  required: boolean
  sortOrder: number
}

export interface PublicCrewVolunteerWaiver {
  id: string
  title: string
  content: string
}

export interface CrewVolunteerSignupPageData {
  event: PublicCrewVolunteerEvent | null
  questions: PublicCrewVolunteerQuestion[]
  waivers: PublicCrewVolunteerWaiver[]
}

export interface CrewVolunteerScheduleTokenData {
  status: "valid" | "missing" | "expired" | "bad"
  event: PublicCrewVolunteerEvent | null
  volunteer: PublicCrewVolunteerProfile | null
  assignments: CrewVolunteerVisibleAssignment[]
  confirmations: CrewVolunteerVisibleConfirmation[]
}

export interface PublicCrewVolunteerProfile {
  email: string
  name: string | null
  phone: string | null
  availability: VolunteerAvailability | null
  availabilityNotes: string | null
  credentials: string | null
  roleTypes: VolunteerRoleType[]
  invitationStatus: string
}

export interface CrewVolunteerVisibleConfirmation
  extends CrewVolunteerSelfServiceConfirmation {
  assignmentId: string
}

export interface CrewVolunteerVisibleAssignment
  extends CrewVolunteerSelfServiceScheduleItem {}
export interface CrewVolunteerScheduleResponseResult
  extends CrewVolunteerScheduleTokenData {
  success: boolean
  outcome:
    | "updated"
    | "idempotent"
    | "expired"
    | "cancelled"
    | "already_responded"
    | "missing_note"
    | "missing"
    | "bad"
  message: string
}

const getCrewVolunteerSignupPageInputSchema = z.object({
  slug: z.string().trim().min(1, "Event slug is required").max(255),
})

const getCrewVolunteerScheduleTokenInputSchema = z.object({
  slug: z.string().trim().min(1, "Event slug is required").max(255),
  token: z.string().trim().min(1, "Token is required").max(255),
})

const respondCrewVolunteerScheduleTokenInputSchema =
  getCrewVolunteerScheduleTokenInputSchema.extend({
    assignmentId: z.string().trim().min(1, "Assignment is required").max(255),
    action: z.enum(["confirm", "decline", "request_change"]),
    responseNote: z.string().trim().max(1000).optional(),
  })

export async function getCrewVolunteerSignupPage(
  data: z.infer<typeof getCrewVolunteerSignupPageInputSchema>,
): Promise<CrewVolunteerSignupPageData> {
  const db = getDb()
  const event = await getPublicCrewEventBySlug(db, data.slug)
  if (!event) {
    return { event: null, questions: [], waivers: [] }
  }

  const [questions, waivers] = await Promise.all([
    listVolunteerQuestions(db, event.id, event.groupId),
    listRequiredVolunteerWaivers(db, event.id),
  ])

  return {
    event: toPublicCrewVolunteerEvent(event),
    questions,
    waivers,
  }
}

export async function submitCrewVolunteerSignup(
  data: z.infer<typeof crewVolunteerSignupInputSchema>,
) {
  if (isCrewVolunteerSignupSpam(data)) {
    return { success: true, applicationId: null, action: "accepted" as const }
  }

  const db = getDb()
  const event = await getPublicCrewEventBySlug(db, data.eventSlug)
  if (!event) {
    throw new Error("Crew event not found")
  }

  const [questions, waivers] = await Promise.all([
    listVolunteerQuestions(db, event.id, event.groupId),
    listRequiredVolunteerWaivers(db, event.id),
  ])

  const validationErrors = validateCrewVolunteerSignupRequirements(data, {
    questions,
    requiredWaiverIds: waivers.map((waiver) => waiver.id),
  })
  if (validationErrors.length > 0) {
    throw new Error(validationErrors[0])
  }

  validateSubmittedQuestionIds(data.answers ?? [], questions)
  validateSubmittedWaiverIds(data.waiverIds ?? [], waivers)

  const timestamp = new Date()
  const expiresAt = new Date(timestamp)
  expiresAt.setFullYear(expiresAt.getFullYear() + 1)
  const signupMetadata = buildCrewVolunteerSignupMetadata(data, timestamp)
  const email = normalizeVolunteerSignupEmail(data.signupEmail)
  let invitationId: string | null = null
  let action: "created" | "updated" = "created"

  await db.transaction(async (tx) => {
    const client = tx as unknown as DbClient
    await withVolunteerSignupLock(
      client,
      event.competitionTeamId,
      email,
      async () => {
        const [existingInvitations, existingMemberships] = await Promise.all([
          listVolunteerInvitations(client, event.competitionTeamId),
          listVolunteerMemberships(client, event.competitionTeamId),
        ])
        const plan = planCrewVolunteerSignup(data, {
          existingInvitations,
          existingMemberships,
        })

        if (plan.action === "reject") {
          throw new Error(PUBLIC_DUPLICATE_VOLUNTEER_SIGNUP_ERROR)
        }

        const existingInvitation =
          plan.action === "update_invitation"
            ? existingInvitations.find(
                (invitation) => invitation.id === plan.targetId,
              )
            : null
        const metadata = mergeCrewVolunteerSignupMetadata(
          existingInvitation?.metadata,
          signupMetadata,
        )

        if (plan.action === "create_invitation") {
          invitationId = createTeamInvitationId()
          action = "created"
          await client.insert(teamInvitationTable).values({
            id: invitationId,
            teamId: event.competitionTeamId,
            email,
            roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
            isSystemRole: true,
            token: createId(),
            invitedBy: null,
            expiresAt,
            status: INVITATION_STATUS.PENDING,
            metadata,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
        } else if (plan.action === "update_invitation" && plan.targetId) {
          invitationId = plan.targetId
          action = "updated"
          await client
            .update(teamInvitationTable)
            .set({
              email,
              roleId: SYSTEM_ROLES_ENUM.VOLUNTEER,
              isSystemRole: true,
              expiresAt,
              status: INVITATION_STATUS.PENDING,
              metadata,
              updatedAt: timestamp,
            })
            .where(eq(teamInvitationTable.id, invitationId))
        }

        if (!invitationId) {
          throw new Error("Volunteer application could not be saved")
        }

        await syncVolunteerAnswers(
          client,
          invitationId,
          data.answers ?? [],
          timestamp,
        )
        await recordCrewVolunteerHistoryEvent({
          db: client,
          teamId: event.organizingTeamId,
          competitionId: event.id,
          groupId: event.groupId,
          eventType: CREW_VOLUNTEER_HISTORY_EVENT_TYPE.SIGNED_UP,
          identity: {
            email,
            phone: data.signupPhone,
            sourceInvitationId: invitationId,
            identitySource: CREW_VOLUNTEER_IDENTITY_SOURCE.SELF_SERVICE,
          },
          occurredAt: timestamp,
          sourceType: "crew_volunteer_signup",
          sourceId: invitationId,
        })
      },
    )
  })

  return {
    success: true,
    applicationId: invitationId,
    action,
  }
}

export async function getCrewVolunteerScheduleToken(
  data: z.infer<typeof getCrewVolunteerScheduleTokenInputSchema>,
): Promise<CrewVolunteerScheduleTokenData> {
  const db = getDb()
  const row = await getCrewVolunteerTokenContext(db, data)

  if (!row) {
    return emptyScheduleTokenData("missing")
  }

  const status = getCrewVolunteerTokenState(row.invitation)
  if (status !== "valid") {
    return emptyScheduleTokenData(status)
  }

  const membership = await findVolunteerTokenMembership(db, {
    competitionTeamId: row.event.competitionTeamId,
    invitation: row.invitation,
  })
  const volunteer = toPublicVolunteerProfile(row.invitation, membership)
  const assignments = await loadCrewVolunteerVisibleAssignments(db, {
    competitionId: row.event.id,
    invitationId: row.invitation.id,
    email: volunteer.email,
    membershipId: membership?.id ?? null,
  })

  return {
    status,
    event: toPublicCrewVolunteerEvent(row.event),
    volunteer,
    assignments,
    confirmations: listVisibleConfirmations(assignments),
  }
}

export async function respondCrewVolunteerScheduleToken(
  data: z.infer<typeof respondCrewVolunteerScheduleTokenInputSchema>,
): Promise<CrewVolunteerScheduleResponseResult> {
  const db = getDb()
  const responseState: {
    outcome: CrewVolunteerScheduleResponseResult["outcome"]
    message: string
  } = {
    outcome: "missing",
    message: "Volunteer schedule link was not found.",
  }

  await db.transaction(async (tx) => {
    const client = tx as unknown as DbClient
    const context = await getCrewVolunteerTokenContext(client, data)

    if (!context) {
      responseState.outcome = "missing"
      return
    }

    const tokenState = getCrewVolunteerTokenState(context.invitation)
    if (tokenState !== "valid") {
      responseState.outcome = tokenState === "expired" ? "expired" : "bad"
      responseState.message =
        tokenState === "expired"
          ? "This volunteer schedule link has expired."
          : "This volunteer schedule link is no longer valid."
      return
    }

    const membership = await findVolunteerTokenMembership(client, {
      competitionTeamId: context.event.competitionTeamId,
      invitation: context.invitation,
    })
    const volunteer = toPublicVolunteerProfile(context.invitation, membership)
    const assignmentContext = await getVisibleVolunteerAssignmentForResponse(
      client,
      {
        competitionId: context.event.id,
        assignmentId: data.assignmentId,
        invitationId: context.invitation.id,
        email: volunteer.email,
        membershipId: membership?.id ?? null,
      },
    )

    if (!assignmentContext) {
      responseState.outcome = "bad"
      responseState.message = "This assignment is not available from this link."
      return
    }

    const confirmation =
      toResponseConfirmation(assignmentContext.confirmation) ??
      (await createCrewVolunteerScheduleConfirmation(client, {
        competitionId: context.event.id,
        assignmentId: assignmentContext.assignment.id,
        membershipId: assignmentContext.assignment.membershipId,
        invitationId: context.invitation.id,
        email: volunteer.email,
      }))

    const resolution = resolveCrewAssignmentConfirmationResponse(
      confirmation,
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
        : getVolunteerScheduleResponseSuccessMessage(data.action)

    if (resolution.outcome === "updated") {
      await client
        .update(crewAssignmentConfirmationsTable)
        .set({
          status: resolution.status,
          responseNote: resolution.responseNote,
          respondedAt: resolution.respondedAt,
          updatedAt: resolution.respondedAt,
        })
        .where(eq(crewAssignmentConfirmationsTable.id, confirmation.id))

      const historyEventType = historyEventTypeForVolunteerResponse(
        resolution.status,
      )
      if (historyEventType) {
        const membershipMetadata = parseCrewRosterMetadata(
          assignmentContext.membership?.metadata,
        )
        await recordCrewVolunteerHistoryEvent({
          db: client,
          teamId: context.event.organizingTeamId,
          competitionId: context.event.id,
          groupId: context.event.groupId,
          eventType: historyEventType,
          identity: {
            userId: assignmentContext.membership?.userId,
            email:
              membershipMetadata.signupEmail ??
              confirmation.email ??
              volunteer.email,
            phone: membershipMetadata.signupPhone ?? volunteer.phone,
            sourceMembershipId: assignmentContext.assignment.membershipId,
            sourceInvitationId: context.invitation.id,
            identitySource: membership
              ? CREW_VOLUNTEER_IDENTITY_SOURCE.MEMBERSHIP
              : CREW_VOLUNTEER_IDENTITY_SOURCE.SELF_SERVICE,
          },
          assignmentType:
            CREW_VOLUNTEER_HISTORY_ASSIGNMENT_TYPE.VOLUNTEER_SHIFT,
          assignmentId: assignmentContext.assignment.id,
          roleType: assignmentContext.shift.roleType,
          occurredAt: resolution.respondedAt,
          sourceType: "crew_volunteer_schedule_token",
          sourceId: confirmation.id,
        })
      }
    }
  })

  const freshData = await getCrewVolunteerScheduleToken(data)

  return {
    ...freshData,
    success:
      responseState.outcome === "updated" ||
      responseState.outcome === "idempotent",
    outcome: responseState.outcome,
    message: responseState.message,
  }
}

const publicCrewEventSelect = {
  id: competitionsTable.id,
  slug: competitionsTable.slug,
  name: competitionsTable.name,
  description: competitionsTable.description,
  organizingTeamId: competitionsTable.organizingTeamId,
  startDate: competitionsTable.startDate,
  endDate: competitionsTable.endDate,
  timezone: competitionsTable.timezone,
  competitionTeamId: competitionsTable.competitionTeamId,
  groupId: competitionsTable.groupId,
}

type InternalPublicCrewEvent = PublicCrewVolunteerEvent & {
  organizingTeamId: string
  groupId: string | null
}

async function getPublicCrewEventBySlug(db: DbClient, slug: string) {
  const [event] = await db
    .select(publicCrewEventSelect)
    .from(crewEventSettingsTable)
    .innerJoin(
      competitionsTable,
      eq(crewEventSettingsTable.competitionId, competitionsTable.id),
    )
    .where(
      and(
        eq(competitionsTable.slug, slug),
        eq(crewEventSettingsTable.crewOnly, true),
        ne(crewEventSettingsTable.lifecycle, CREW_EVENT_LIFECYCLE.ARCHIVED),
      ),
    )
    .limit(1)

  return event ?? null
}

function toPublicCrewVolunteerEvent(
  event: InternalPublicCrewEvent,
): PublicCrewVolunteerEvent {
  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    timezone: event.timezone,
    competitionTeamId: event.competitionTeamId,
  }
}

async function getCrewVolunteerTokenContext(
  db: DbClient,
  data: { slug: string; token: string },
) {
  const [row] = await db
    .select({
      event: publicCrewEventSelect,
      invitation: {
        id: teamInvitationTable.id,
        email: teamInvitationTable.email,
        token: teamInvitationTable.token,
        status: teamInvitationTable.status,
        acceptedAt: teamInvitationTable.acceptedAt,
        acceptedBy: teamInvitationTable.acceptedBy,
        expiresAt: teamInvitationTable.expiresAt,
        metadata: teamInvitationTable.metadata,
      },
    })
    .from(teamInvitationTable)
    .innerJoin(
      competitionsTable,
      eq(teamInvitationTable.teamId, competitionsTable.competitionTeamId),
    )
    .innerJoin(
      crewEventSettingsTable,
      eq(crewEventSettingsTable.competitionId, competitionsTable.id),
    )
    .where(
      and(
        eq(competitionsTable.slug, data.slug),
        eq(teamInvitationTable.token, data.token),
        eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
        eq(teamInvitationTable.isSystemRole, true),
        eq(crewEventSettingsTable.crewOnly, true),
        ne(crewEventSettingsTable.lifecycle, CREW_EVENT_LIFECYCLE.ARCHIVED),
      ),
    )
    .limit(1)

  return row ?? null
}

type CrewVolunteerTokenContext = NonNullable<
  Awaited<ReturnType<typeof getCrewVolunteerTokenContext>>
>

type CrewVolunteerTokenInvitation = CrewVolunteerTokenContext["invitation"]

interface CrewVolunteerTokenMembership {
  id: string
  userId: string
  metadata: string | null
  email: string | null
  firstName: string | null
  lastName: string | null
}

async function findVolunteerTokenMembership(
  db: DbClient,
  params: {
    competitionTeamId: string
    invitation: CrewVolunteerTokenInvitation
  },
): Promise<CrewVolunteerTokenMembership | null> {
  const acceptedInvitation =
    params.invitation.acceptedAt ||
    params.invitation.acceptedBy ||
    params.invitation.status === INVITATION_STATUS.ACCEPTED
  if (!acceptedInvitation) {
    return null
  }

  const rows = await db
    .select({
      id: teamMembershipTable.id,
      userId: teamMembershipTable.userId,
      metadata: teamMembershipTable.metadata,
      email: userTable.email,
      firstName: userTable.firstName,
      lastName: userTable.lastName,
    })
    .from(teamMembershipTable)
    .leftJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
    .where(
      and(
        eq(teamMembershipTable.teamId, params.competitionTeamId),
        eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
        eq(teamMembershipTable.isSystemRole, true),
        eq(teamMembershipTable.isActive, true),
      ),
    )

  const acceptedMembership = params.invitation.acceptedBy
    ? rows.find((row) => row.userId === params.invitation.acceptedBy)
    : null
  if (acceptedMembership) return acceptedMembership

  const invitationMetadata = parseCrewRosterMetadata(params.invitation.metadata)
  const email = normalizeVolunteerSignupEmail(
    invitationMetadata.signupEmail ?? params.invitation.email,
  )

  return (
    rows.find((row) => {
      const membershipMetadata = parseCrewRosterMetadata(row.metadata)
      return (
        normalizeVolunteerSignupEmail(membershipMetadata.signupEmail ?? "") ===
          email || normalizeVolunteerSignupEmail(row.email ?? "") === email
      )
    }) ?? null
  )
}

function toPublicVolunteerProfile(
  invitation: CrewVolunteerTokenInvitation,
  membership: CrewVolunteerTokenMembership | null,
): PublicCrewVolunteerProfile {
  const metadata = parseCrewRosterMetadata(
    membership?.metadata ?? invitation.metadata,
  )
  const name =
    metadata.signupName ??
    [membership?.firstName, membership?.lastName].filter(Boolean).join(" ") ??
    null
  const email =
    metadata.signupEmail ?? membership?.email ?? invitation.email ?? ""

  return {
    email,
    name: name || null,
    phone: metadata.signupPhone ?? null,
    availability: metadata.availability ?? null,
    availabilityNotes: metadata.availabilityNotes ?? null,
    credentials: metadata.credentials ?? null,
    roleTypes: getCrewRosterRoleTypes(metadata.volunteerRoleTypes),
    invitationStatus: invitation.status,
  }
}

async function loadCrewVolunteerVisibleAssignments(
  db: DbClient,
  params: {
    competitionId: string
    invitationId: string
    email: string
    membershipId: string | null
  },
): Promise<CrewVolunteerVisibleAssignment[]> {
  const rows = params.membershipId
    ? await loadCrewVolunteerAssignmentRows(db, {
        competitionId: params.competitionId,
        assignmentId: null,
        membershipId: params.membershipId,
        invitationId: null,
        email: null,
        includeAssignmentsWithoutConfirmations: true,
        lockRows: false,
      })
    : await loadCrewVolunteerAssignmentRows(db, {
        competitionId: params.competitionId,
        assignmentId: null,
        membershipId: null,
        invitationId: params.invitationId,
        email: params.email,
        includeAssignmentsWithoutConfirmations: false,
        lockRows: false,
      })

  if (params.membershipId) {
    return buildCrewVolunteerSelfServiceSchedule({
      membershipId: params.membershipId,
      tokenAssignmentId: "",
      assignments: toSelfServiceAssignmentRecords(rows),
    })
  }

  return buildCrewVolunteerVisibleSchedule(toSelfServiceAssignmentRecords(rows))
}

async function getVisibleVolunteerAssignmentForResponse(
  db: DbClient,
  params: {
    competitionId: string
    assignmentId: string
    invitationId: string
    email: string
    membershipId: string | null
  },
) {
  const rows = params.membershipId
    ? await loadCrewVolunteerAssignmentRows(db, {
        competitionId: params.competitionId,
        assignmentId: params.assignmentId,
        membershipId: params.membershipId,
        invitationId: null,
        email: null,
        includeAssignmentsWithoutConfirmations: true,
        lockRows: true,
      })
    : await loadCrewVolunteerAssignmentRows(db, {
        competitionId: params.competitionId,
        assignmentId: params.assignmentId,
        membershipId: null,
        invitationId: params.invitationId,
        email: params.email,
        includeAssignmentsWithoutConfirmations: false,
        lockRows: true,
      })

  return rows[0] ?? null
}

async function loadCrewVolunteerAssignmentRows(
  db: DbClient,
  params: {
    competitionId: string
    assignmentId: string | null
    membershipId: string | null
    invitationId: string | null
    email: string | null
    includeAssignmentsWithoutConfirmations: boolean
    lockRows: boolean
  },
) {
  const confirmationConditions = [
    params.invitationId
      ? eq(crewAssignmentConfirmationsTable.invitationId, params.invitationId)
      : null,
    params.email
      ? sql`lower(${crewAssignmentConfirmationsTable.email}) = ${normalizeVolunteerSignupEmail(
          params.email,
        )}`
      : null,
  ].filter((condition): condition is NonNullable<typeof condition> =>
    Boolean(condition),
  )
  const visibilityCondition =
    params.membershipId !== null
      ? eq(volunteerShiftAssignmentsTable.membershipId, params.membershipId)
      : confirmationConditions.length === 1
        ? confirmationConditions[0]
        : confirmationConditions.length > 1
          ? or(...confirmationConditions)
          : sql`false`
  const confirmationStatusCondition =
    params.includeAssignmentsWithoutConfirmations
      ? null
      : ne(
          crewAssignmentConfirmationsTable.status,
          CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED,
        )
  const rowsQuery = db
    .select({
      assignment: {
        id: volunteerShiftAssignmentsTable.id,
        membershipId: volunteerShiftAssignmentsTable.membershipId,
        notes: volunteerShiftAssignmentsTable.notes,
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
      membership: {
        id: teamMembershipTable.id,
        userId: teamMembershipTable.userId,
        metadata: teamMembershipTable.metadata,
      },
      confirmation: {
        id: crewAssignmentConfirmationsTable.id,
        status: crewAssignmentConfirmationsTable.status,
        sentAt: crewAssignmentConfirmationsTable.sentAt,
        respondedAt: crewAssignmentConfirmationsTable.respondedAt,
        expiresAt: crewAssignmentConfirmationsTable.expiresAt,
        responseNote: crewAssignmentConfirmationsTable.responseNote,
        email: crewAssignmentConfirmationsTable.email,
        updatedAt: crewAssignmentConfirmationsTable.updatedAt,
      },
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
    .leftJoin(
      crewAssignmentConfirmationsTable,
      and(
        eq(
          crewAssignmentConfirmationsTable.assignmentType,
          CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
        ),
        eq(
          crewAssignmentConfirmationsTable.assignmentId,
          volunteerShiftAssignmentsTable.id,
        ),
      ),
    )
    .where(
      and(
        eq(volunteerShiftsTable.competitionId, params.competitionId),
        params.assignmentId
          ? eq(volunteerShiftAssignmentsTable.id, params.assignmentId)
          : undefined,
        visibilityCondition,
        confirmationStatusCondition ?? undefined,
      ),
    )
    .orderBy(
      asc(volunteerShiftsTable.startTime),
      asc(volunteerShiftsTable.name),
      desc(crewAssignmentConfirmationsTable.updatedAt),
    )

  return params.lockRows ? await rowsQuery.for("update") : await rowsQuery
}

type CrewVolunteerAssignmentRow = Awaited<
  ReturnType<typeof loadCrewVolunteerAssignmentRows>
>[number]

function toSelfServiceAssignmentRecords(
  rows: CrewVolunteerAssignmentRow[],
): CrewVolunteerSelfServiceAssignmentRecord[] {
  return rows.map((row) => ({
    id: row.assignment.id,
    membershipId: row.assignment.membershipId,
    shiftId: row.shift.id,
    name: row.shift.name,
    roleType: row.shift.roleType,
    roleLabel: formatVolunteerRole(row.shift.roleType),
    startTime: row.shift.startTime,
    endTime: row.shift.endTime,
    location: row.shift.location,
    notes: row.assignment.notes ?? row.shift.notes,
    confirmation:
      row.confirmation?.id && row.confirmation.status
        ? {
            id: row.confirmation.id,
            status: row.confirmation.status,
            sentAt: row.confirmation.sentAt,
            respondedAt: row.confirmation.respondedAt,
            expiresAt: row.confirmation.expiresAt,
            responseNote: row.confirmation.responseNote,
          }
        : null,
  }))
}

function buildCrewVolunteerVisibleSchedule(
  assignments: CrewVolunteerSelfServiceAssignmentRecord[],
): CrewVolunteerVisibleAssignment[] {
  const byAssignmentId = new Map<string, CrewVolunteerVisibleAssignment>()

  for (const assignment of assignments) {
    if (byAssignmentId.has(assignment.id)) continue

    const startTime = toValidDate(assignment.startTime)
    const endTime = toValidDate(assignment.endTime)
    if (!startTime || !endTime) continue

    byAssignmentId.set(assignment.id, {
      id: assignment.id,
      shiftId: assignment.shiftId,
      name: assignment.name,
      roleType: assignment.roleType,
      roleLabel: assignment.roleLabel,
      startTime,
      endTime,
      location: assignment.location,
      notes: assignment.notes,
      confirmation: assignment.confirmation,
      isTokenAssignment: false,
    })
  }

  return [...byAssignmentId.values()].sort((left, right) => {
    const timeDiff = left.startTime.getTime() - right.startTime.getTime()
    if (timeDiff !== 0) return timeDiff
    return left.name.localeCompare(right.name)
  })
}

function listVisibleConfirmations(
  assignments: CrewVolunteerVisibleAssignment[],
): CrewVolunteerVisibleConfirmation[] {
  return assignments.flatMap((assignment) =>
    assignment.confirmation
      ? [{ ...assignment.confirmation, assignmentId: assignment.id }]
      : [],
  )
}

function toResponseConfirmation(
  confirmation: CrewVolunteerAssignmentRow["confirmation"],
) {
  if (!confirmation?.id || !confirmation.status) return null
  return {
    id: confirmation.id,
    status: confirmation.status,
    expiresAt: confirmation.expiresAt,
    responseNote: confirmation.responseNote,
    email: confirmation.email,
  }
}

async function createCrewVolunteerScheduleConfirmation(
  db: DbClient,
  params: {
    competitionId: string
    assignmentId: string
    membershipId: string
    invitationId: string
    email: string
  },
) {
  const now = new Date()
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + 14)
  const token = generateCrewAssignmentConfirmationToken()
  const tokenHash = await hashCrewAssignmentConfirmationToken(token)
  const confirmation = {
    id: createCrewAssignmentConfirmationId(),
    competitionId: params.competitionId,
    assignmentType: CREW_ASSIGNMENT_CONFIRMATION_TYPE.VOLUNTEER_SHIFT,
    assignmentId: params.assignmentId,
    membershipId: params.membershipId,
    invitationId: params.invitationId,
    email: normalizeVolunteerSignupEmail(params.email),
    tokenHash,
    status: CREW_ASSIGNMENT_CONFIRMATION_STATUS.PENDING,
    sentAt: null,
    respondedAt: null,
    expiresAt,
    responseNote: null,
    createdAt: now,
    updatedAt: now,
  } satisfies typeof crewAssignmentConfirmationsTable.$inferInsert

  await db.insert(crewAssignmentConfirmationsTable).values(confirmation)

  return {
    id: confirmation.id,
    status: confirmation.status,
    expiresAt: confirmation.expiresAt,
    responseNote: confirmation.responseNote,
    email: confirmation.email,
  }
}

function getVolunteerScheduleResponseSuccessMessage(
  action: CrewAssignmentResponseAction,
) {
  if (action === "confirm") {
    return "Confirmed. We'll remind you before your shift."
  }
  if (action === "decline") {
    return "Declined. The organizer will see your note."
  }
  return "Change request sent. The organizer will see your note."
}

function historyEventTypeForVolunteerResponse(
  status: CrewAssignmentConfirmationStatus,
): CrewVolunteerHistoryEventType | null {
  if (status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.CONFIRMED) {
    return CREW_VOLUNTEER_HISTORY_EVENT_TYPE.CONFIRMED
  }
  if (status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.DECLINED) {
    return CREW_VOLUNTEER_HISTORY_EVENT_TYPE.DECLINED
  }
  if (status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.CHANGE_REQUESTED) {
    return CREW_VOLUNTEER_HISTORY_EVENT_TYPE.CHANGE_REQUESTED
  }
  return null
}

function emptyScheduleTokenData(
  status: CrewVolunteerScheduleTokenData["status"],
): CrewVolunteerScheduleTokenData {
  return {
    status,
    event: null,
    volunteer: null,
    assignments: [],
    confirmations: [],
  }
}

function toValidDate(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

async function listVolunteerQuestions(
  db: DbClient,
  competitionId: string,
  groupId: string | null,
): Promise<PublicCrewVolunteerQuestion[]> {
  const competitionQuestions = await db
    .select()
    .from(competitionRegistrationQuestionsTable)
    .where(
      and(
        eq(competitionRegistrationQuestionsTable.competitionId, competitionId),
        eq(competitionRegistrationQuestionsTable.questionTarget, "volunteer"),
      ),
    )
    .orderBy(asc(competitionRegistrationQuestionsTable.sortOrder))

  const seriesQuestions = groupId
    ? await db
        .select()
        .from(competitionRegistrationQuestionsTable)
        .where(
          and(
            eq(competitionRegistrationQuestionsTable.groupId, groupId),
            eq(
              competitionRegistrationQuestionsTable.questionTarget,
              "volunteer",
            ),
          ),
        )
        .orderBy(asc(competitionRegistrationQuestionsTable.sortOrder))
    : []

  return [...seriesQuestions, ...competitionQuestions].map((question) => ({
    id: question.id,
    competitionId: question.competitionId,
    groupId: question.groupId,
    type: question.type as QuestionType,
    label: question.label,
    helpText: question.helpText,
    options: parseQuestionOptions(question.options),
    required: question.required,
    sortOrder: question.sortOrder,
  }))
}

async function listRequiredVolunteerWaivers(
  db: DbClient,
  competitionId: string,
): Promise<PublicCrewVolunteerWaiver[]> {
  return await db
    .select({
      id: waiversTable.id,
      title: waiversTable.title,
      content: waiversTable.content,
    })
    .from(waiversTable)
    .where(
      and(
        eq(waiversTable.competitionId, competitionId),
        eq(waiversTable.requiredForVolunteers, true),
      ),
    )
    .orderBy(asc(waiversTable.position))
}

async function listVolunteerInvitations(
  db: DbClient,
  competitionTeamId: string,
) {
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
) {
  const rows = await db
    .select({
      id: teamMembershipTable.id,
      email: userTable.email,
      isActive: teamMembershipTable.isActive,
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
    row.email ? [{ ...row, email: row.email }] : [],
  )
}

function validateSubmittedQuestionIds(
  answers: Array<{ questionId: string; answer: string }>,
  questions: PublicCrewVolunteerQuestion[],
) {
  const questionIds = new Set(questions.map((question) => question.id))
  const invalidAnswer = answers.find(
    (answer) => !questionIds.has(answer.questionId),
  )
  if (invalidAnswer) {
    throw new Error("One or more volunteer question answers are invalid")
  }
}

function validateSubmittedWaiverIds(
  waiverIds: string[],
  waivers: PublicCrewVolunteerWaiver[],
) {
  const validWaiverIds = new Set(waivers.map((waiver) => waiver.id))
  const invalidWaiverId = waiverIds.find(
    (waiverId) => !validWaiverIds.has(waiverId),
  )
  if (invalidWaiverId) {
    throw new Error("One or more volunteer waiver agreements are invalid")
  }
}

async function syncVolunteerAnswers(
  db: DbClient,
  invitationId: string,
  answers: Array<{ questionId: string; answer: string }>,
  timestamp: Date,
) {
  const cleanedAnswers = answers
    .map((answer) => ({
      questionId: answer.questionId,
      answer: answer.answer.trim(),
    }))
    .filter((answer) => answer.answer.length > 0)

  if (cleanedAnswers.length === 0) {
    await db
      .delete(volunteerRegistrationAnswersTable)
      .where(eq(volunteerRegistrationAnswersTable.invitationId, invitationId))
    return
  }

  await db.delete(volunteerRegistrationAnswersTable).where(
    and(
      eq(volunteerRegistrationAnswersTable.invitationId, invitationId),
      notInArray(
        volunteerRegistrationAnswersTable.questionId,
        cleanedAnswers.map((answer) => answer.questionId),
      ),
    ),
  )

  for (const answer of cleanedAnswers) {
    await db
      .insert(volunteerRegistrationAnswersTable)
      .values({
        ...answer,
        invitationId,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .onDuplicateKeyUpdate({
        set: {
          answer: answer.answer,
          updatedAt: timestamp,
        },
      })
  }
}

async function withVolunteerSignupLock<T>(
  db: DbClient,
  competitionTeamId: string,
  email: string,
  callback: () => Promise<T>,
) {
  let acquired = false
  const lockName = await createVolunteerSignupLockName(competitionTeamId, email)

  try {
    const result = await db.execute(
      sql`SELECT GET_LOCK(${lockName}, 5) FROM dual`,
    )
    acquired = Number(getFirstExecuteValue(result) ?? 0) === 1
    if (!acquired) {
      throw new Error("Volunteer application could not be saved")
    }

    return await callback()
  } finally {
    if (acquired) {
      await db.execute(sql`SELECT RELEASE_LOCK(${lockName}) FROM dual`)
    }
  }
}

async function createVolunteerSignupLockName(
  competitionTeamId: string,
  email: string,
) {
  const encoded = new TextEncoder().encode(
    `crew-volunteer:${competitionTeamId}:${email}`,
  )
  const digest = await crypto.subtle.digest("SHA-256", encoded)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")
}

function parseQuestionOptions(options: string | null): string[] | null {
  if (!options) return null
  try {
    const parsed = JSON.parse(options)
    return Array.isArray(parsed) ? parsed.filter(isString) : null
  } catch {
    return null
  }
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}
