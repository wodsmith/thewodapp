/**
 * Competition invite issue helpers (Phase 2).
 *
 * DB-side-only layer that writes `competition_invites` rows for new sends
 * and rotates tokens on re-send. Does NOT render email, does NOT enqueue
 * — those belong to `competition-invite-fns.issueInvitesFn` (2.13) so the
 * email queue consumer is the only path that calls Resend.
 *
 * Two primary helpers:
 * - {@link issueInvitesForRecipients} — insert new pending invite rows for
 *   source-derived and fresh bespoke recipients. Returns the inserted rows
 *   together with their *plaintext* claim tokens (the only place the
 *   plaintext exists). Conflicts against an already-active invite surface
 *   as `alreadyActive` with the existing invite id so the caller can
 *   decide to reissue.
 * - {@link reissueInvite} — rotate token + last4, bump `sendAttempt`,
 *   bump `expiresAt`, restore `activeMarker = "active"`, and flip
 *   `expired`/draft-no-token rows back to `pending`. Covers both
 *   extend-expired-invite and activate-draft-bespoke paths.
 *
 * Both paths reject at the target division's registration fee of $0 —
 * free competitions are not eligible for invites in the MVP (ADR-0011
 * "Capacity Math" → "Free competitions").
 */
// @lat: [[competition-invites#Issue helpers]]

import { and, eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import { createCompetitionInviteId } from "@/db/schemas/common"
import {
  COMPETITION_INVITE_ACTIVE_MARKER,
  COMPETITION_INVITE_EMAIL_DELIVERY_STATUS,
  COMPETITION_INVITE_ORIGIN,
  COMPETITION_INVITE_STATUS,
  type CompetitionInvite,
  type CompetitionInviteOrigin,
  competitionInvitesTable,
} from "@/db/schemas/competition-invites"
import { generateInviteClaimToken } from "@/lib/competition-invites/tokens"
import { getRegistrationFee } from "@/server/commerce/fee-calculator"

// ============================================================================
// Types
// ============================================================================

export interface IssueInviteRecipient {
  email: string
  origin: CompetitionInviteOrigin
  sourceId?: string | null
  sourceCompetitionId?: string | null
  sourcePlacement?: number | null
  sourcePlacementLabel?: string | null
  bespokeReason?: string | null
  inviteeFirstName?: string | null
  inviteeLastName?: string | null
  userId?: string | null
}

export interface IssueInvitesInput {
  championshipCompetitionId: string
  championshipDivisionId: string
  rsvpDeadlineAt: Date
  /** Phase 2: empty-string sentinel; Phase 3 replaces with a real round id. */
  roundId?: string
  recipients: IssueInviteRecipient[]
}

export interface IssuedInvite {
  invite: CompetitionInvite
  /** Plaintext claim token. Put this only in an outgoing email. */
  plaintextToken: string
}

export interface AlreadyActiveInvite {
  email: string
  existingInviteId: string
  /** True when the existing row has no token yet (a draft bespoke invite). */
  isDraft: boolean
}

export interface IssueInvitesResult {
  inserted: IssuedInvite[]
  alreadyActive: AlreadyActiveInvite[]
}

export class InviteIssueValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InviteIssueValidationError"
  }
}

