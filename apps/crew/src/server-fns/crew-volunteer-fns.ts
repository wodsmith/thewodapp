// @lat: [[crew#Import Apply#Confirmed Mutation]]
import { createId } from "@paralleldrive/cuid2"
import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq, ne, notInArray, sql } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "../db"
import {
  competitionRegistrationQuestionsTable,
  competitionsTable,
  volunteerRegistrationAnswersTable,
} from "../db/schemas/competitions"
import { createTeamInvitationId } from "../db/schemas/common"
import {
  CREW_EVENT_LIFECYCLE,
  crewEventSettingsTable,
} from "../db/schemas/crew-event-settings"
import {
  INVITATION_STATUS,
  SYSTEM_ROLES_ENUM,
  teamInvitationTable,
  teamMembershipTable,
} from "../db/schemas/teams"
import { userTable } from "../db/schemas/users"
import { waiversTable } from "../db/schemas/waivers"
import type { VolunteerAvailability } from "../db/schemas/volunteers"
import {
  buildCrewVolunteerSignupMetadata,
  crewVolunteerSignupInputSchema,
  getCrewVolunteerTokenState,
  isCrewVolunteerSignupSpam,
  mergeCrewVolunteerSignupMetadata,
  normalizeVolunteerSignupEmail,
  planCrewVolunteerSignup,
  validateCrewVolunteerSignupRequirements,
  type CrewVolunteerSignupMetadata,
} from "../lib/crew/volunteer-signup"
import type { QuestionType } from "./registration-questions-fns"

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
  volunteer: {
    email: string
    name: string | null
    phone: string | null
    availability: VolunteerAvailability | null
    availabilityNotes: string | null
    credentials: string | null
    roleTypes: CrewVolunteerSignupMetadata["volunteerRoleTypes"]
    invitationStatus: string
  } | null
}

const getCrewVolunteerSignupPageInputSchema = z.object({
  slug: z.string().trim().min(1, "Event slug is required").max(255),
})

const getCrewVolunteerScheduleTokenInputSchema = z.object({
  slug: z.string().trim().min(1, "Event slug is required").max(255),
  token: z.string().trim().min(1, "Token is required").max(255),
})

export const getCrewVolunteerSignupPageFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getCrewVolunteerSignupPageInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<CrewVolunteerSignupPageData> => {
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
  })

export const submitCrewVolunteerSignupFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => crewVolunteerSignupInputSchema.parse(data))
  .handler(async ({ data }) => {
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
        },
      )
    })

    return {
      success: true,
      applicationId: invitationId,
      action,
    }
  })

export const getCrewVolunteerScheduleTokenFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    getCrewVolunteerScheduleTokenInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<CrewVolunteerScheduleTokenData> => {
    const db = getDb()
    const [row] = await db
      .select({
        event: publicCrewEventSelect,
        invitation: {
          id: teamInvitationTable.id,
          email: teamInvitationTable.email,
          token: teamInvitationTable.token,
          status: teamInvitationTable.status,
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

    if (!row) {
      return { status: "missing", event: null, volunteer: null }
    }

    const status = getCrewVolunteerTokenState(row.invitation)
    if (status !== "valid") {
      return { status, event: null, volunteer: null }
    }

    const metadata = parseVolunteerMetadata(row.invitation.metadata)

    return {
      status,
      event: toPublicCrewVolunteerEvent(row.event),
      volunteer: {
        email: row.invitation.email,
        name: metadata?.signupName ?? null,
        phone: metadata?.signupPhone ?? null,
        availability: metadata?.availability ?? null,
        availabilityNotes: metadata?.availabilityNotes ?? null,
        credentials: metadata?.credentials ?? null,
        roleTypes: metadata?.volunteerRoleTypes ?? [],
        invitationStatus: row.invitation.status,
      },
    }
  })

const publicCrewEventSelect = {
  id: competitionsTable.id,
  slug: competitionsTable.slug,
  name: competitionsTable.name,
  description: competitionsTable.description,
  startDate: competitionsTable.startDate,
  endDate: competitionsTable.endDate,
  timezone: competitionsTable.timezone,
  competitionTeamId: competitionsTable.competitionTeamId,
  groupId: competitionsTable.groupId,
}

type InternalPublicCrewEvent = PublicCrewVolunteerEvent & {
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

function getExecuteRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    if (Array.isArray(result[0])) return result[0] as T[]
    return result as T[]
  }

  return ((result as { rows?: T[] })?.rows ?? []) as T[]
}

function getFirstExecuteValue(result: unknown): unknown {
  const [row] = getExecuteRows<unknown>(result)
  if (Array.isArray(row)) return row[0]
  if (row && typeof row === "object") return Object.values(row)[0]
  return row
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

function parseVolunteerMetadata(
  metadata: string | null,
): CrewVolunteerSignupMetadata | null {
  if (!metadata) return null
  try {
    return JSON.parse(metadata) as CrewVolunteerSignupMetadata
  } catch {
    return null
  }
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}
