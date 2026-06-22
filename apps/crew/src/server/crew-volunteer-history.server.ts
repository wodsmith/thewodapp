// @lat: [[crew#Strategic Moat Privacy Model]]
import { and, eq, isNull, or } from "drizzle-orm"
import type { getDb } from "../db"
import {
  createCrewVolunteerHistoryEventId,
  createCrewVolunteerIdentityId,
} from "../db/schemas/common"
import {
  CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE,
  CREW_VOLUNTEER_IDENTITY_SOURCE,
  crewVolunteerHistoryEventsTable,
  crewVolunteerIdentitiesTable,
  type CrewVolunteerHistoryAssignmentType,
  type CrewVolunteerHistoryEventType,
  type CrewVolunteerIdentitySource,
} from "../db/schemas/crew-volunteer-intelligence"
import type { VolunteerRoleType } from "../db/schemas/volunteers"

type DbClient = ReturnType<typeof getDb>

export const CREW_VOLUNTEER_CONTACT_HASH_VERSION = "v1"
const CONTACT_HASH_PREFIX = "sha256:"

export interface CrewVolunteerIdentityAnchorInput {
  userId?: string | null
  email?: string | null
  phone?: string | null
}

export interface CrewVolunteerIdentityAnchors {
  userId: string | null
  emailHash: string | null
  phoneHash: string | null
  contactHashVersion: typeof CREW_VOLUNTEER_CONTACT_HASH_VERSION
}

interface ResolveCrewVolunteerIdentityInput
  extends CrewVolunteerIdentityAnchorInput {
  db: DbClient
  teamId: string
  sourceCompetitionId?: string | null
  sourceMembershipId?: string | null
  sourceInvitationId?: string | null
  identitySource: CrewVolunteerIdentitySource
  now?: Date
}

export interface RecordCrewVolunteerHistoryEventInput {
  db: DbClient
  teamId: string
  competitionId: string
  groupId?: string | null
  eventType: CrewVolunteerHistoryEventType
  identity: CrewVolunteerIdentityAnchorInput & {
    sourceMembershipId?: string | null
    sourceInvitationId?: string | null
    identitySource: CrewVolunteerIdentitySource
  }
  assignmentType?: CrewVolunteerHistoryAssignmentType | null
  assignmentId?: string | null
  roleType?: VolunteerRoleType | null
  occurredAt?: Date
  sourceType: string
  sourceId: string
  sourceUserId?: string | null
  consentId?: string | null
  correctionOfEventId?: string | null
}

export interface CrewVolunteerHistoryEventInsert {
  id: string
  identityId: string
  teamId: string
  competitionId: string
  groupId: string | null
  eventType: CrewVolunteerHistoryEventType
  visibilityScope: typeof CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER
  assignmentType: CrewVolunteerHistoryAssignmentType | null
  assignmentId: string | null
  roleType: VolunteerRoleType | null
  occurredAt: Date
  sourceType: string
  sourceId: string
  sourceUserId: string | null
  consentId: string | null
  correctionOfEventId: string | null
  createdAt: Date
  updatedAt: Date
}

export async function recordCrewVolunteerHistoryEvent(
  input: RecordCrewVolunteerHistoryEventInput,
): Promise<{ id: string; action: "created" | "existing" }> {
  const occurredAt = input.occurredAt ?? new Date()
  const identityId = await resolveCrewVolunteerIdentity({
    db: input.db,
    teamId: input.teamId,
    userId: input.identity.userId,
    email: input.identity.email,
    phone: input.identity.phone,
    sourceCompetitionId: input.competitionId,
    sourceMembershipId: input.identity.sourceMembershipId,
    sourceInvitationId: input.identity.sourceInvitationId,
    identitySource: input.identity.identitySource,
    now: occurredAt,
  })

  const [existing] = await input.db
    .select({ id: crewVolunteerHistoryEventsTable.id })
    .from(crewVolunteerHistoryEventsTable)
    .where(
      and(
        eq(crewVolunteerHistoryEventsTable.identityId, identityId),
        eq(crewVolunteerHistoryEventsTable.teamId, input.teamId),
        eq(crewVolunteerHistoryEventsTable.competitionId, input.competitionId),
        eq(crewVolunteerHistoryEventsTable.eventType, input.eventType),
        eq(crewVolunteerHistoryEventsTable.sourceType, input.sourceType),
        eq(crewVolunteerHistoryEventsTable.sourceId, input.sourceId),
        input.assignmentType
          ? eq(
              crewVolunteerHistoryEventsTable.assignmentType,
              input.assignmentType,
            )
          : isNull(crewVolunteerHistoryEventsTable.assignmentType),
        input.assignmentId
          ? eq(crewVolunteerHistoryEventsTable.assignmentId, input.assignmentId)
          : isNull(crewVolunteerHistoryEventsTable.assignmentId),
      ),
    )
    .limit(1)

  if (existing) {
    return { id: existing.id, action: "existing" }
  }

  const event = buildCrewVolunteerHistoryEventInsert({
    ...input,
    identityId,
    occurredAt,
  })

  await input.db.insert(crewVolunteerHistoryEventsTable).values(event)
  return { id: event.id, action: "created" }
}

