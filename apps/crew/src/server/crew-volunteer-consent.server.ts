import { and, desc, eq, ne, or } from "drizzle-orm"
import { getDb } from "../db"
import { competitionsTable } from "../db/schemas/competitions"
import { createCrewVolunteerConsentId } from "../db/schemas/common"
import {
  CREW_ASSIGNMENT_CONFIRMATION_STATUS,
  CREW_ASSIGNMENT_CONFIRMATION_TYPE,
  crewAssignmentConfirmationsTable,
} from "../db/schemas/crew-imports"
import {
  CREW_EVENT_LIFECYCLE,
  crewEventSettingsTable,
} from "../db/schemas/crew-event-settings"
import {
  CREW_VOLUNTEER_CONSENT_SOURCE,
  CREW_VOLUNTEER_CONSENT_STATUS,
  CREW_VOLUNTEER_DISCOVERY_AGE_STATUS,
  CREW_VOLUNTEER_IDENTITY_SOURCE,
  crewVolunteerConsentsTable,
  crewVolunteerIdentitiesTable,
  type CrewVolunteerConsentScope,
} from "../db/schemas/crew-volunteer-intelligence"
import {
  SYSTEM_ROLES_ENUM,
  teamInvitationTable,
  teamMembershipTable,
} from "../db/schemas/teams"
import { userTable } from "../db/schemas/users"
import { volunteerShiftAssignmentsTable } from "../db/schemas/volunteers"
import {
  getCrewAssignmentConfirmationTokenState,
  hashCrewAssignmentConfirmationToken,
} from "../lib/crew/assignment-confirmations"
import { parseCrewRosterMetadata } from "../lib/crew/roster-shifts"
import {
  CREW_VOLUNTEER_CONSENT_CENTER_SURFACE,
  CREW_VOLUNTEER_CONSENT_CENTER_VERSION,
  buildCrewVolunteerConsentCenterView,
  getCrewVolunteerConsentText,
  hashCrewVolunteerConsentText,
  resolveCrewVolunteerConsentMutation,
  type CrewVolunteerConsentCenterAction,
  type CrewVolunteerConsentCenterScope,
  type CrewVolunteerConsentCenterView,
} from "../lib/crew/volunteer-consent-center"
import {
  getCrewVolunteerTokenState,
  type CrewVolunteerSignupMetadata,
} from "../lib/crew/volunteer-signup"
import {
  buildCrewVolunteerIdentityAnchors,
  resolveCrewVolunteerIdentity,
  type CrewVolunteerIdentityAnchorInput,
  type CrewVolunteerIdentityAnchors,
} from "./crew-volunteer-history.server"

type DbClient = ReturnType<typeof getDb>

export interface CrewVolunteerConsentCenterTokenInput {
  slug: string
  token: string
}

export interface UpdateCrewVolunteerConsentCenterTokenInput
  extends CrewVolunteerConsentCenterTokenInput {
  scope: CrewVolunteerConsentCenterScope
  action: CrewVolunteerConsentCenterAction
}

export type CrewVolunteerConsentCenterTokenData =
  | {
      status: "valid"
      view: CrewVolunteerConsentCenterView
    }
  | {
      status: "missing" | "expired" | "bad"
      view: null
    }

export type UpdateCrewVolunteerConsentCenterTokenResult =
  CrewVolunteerConsentCenterTokenData & {
    success: boolean
    outcome:
      | "granted"
      | "revoked"
      | "idempotent"
      | "missing"
      | "expired"
      | "bad"
      | "blocked"
    message: string
  }

interface CrewVolunteerConsentTokenContext {
  event: {
    id: string
    name: string
    organizingTeamId: string
    groupId: string | null
  }
  identitySource: typeof CREW_VOLUNTEER_IDENTITY_SOURCE.SELF_SERVICE
  anchors: CrewVolunteerIdentityAnchorInput
  sourceCompetitionId: string
  sourceMembershipId: string | null
  sourceInvitationId: string | null
}

export async function getCrewVolunteerConsentCenterToken(
  data: CrewVolunteerConsentCenterTokenInput,
): Promise<CrewVolunteerConsentCenterTokenData> {
  const db = getDb()
  const resolved = await resolveCrewVolunteerConsentToken(db, data)
  if (resolved.status !== "valid") {
    return { status: resolved.status, view: null }
  }

  const anchors = await buildCrewVolunteerIdentityAnchors(
    resolved.context.anchors,
  )
  const identity = await findCrewVolunteerIdentityByAnchors(
    db,
    resolved.context.event.organizingTeamId,
    anchors,
  )
  const consentRecords = identity
    ? await listCrewVolunteerConsentCenterRecords(db, identity.id)
    : []

  return {
    status: "valid",
    view: buildCrewVolunteerConsentCenterView({
      eventName: resolved.context.event.name,
      volunteerLabel: "Your crew profile",
      identityAgeStatus:
        identity?.discoveryAgeStatus ??
        CREW_VOLUNTEER_DISCOVERY_AGE_STATUS.UNKNOWN,
      consentRecords,
    }),
  }
}