export class FreeCompetitionNotEligibleError extends Error {
  constructor(params: { competitionId: string; divisionId: string }) {
    super(
      `Invites are not supported for free divisions. Competition ${params.competitionId} division ${params.divisionId} has a $0 registration fee.`,
    )
    this.name = "FreeCompetitionNotEligibleError"
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Lowercase + trim. The invite is locked to this exact value and every
 * downstream lookup (claim resolution, identity match, roster join) uses
 * the same normalization.
 */
export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function assertRecipientOriginValid(r: IssueInviteRecipient): void {
  if (r.origin === COMPETITION_INVITE_ORIGIN.SOURCE) {
    if (!r.sourceId) {
      throw new InviteIssueValidationError(
        `Source recipient ${r.email} is missing sourceId`,
      )
    }
    if (!r.sourceCompetitionId) {
      throw new InviteIssueValidationError(
        `Source recipient ${r.email} is missing sourceCompetitionId`,
      )
    }
  } else {
    if (r.sourceId || r.sourceCompetitionId || r.sourcePlacement) {
      throw new InviteIssueValidationError(
        `Bespoke recipient ${r.email} must not carry source attribution`,
      )
    }
  }
}

async function assertDivisionIsPaid(params: {
  competitionId: string
  divisionId: string
}): Promise<void> {
  const fee = await getRegistrationFee(params.competitionId, params.divisionId)
  if (fee <= 0) {
    throw new FreeCompetitionNotEligibleError(params)
  }
}

// ============================================================================
// Issue (new inserts)
// ============================================================================

/**
 * Insert new pending invite rows for each recipient. Recipients whose
 * email already has an active invite for the target (championship, division)
 * are returned in `alreadyActive` with the existing invite's id — the caller
 * decides whether to reissue (bespoke drafts) or report it as a skip.
 *
 * Transactional: either all rows are inserted or none are, so a mid-batch
 * failure never leaves a half-sent round. Email normalization (lowercase +
 * trim) is applied per recipient before either the conflict lookup or the
 * insert.
 */
export async function issueInvitesForRecipients(
  input: IssueInvitesInput,
): Promise<IssueInvitesResult> {
  if (input.recipients.length === 0) {
    return { inserted: [], alreadyActive: [] }
  }

  await assertDivisionIsPaid({
    competitionId: input.championshipCompetitionId,
    divisionId: input.championshipDivisionId,
  })

  const normalized = input.recipients.map((r) => {
    assertRecipientOriginValid(r)
    return { ...r, email: normalizeInviteEmail(r.email) }
  })

  const emails = Array.from(new Set(normalized.map((r) => r.email)))
  const db = getDb()

  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(competitionInvitesTable)
      .where(
        and(
          eq(
            competitionInvitesTable.championshipCompetitionId,
            input.championshipCompetitionId,
          ),
          eq(
            competitionInvitesTable.championshipDivisionId,
            input.championshipDivisionId,
          ),
          eq(
            competitionInvitesTable.activeMarker,
            COMPETITION_INVITE_ACTIVE_MARKER,
          ),
          inArray(competitionInvitesTable.email, emails),
        ),
      )

    const existingByEmail = new Map(existing.map((e) => [e.email, e]))

    const alreadyActive: AlreadyActiveInvite[] = []
    const toInsertInputs: IssueInviteRecipient[] = []
    const seenEmails = new Set<string>()
    for (const r of normalized) {
      if (seenEmails.has(r.email)) continue
      seenEmails.add(r.email)
      const existingRow = existingByEmail.get(r.email)
      if (existingRow) {
        alreadyActive.push({
          email: r.email,
          existingInviteId: existingRow.id,
          isDraft: !existingRow.claimTokenHash,
        })
      } else {
        toInsertInputs.push(r)
      }
    }

    if (toInsertInputs.length === 0) {
      return { inserted: [], alreadyActive }
    }

    const inserted: IssuedInvite[] = []
    const rowsToInsert: CompetitionInvite[] = []
    for (const r of toInsertInputs) {
      const artifacts = await generateInviteClaimToken()
      const id = createCompetitionInviteId()
      const now = new Date()
      const row: CompetitionInvite = {
        id,
        championshipCompetitionId: input.championshipCompetitionId,
        roundId: input.roundId ?? "",
        origin: r.origin,
        sourceId: r.origin === COMPETITION_INVITE_ORIGIN.SOURCE
          ? r.sourceId ?? null
          : null,
        sourceCompetitionId:
          r.origin === COMPETITION_INVITE_ORIGIN.SOURCE
            ? r.sourceCompetitionId ?? null
            : null,
        sourcePlacement:
          r.origin === COMPETITION_INVITE_ORIGIN.SOURCE
            ? r.sourcePlacement ?? null
            : null,
        sourcePlacementLabel: r.sourcePlacementLabel ?? null,
        bespokeReason:
          r.origin === COMPETITION_INVITE_ORIGIN.BESPOKE
            ? r.bespokeReason ?? null
            : null,
        championshipDivisionId: input.championshipDivisionId,
        email: r.email,
        userId: r.userId ?? null,
        inviteeFirstName: r.inviteeFirstName ?? null,
        inviteeLastName: r.inviteeLastName ?? null,
        claimTokenHash: artifacts.hash,
        claimTokenLast4: artifacts.last4,
        expiresAt: input.rsvpDeadlineAt,
        sendAttempt: 0,
        status: COMPETITION_INVITE_STATUS.PENDING,
        paidAt: null,
        declinedAt: null,
        revokedAt: null,
        revokedByUserId: null,
        claimedRegistrationId: null,
        emailDeliveryStatus: COMPETITION_INVITE_EMAIL_DELIVERY_STATUS.QUEUED,
        emailLastError: null,
        activeMarker: COMPETITION_INVITE_ACTIVE_MARKER,
        createdAt: now,
        updatedAt: now,
        updateCounter: 0,
      }
      rowsToInsert.push(row)
      inserted.push({ invite: row, plaintextToken: artifacts.token })
    }

    await tx.insert(competitionInvitesTable).values(rowsToInsert)

    return { inserted, alreadyActive }
  })
}