export async function resolveCrewVolunteerIdentity(
  input: ResolveCrewVolunteerIdentityInput,
): Promise<string> {
  const anchors = await buildCrewVolunteerIdentityAnchors(input)
  assertCrewVolunteerIdentityHasAnchor(anchors)

  const existing = await findCrewVolunteerIdentity(
    input.db,
    input.teamId,
    anchors,
  )
  if (existing) {
    return existing.id
  }

  const identity = buildCrewVolunteerIdentityInsert({
    teamId: input.teamId,
    anchors,
    sourceCompetitionId: input.sourceCompetitionId ?? null,
    sourceMembershipId: input.sourceMembershipId ?? null,
    sourceInvitationId: input.sourceInvitationId ?? null,
    identitySource: input.identitySource,
    now: input.now ?? new Date(),
  })

  try {
    await input.db.insert(crewVolunteerIdentitiesTable).values(identity)
    return identity.id
  } catch (error) {
    if (!isDuplicateEntryError(error)) {
      throw error
    }
    const racedExisting = await findCrewVolunteerIdentity(
      input.db,
      input.teamId,
      anchors,
    )
    if (racedExisting) return racedExisting.id
    throw error
  }
}

export async function buildCrewVolunteerIdentityAnchors(
  input: CrewVolunteerIdentityAnchorInput,
): Promise<CrewVolunteerIdentityAnchors> {
  return {
    userId: normalizeNullableText(input.userId),
    emailHash: await hashCrewVolunteerContactAnchor("email", input.email),
    phoneHash: await hashCrewVolunteerContactAnchor("phone", input.phone),
    contactHashVersion: CREW_VOLUNTEER_CONTACT_HASH_VERSION,
  }
}

export function assertCrewVolunteerIdentityHasAnchor(
  anchors: Pick<
    CrewVolunteerIdentityAnchors,
    "userId" | "emailHash" | "phoneHash"
  >,
) {
  if (anchors.userId || anchors.emailHash || anchors.phoneHash) return
  throw new Error(
    "Crew volunteer identity requires a user, email hash, or phone hash anchor.",
  )
}

export async function hashCrewVolunteerContactAnchor(
  type: "email" | "phone",
  value: string | null | undefined,
) {
  const normalized =
    type === "email"
      ? normalizeCrewVolunteerHistoryEmail(value)
      : normalizeCrewVolunteerHistoryPhone(value)
  if (!normalized) return null

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      `${CREW_VOLUNTEER_CONTACT_HASH_VERSION}:${type}:${normalized}`,
    ),
  )
  return `${CONTACT_HASH_PREFIX}${bytesToHex(new Uint8Array(digest))}`
}

export function normalizeCrewVolunteerHistoryEmail(
  value: string | null | undefined,
) {
  const trimmed = value?.trim().toLowerCase()
  return trimmed || null
}

export function normalizeCrewVolunteerHistoryPhone(
  value: string | null | undefined,
) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const hasPlus = trimmed.startsWith("+")
  const digits = trimmed.replace(/\D/g, "")
  if (!digits) return null
  return hasPlus ? `+${digits}` : digits
}