export async function updateCrewVolunteerConsentCenterToken(
  data: UpdateCrewVolunteerConsentCenterTokenInput,
): Promise<UpdateCrewVolunteerConsentCenterTokenResult> {
  const db = getDb()
  const now = new Date()
  const resolved = await resolveCrewVolunteerConsentToken(db, data)
  if (resolved.status !== "valid") {
    return {
      status: resolved.status,
      view: null,
      success: false,
      outcome: resolved.status,
      message: messageForInvalidTokenStatus(resolved.status),
    }
  }

  let mutationOutcome: UpdateCrewVolunteerConsentCenterTokenResult["outcome"] =
    "idempotent"
  let mutationMessage = "Your consent settings were already up to date."
  let mutationSucceeded = true

  await db.transaction(async (tx) => {
    const client = tx as unknown as DbClient
    const context = resolved.context
    const anchors = await buildCrewVolunteerIdentityAnchors(context.anchors)
    const existingIdentity = await findCrewVolunteerIdentityByAnchors(
      client,
      context.event.organizingTeamId,
      anchors,
    )
    const identityAgeStatus =
      existingIdentity?.discoveryAgeStatus ??
      CREW_VOLUNTEER_DISCOVERY_AGE_STATUS.UNKNOWN
    const activeConsent = existingIdentity
      ? await getActiveCrewVolunteerConsent(
          client,
          existingIdentity.id,
          data.scope,
        )
      : null
    const resolution = resolveCrewVolunteerConsentMutation({
      action: data.action,
      scope: data.scope,
      identityAgeStatus,
      activeConsentId: activeConsent?.id ?? null,
    })

    if (!resolution.ok) {
      mutationOutcome = "blocked"
      mutationSucceeded = false
      mutationMessage =
        resolution.reason === "regional_age_blocked"
          ? "Regional discovery requires adult eligibility before opt-in."
          : "That consent scope is not available here."
      return
    }

    if (resolution.outcome === "idempotent") {
      mutationOutcome = "idempotent"
      mutationMessage =
        data.action === "grant"
          ? "That consent is already granted."
          : "That consent is already revoked."
      return
    }

    const identityId = await resolveCrewVolunteerIdentity({
      db: client,
      teamId: context.event.organizingTeamId,
      userId: context.anchors.userId,
      email: context.anchors.email,
      phone: context.anchors.phone,
      sourceCompetitionId: context.sourceCompetitionId,
      sourceMembershipId: context.sourceMembershipId,
      sourceInvitationId: context.sourceInvitationId,
      identitySource: context.identitySource,
      now,
    })

    const consentId = createCrewVolunteerConsentId()
    const consentText = getCrewVolunteerConsentText({
      scope: data.scope,
      action: data.action,
    })
    const consentTextHash = await hashCrewVolunteerConsentText(consentText)

    await client.insert(crewVolunteerConsentsTable).values({
      id: consentId,
      identityId,
      teamId: context.event.organizingTeamId,
      scope: data.scope,
      status:
        data.action === "grant"
          ? CREW_VOLUNTEER_CONSENT_STATUS.GRANTED
          : CREW_VOLUNTEER_CONSENT_STATUS.REVOKED,
      consentText,
      consentTextVersion: CREW_VOLUNTEER_CONSENT_CENTER_VERSION,
      consentTextHash,
      source: CREW_VOLUNTEER_CONSENT_SOURCE.CONSENT_CENTER,
      sourceSurface: CREW_VOLUNTEER_CONSENT_CENTER_SURFACE,
      sourceCompetitionId: context.event.id,
      actorUserId: context.anchors.userId ?? null,
      recordedByUserId: null,
      grantedAt: now,
      revokedAt: data.action === "revoke" ? now : null,
      revokedByUserId:
        data.action === "revoke" ? (context.anchors.userId ?? null) : null,
      revocationSource:
        data.action === "revoke" ? CREW_VOLUNTEER_CONSENT_CENTER_SURFACE : null,
      supersededByConsentId: null,
      createdAt: now,
      updatedAt: now,
    })

    if (data.action === "grant") {
      await supersedePriorGrantedConsents(client, {
        identityId,
        scope: data.scope,
        supersededByConsentId: consentId,
        now,
      })
      mutationOutcome = "granted"
      mutationMessage = "Consent granted."
      return
    }

    await revokePriorGrantedConsents(client, {
      identityId,
      scope: data.scope,
      supersededByConsentId: consentId,
      revokedByUserId: context.anchors.userId ?? null,
      now,
    })
    mutationOutcome = "revoked"
    mutationMessage = "Consent revoked."
  })

  const freshData = await getCrewVolunteerConsentCenterToken(data)
  return {
    ...freshData,
    success: mutationSucceeded,
    outcome: mutationOutcome,
    message: mutationMessage,
  }
}

