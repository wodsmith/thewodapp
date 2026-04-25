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
  /**
   * The round this batch of invites belongs to. Required as of Phase 3 —
   * Phase 2's empty-string sentinel was backfilled to a synthetic
   * "Round 1 — Backfill" row and callers must always supply a real id.
   */
  roundId: string
  recipients: IssueInviteRecipient[]
  /**
   * When true, recipients whose email already holds an *active pending*
   * invite with a token (an undelivered or unresponded R1 invite) get
   * that prior invite atomically transitioned to `revoked` inside the
   * same transaction as the new R2 insert. Per ADR-0011 Phase 3, this
   * is what "Sending an R2 to athletes who already have a pending R1
   * invite revokes the R1 token before issuing R2" looks like at the
   * data layer — each athlete keeps at most one active invite per
   * (championship, division). Drafts (`activeMarker = active` but no
   * token) still go through the reissue path on the caller side, and
   * `accepted_paid` rows are left alone (the athlete is registered).
   *
   * `userId` of the organizer is captured into `revokedByUserId` so the
   * supersede event has audit attribution. Default true — the round
   * builder + roster Send button always supersede; ad-hoc tools that
   * want the old "skip" semantics can pass false explicitly.
   */
  supersedeActivePendingInvites?: boolean
  /** Captured into `revokedByUserId` on superseded rows. Required when
   *  {@link IssueInvitesInput.supersedeActivePendingInvites} is true. */
  superseededByUserId?: string | null
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
  /** Invite ids transitioned from `pending → revoked` in the same
   *  transaction so the caller (and audit log) can correlate the
   *  supersede with the new round's invites. Empty when
   *  `supersedeActivePendingInvites` was false. */
  supersededInviteIds: string[]
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

/**
 * Permissive email pattern used at write boundaries (issue + bespoke
 * staging). Not RFC 5322 — but tight enough to reject the obvious
 * garbage that would otherwise slip into the queue.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
// Existing-invite classification (pure, unit-tested)
// ============================================================================

export type ExistingInviteAction =
  | { kind: "skip-already-active"; existingInviteId: string; isDraft: false }
  | { kind: "reissue-draft"; existingInviteId: string; isDraft: true }
  | { kind: "supersede-then-insert"; existingInviteId: string }

/**
 * Decide what to do with an existing active invite when its email is in
 * the new round's recipient list. Pure — easily unit-tested without a DB.
 *
 * Branches:
 * - draft (pending, no token) → caller reissues in place.
 * - accepted_paid → skip; the athlete is already registered.
 * - pending with token + supersede=true → revoke prior, insert fresh
 *   (the R2-supersedes-R1 atomic-revoke flow).
 * - pending with token + supersede=false → skip; caller surfaces it.
 */
export function classifyExistingInvite(
  existing: Pick<
    CompetitionInvite,
    "id" | "status" | "claimTokenHash"
  >,
  supersede: boolean,
): ExistingInviteAction {
  const isDraft =
    !existing.claimTokenHash &&
    existing.status === COMPETITION_INVITE_STATUS.PENDING
  if (isDraft) {
    return {
      kind: "reissue-draft",
      existingInviteId: existing.id,
      isDraft: true,
    }
  }
  if (existing.status === COMPETITION_INVITE_STATUS.ACCEPTED_PAID) {
    return {
      kind: "skip-already-active",
      existingInviteId: existing.id,
      isDraft: false,
    }
  }
  if (
    supersede &&
    existing.status === COMPETITION_INVITE_STATUS.PENDING
  ) {
    return { kind: "supersede-then-insert", existingInviteId: existing.id }
  }
  return {
    kind: "skip-already-active",
    existingInviteId: existing.id,
    isDraft: false,
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
    return { inserted: [], alreadyActive: [], supersededInviteIds: [] }
  }

  await assertDivisionIsPaid({
    competitionId: input.championshipCompetitionId,
    divisionId: input.championshipDivisionId,
  })

  const normalized = input.recipients.map((r) => {
    assertRecipientOriginValid(r)
    const email = normalizeInviteEmail(r.email)
    if (!EMAIL_PATTERN.test(email)) {
      throw new InviteIssueValidationError(`Invalid email: ${r.email}`)
    }
    return { ...r, email }
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
    const supersede = input.supersedeActivePendingInvites !== false

    const alreadyActive: AlreadyActiveInvite[] = []
    const toInsertInputs: IssueInviteRecipient[] = []
    const supersededInviteIds: string[] = []
    const seenEmails = new Set<string>()
    for (const r of normalized) {
      if (seenEmails.has(r.email)) continue
      seenEmails.add(r.email)
      const existingRow = existingByEmail.get(r.email)
      if (!existingRow) {
        toInsertInputs.push(r)
        continue
      }

      const action = classifyExistingInvite(existingRow, supersede)
      switch (action.kind) {
        case "reissue-draft":
          alreadyActive.push({
            email: r.email,
            existingInviteId: action.existingInviteId,
            isDraft: true,
          })
          break
        case "skip-already-active":
          alreadyActive.push({
            email: r.email,
            existingInviteId: action.existingInviteId,
            isDraft: false,
          })
          break
        case "supersede-then-insert":
          supersededInviteIds.push(action.existingInviteId)
          toInsertInputs.push(r)
          break
      }
    }

    if (supersededInviteIds.length > 0) {
      const now = new Date()
      await tx
        .update(competitionInvitesTable)
        .set({
          status: COMPETITION_INVITE_STATUS.REVOKED,
          revokedAt: now,
          revokedByUserId: input.superseededByUserId ?? null,
          claimTokenHash: null,
          activeMarker: null,
          updatedAt: now,
        })
        .where(inArray(competitionInvitesTable.id, supersededInviteIds))
    }

    if (toInsertInputs.length === 0) {
      return { inserted: [], alreadyActive, supersededInviteIds }
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
        roundId: input.roundId,
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

    return { inserted, alreadyActive, supersededInviteIds }
  })
}

// ============================================================================
// Reissue (rotate token on existing row)
// ============================================================================

export interface ReissueInviteInput {
  inviteId: string
  newExpiresAt: Date
  /**
   * Optional new round attribution. When omitted the invite stays attached
   * to its existing round (the common "Extend" path). When set, the invite
   * is re-attributed to the supplied round — e.g. when a draft bespoke
   * invite is activated by a fresh send.
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
 * The UPDATE pins `status IN (pending, expired)` in the WHERE clause so
 * a concurrent claim/decline/revoke between read and write can't be
 * silently overwritten. A 0-row outcome forces a re-read to tell apart
 * "row vanished" from "row terminal-transitioned mid-flight".
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

  const updateResult = await db
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
    .where(
      and(
        eq(competitionInvitesTable.id, input.inviteId),
        inArray(competitionInvitesTable.status, [
          COMPETITION_INVITE_STATUS.PENDING,
          COMPETITION_INVITE_STATUS.EXPIRED,
        ]),
      ),
    )

  const affected = (updateResult as unknown as { affectedRows?: number })
    .affectedRows
  // Treat undefined as a miss — a driver bump that drops the
  // `affectedRows` field shouldn't silently skip the conflict guard.
  if (affected == null || affected === 0) {
    const fresh = await db
      .select({ status: competitionInvitesTable.status })
      .from(competitionInvitesTable)
      .where(eq(competitionInvitesTable.id, input.inviteId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
    throw new InviteIssueValidationError(
      `Invite ${input.inviteId} cannot be reissued — concurrently transitioned to ${fresh?.status ?? "unknown"}`,
    )
  }

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