// ============================================================================
// Reissue (rotate token on existing row)
// ============================================================================

export interface ReissueInviteInput {
  inviteId: string
  newExpiresAt: Date
  /**
   * Phase 2 optionally updates the invite's roundId (implicit round-label
   * metadata). Phase 3 will make this a real round FK.
   */
  roundId?: string
}

/**
 * Rotate the token on an existing invite. Covers two cases:
 * 1. Activate a draft bespoke invite (no `claimTokenHash` yet).
 * 2. Extend/re-send a `pending` (near-expiry) or `expired` invite.
 *
 * Preserves `invite.id` so Stripe metadata, webhooks, and audit queries
 * remain correlated across attempts. Rejects when the target division's
 * registration fee is $0.
 *
 * Returns the rotated invite + the new plaintext token.
 */
export async function reissueInvite(
  input: ReissueInviteInput,
): Promise<IssuedInvite> {
  const db = getDb()

  const existing = await db
    .select()
    .from(competitionInvitesTable)
    .where(eq(competitionInvitesTable.id, input.inviteId))
    .limit(1)
    .then((rows) => rows[0] ?? null)

  if (!existing) {
    throw new InviteIssueValidationError(
      `Invite ${input.inviteId} does not exist`,
    )
  }

  if (
    existing.status === COMPETITION_INVITE_STATUS.ACCEPTED_PAID ||
    existing.status === COMPETITION_INVITE_STATUS.DECLINED ||
    existing.status === COMPETITION_INVITE_STATUS.REVOKED
  ) {
    throw new InviteIssueValidationError(
      `Invite ${input.inviteId} cannot be reissued from status ${existing.status}`,
    )
  }

  await assertDivisionIsPaid({
    competitionId: existing.championshipCompetitionId,
    divisionId: existing.championshipDivisionId,
  })

  const artifacts = await generateInviteClaimToken()
  const nextSendAttempt = existing.sendAttempt + 1
  const now = new Date()

  await db
    .update(competitionInvitesTable)
    .set({
      claimTokenHash: artifacts.hash,
      claimTokenLast4: artifacts.last4,
      expiresAt: input.newExpiresAt,
      sendAttempt: nextSendAttempt,
      status: COMPETITION_INVITE_STATUS.PENDING,
      activeMarker: COMPETITION_INVITE_ACTIVE_MARKER,
      emailDeliveryStatus: COMPETITION_INVITE_EMAIL_DELIVERY_STATUS.QUEUED,
      emailLastError: null,
      roundId: input.roundId ?? existing.roundId,
      updatedAt: now,
    })
    .where(eq(competitionInvitesTable.id, input.inviteId))

  const rotated: CompetitionInvite = {
    ...existing,
    claimTokenHash: artifacts.hash,
    claimTokenLast4: artifacts.last4,
    expiresAt: input.newExpiresAt,
    sendAttempt: nextSendAttempt,
    status: COMPETITION_INVITE_STATUS.PENDING,
    activeMarker: COMPETITION_INVITE_ACTIVE_MARKER,
    emailDeliveryStatus: COMPETITION_INVITE_EMAIL_DELIVERY_STATUS.QUEUED,
    emailLastError: null,
    roundId: input.roundId ?? existing.roundId,
    updatedAt: now,
  }

  return { invite: rotated, plaintextToken: artifacts.token }
}