async function resolveCrewVolunteerConsentToken(
  db: DbClient,
  data: CrewVolunteerConsentCenterTokenInput,
): Promise<
  | { status: "valid"; context: CrewVolunteerConsentTokenContext }
  | { status: "missing" | "expired" | "bad" }
> {
  const assignment = await resolveAssignmentConfirmationConsentToken(db, data)
  if (assignment.status !== "missing") return assignment
  return await resolveVolunteerInvitationConsentToken(db, data)
}

async function resolveAssignmentConfirmationConsentToken(
  db: DbClient,
  data: CrewVolunteerConsentCenterTokenInput,
) {
  const tokenHash = await hashCrewAssignmentConfirmationToken(data.token)
  const [row] = await db
    .select({
      event: {
        id: competitionsTable.id,
        name: competitionsTable.name,
        organizingTeamId: competitionsTable.organizingTeamId,
        groupId: competitionsTable.groupId,
      },
      confirmation: {
        id: crewAssignmentConfirmationsTable.id,
        tokenHash: crewAssignmentConfirmationsTable.tokenHash,
        status: crewAssignmentConfirmationsTable.status,
        expiresAt: crewAssignmentConfirmationsTable.expiresAt,
        email: crewAssignmentConfirmationsTable.email,
        membershipId: crewAssignmentConfirmationsTable.membershipId,
      },
      assignment: {
        membershipId: volunteerShiftAssignmentsTable.membershipId,
      },
      membership: {
        id: teamMembershipTable.id,
        userId: teamMembershipTable.userId,
        metadata: teamMembershipTable.metadata,
      },
      user: {
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
        eq(competitionsTable.slug, data.slug),
        eq(crewEventSettingsTable.crewOnly, true),
        ne(crewEventSettingsTable.lifecycle, CREW_EVENT_LIFECYCLE.ARCHIVED),
      ),
    )
    .limit(1)

  if (!row) return { status: "missing" as const }
  if (
    row.confirmation.status === CREW_ASSIGNMENT_CONFIRMATION_STATUS.CANCELLED
  ) {
    return { status: "bad" as const }
  }

  const tokenState = getCrewAssignmentConfirmationTokenState(row.confirmation)
  if (tokenState !== "valid") return { status: tokenState }

  const metadata = parseCrewRosterMetadata(row.membership?.metadata)
  const anchors = {
    userId: row.membership?.userId ?? null,
    email: metadata.signupEmail ?? row.confirmation.email ?? row.user?.email,
    phone: metadata.signupPhone,
  }

  if (!hasIdentityAnchor(anchors)) return { status: "bad" as const }

  return {
    status: "valid" as const,
    context: {
      event: row.event,
      identitySource: CREW_VOLUNTEER_IDENTITY_SOURCE.SELF_SERVICE,
      anchors,
      sourceCompetitionId: row.event.id,
      sourceMembershipId:
        row.assignment?.membershipId ?? row.confirmation.membershipId ?? null,
      sourceInvitationId: null,
    },
  }
}

async function resolveVolunteerInvitationConsentToken(
  db: DbClient,
  data: CrewVolunteerConsentCenterTokenInput,
) {
  const [row] = await db
    .select({
      event: {
        id: competitionsTable.id,
        name: competitionsTable.name,
        organizingTeamId: competitionsTable.organizingTeamId,
        groupId: competitionsTable.groupId,
      },
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

  if (!row) return { status: "missing" as const }

  const tokenState = getCrewVolunteerTokenState(row.invitation)
  if (tokenState !== "valid") return { status: tokenState }

  const metadata = parseVolunteerMetadata(row.invitation.metadata)
  const anchors = {
    userId: null,
    email: metadata?.signupEmail ?? row.invitation.email,
    phone: metadata?.signupPhone,
  }

  if (!hasIdentityAnchor(anchors)) return { status: "bad" as const }

  return {
    status: "valid" as const,
    context: {
      event: row.event,
      identitySource: CREW_VOLUNTEER_IDENTITY_SOURCE.SELF_SERVICE,
      anchors,
      sourceCompetitionId: row.event.id,
      sourceMembershipId: null,
      sourceInvitationId: row.invitation.id,
    },
  }
}

async function listCrewVolunteerConsentCenterRecords(
  db: DbClient,
  identityId: string,
) {
  return await db
    .select({
      id: crewVolunteerConsentsTable.id,
      scope: crewVolunteerConsentsTable.scope,
      status: crewVolunteerConsentsTable.status,
      consentTextVersion: crewVolunteerConsentsTable.consentTextVersion,
      source: crewVolunteerConsentsTable.source,
      sourceSurface: crewVolunteerConsentsTable.sourceSurface,
      grantedAt: crewVolunteerConsentsTable.grantedAt,
      revokedAt: crewVolunteerConsentsTable.revokedAt,
      supersededByConsentId: crewVolunteerConsentsTable.supersededByConsentId,
      updatedAt: crewVolunteerConsentsTable.updatedAt,
    })
    .from(crewVolunteerConsentsTable)
    .where(eq(crewVolunteerConsentsTable.identityId, identityId))
    .orderBy(desc(crewVolunteerConsentsTable.updatedAt))
}

async function getActiveCrewVolunteerConsent(
  db: DbClient,
  identityId: string,
  scope: CrewVolunteerConsentScope,
) {
  const [consent] = await db
    .select({ id: crewVolunteerConsentsTable.id })
    .from(crewVolunteerConsentsTable)
    .where(
      and(
        eq(crewVolunteerConsentsTable.identityId, identityId),
        eq(crewVolunteerConsentsTable.scope, scope),
        eq(
          crewVolunteerConsentsTable.status,
          CREW_VOLUNTEER_CONSENT_STATUS.GRANTED,
        ),
      ),
    )
    .orderBy(desc(crewVolunteerConsentsTable.updatedAt))
    .limit(1)

  return consent ?? null
}

async function supersedePriorGrantedConsents(
  db: DbClient,
  params: {
    identityId: string
    scope: CrewVolunteerConsentScope
    supersededByConsentId: string
    now: Date
  },
) {
  await db
    .update(crewVolunteerConsentsTable)
    .set({
      status: CREW_VOLUNTEER_CONSENT_STATUS.SUPERSEDED,
      supersededByConsentId: params.supersededByConsentId,
      updatedAt: params.now,
    })
    .where(
      and(
        eq(crewVolunteerConsentsTable.identityId, params.identityId),
        eq(crewVolunteerConsentsTable.scope, params.scope),
        eq(
          crewVolunteerConsentsTable.status,
          CREW_VOLUNTEER_CONSENT_STATUS.GRANTED,
        ),
        ne(crewVolunteerConsentsTable.id, params.supersededByConsentId),
      ),
    )
}

async function revokePriorGrantedConsents(
  db: DbClient,
  params: {
    identityId: string
    scope: CrewVolunteerConsentScope
    supersededByConsentId: string
    revokedByUserId: string | null
    now: Date
  },
) {
  await db
    .update(crewVolunteerConsentsTable)
    .set({
      status: CREW_VOLUNTEER_CONSENT_STATUS.REVOKED,
      revokedAt: params.now,
      revokedByUserId: params.revokedByUserId,
      revocationSource: CREW_VOLUNTEER_CONSENT_CENTER_SURFACE,
      supersededByConsentId: params.supersededByConsentId,
      updatedAt: params.now,
    })
    .where(
      and(
        eq(crewVolunteerConsentsTable.identityId, params.identityId),
        eq(crewVolunteerConsentsTable.scope, params.scope),
        eq(
          crewVolunteerConsentsTable.status,
          CREW_VOLUNTEER_CONSENT_STATUS.GRANTED,
        ),
      ),
    )
}

async function findCrewVolunteerIdentityByAnchors(
  db: DbClient,
  teamId: string,
  anchors: CrewVolunteerIdentityAnchors,
) {
  const conditions = [
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

  if (conditions.length === 0) return null

  const [identity] = await db
    .select({
      id: crewVolunteerIdentitiesTable.id,
      discoveryAgeStatus: crewVolunteerIdentitiesTable.discoveryAgeStatus,
    })
    .from(crewVolunteerIdentitiesTable)
    .where(
      and(
        eq(crewVolunteerIdentitiesTable.teamId, teamId),
        conditions.length === 1 ? conditions[0] : or(...conditions),
      ),
    )
    .limit(1)

  return identity ?? null
}

function hasIdentityAnchor(anchors: CrewVolunteerIdentityAnchorInput) {
  return Boolean(
    anchors.userId?.trim() || anchors.email?.trim() || anchors.phone?.trim(),
  )
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

function messageForInvalidTokenStatus(status: "missing" | "expired" | "bad") {
  if (status === "missing") return "Consent center link was not found."
  if (status === "expired") return "Consent center link has expired."
  return "Consent center link is no longer valid."
}