export function buildCrewVolunteerHistoryDedupeKey(input: {
  teamId: string
  competitionId: string
  identityId: string
  eventType: CrewVolunteerHistoryEventType
  sourceType: string
  sourceId: string
  assignmentType?: CrewVolunteerHistoryAssignmentType | null
  assignmentId?: string | null
}) {
  return [
    input.teamId,
    input.competitionId,
    input.identityId,
    input.eventType,
    input.sourceType,
    input.sourceId,
    input.assignmentType ?? "",
    input.assignmentId ?? "",
  ].join("|")
}

export function buildCrewVolunteerHistoryEventInsert(
  input: Omit<RecordCrewVolunteerHistoryEventInput, "db" | "identity"> & {
    identityId: string
    occurredAt: Date
  },
): CrewVolunteerHistoryEventInsert {
  const now = input.occurredAt
  return {
    id: createCrewVolunteerHistoryEventId(),
    identityId: input.identityId,
    teamId: input.teamId,
    competitionId: input.competitionId,
    groupId: input.groupId ?? null,
    eventType: input.eventType,
    visibilityScope: CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER,
    assignmentType: input.assignmentType ?? null,
    assignmentId: input.assignmentId ?? null,
    roleType: input.roleType ?? null,
    occurredAt: input.occurredAt,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceUserId: input.sourceUserId ?? null,
    consentId: input.consentId ?? null,
    correctionOfEventId: input.correctionOfEventId ?? null,
    createdAt: now,
    updatedAt: now,
  }
}

export function buildCrewVolunteerIdentityInsert(input: {
  teamId: string
  anchors: CrewVolunteerIdentityAnchors
  sourceCompetitionId: string | null
  sourceMembershipId: string | null
  sourceInvitationId: string | null
  identitySource: CrewVolunteerIdentitySource
  now: Date
}) {
  assertCrewVolunteerIdentityHasAnchor(input.anchors)
  return {
    id: createCrewVolunteerIdentityId(),
    teamId: input.teamId,
    userId: input.anchors.userId,
    emailHash: input.anchors.emailHash,
    phoneHash: input.anchors.phoneHash,
    contactHashVersion: input.anchors.contactHashVersion,
    sourceCompetitionId: input.sourceCompetitionId,
    sourceMembershipId: input.sourceMembershipId,
    sourceInvitationId: input.sourceInvitationId,
    identitySource: input.identitySource,
    createdAt: input.now,
    updatedAt: input.now,
  }
}

async function findCrewVolunteerIdentity(
  db: DbClient,
  teamId: string,
  anchors: CrewVolunteerIdentityAnchors,
) {
  const anchorConditions = [
    anchors.userId
      ? eq(crewVolunteerIdentitiesTable.userId, anchors.userId)
      : null,
    anchors.emailHash
      ? and(
          eq(crewVolunteerIdentitiesTable.emailHash, anchors.emailHash),
          eq(
            crewVolunteerIdentitiesTable.contactHashVersion,
            anchors.contactHashVersion,
          ),
        )
      : null,
    anchors.phoneHash
      ? and(
          eq(crewVolunteerIdentitiesTable.phoneHash, anchors.phoneHash),
          eq(
            crewVolunteerIdentitiesTable.contactHashVersion,
            anchors.contactHashVersion,
          ),
        )
      : null,
  ].filter((condition): condition is NonNullable<typeof condition> =>
    Boolean(condition),
  )

  assertCrewVolunteerIdentityHasAnchor(anchors)

  const [existing] = await db
    .select({ id: crewVolunteerIdentitiesTable.id })
    .from(crewVolunteerIdentitiesTable)
    .where(
      and(
        eq(crewVolunteerIdentitiesTable.teamId, teamId),
        anchorConditions.length === 1
          ? anchorConditions[0]
          : or(...anchorConditions),
      ),
    )
    .limit(1)

  return existing ?? null
}

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed || null
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  )
}

function isDuplicateEntryError(error: unknown) {
  const maybe = error as { code?: unknown; errno?: unknown; message?: unknown }
  return (
    maybe.code === "ER_DUP_ENTRY" ||
    maybe.errno === 1062 ||
    (typeof maybe.message === "string" &&
      maybe.message.toLowerCase().includes("duplicate"))
  )
}

export { CREW_VOLUNTEER_IDENTITY_SOURCE }
