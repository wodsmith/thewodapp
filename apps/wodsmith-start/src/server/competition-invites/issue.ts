/**
 * Competition invite issue helpers (Phase 2).
 *
 * DB-side-only layer that writes `competition_invites` rows for new sends
 * and refreshes existing rows on re-send. Does NOT render email, does
 * NOT enqueue — those belong to `competition-invite-fns.issueInvitesFn`
 * (2.13) so the email queue consumer is the only path that calls Resend.
 *
 * Three primary helpers:
 * - {@link issueInvitesForRecipients} — insert new pending invite rows for
 *   source-derived and fresh bespoke recipients. Returns the inserted rows
 *   together with their plaintext claim tokens for the email render.
 *   Conflicts against an already-active invite surface as `alreadyActive`
 *   with a {@link AlreadyActiveResolution} hint telling the caller
 *   whether to activate (draft), redeliver (already-sent), or skip
 *   (terminal status).
 * - {@link reissueInvite} — rotate token, bump `sendAttempt`, bump
 *   `expiresAt`, restore `activeMarker = "active"`, and flip `expired` /
 *   draft-no-token rows back to `pending`. Covers both extend-expired
 *   and activate-draft-bespoke paths.
 * - {@link redeliverInvite} — bump `sendAttempt` + `expiresAt` while
 *   **preserving** the existing `claimToken`, so an athlete who already
 *   received the prior email keeps a working link after the resend.
 *
 * All paths reject at the target division's registration fee of $0 —
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
import { generateInviteClaimTokenPlaintext } from "@/lib/competition-invites/tokens"
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
  /**
   * Plaintext claim token. Mirrors `invite.claimToken` so callers don't
   * have to reach into the row when rendering the email URL.
   */
  plaintextToken: string
}

/**
 * What the caller should do with an already-active invite when the
 * organizer re-runs Send.
 *
 * - `"draft"`  — pending row that has no claim token yet (a staged
 *   bespoke draft) **or** has one but its prior dispatch failed
 *   (`emailDeliveryStatus = "failed"`). The athlete never received the
 *   prior link, so {@link reissueInvite} rotates a fresh token and
 *   re-sends.
 *
 * - `"resend"` — pending row with a delivered token. The athlete may
 *   already have the prior email, so {@link redeliverInvite} keeps the
 *   token (the existing claim URL stays valid) and only bumps
 *   `expiresAt` + `sendAttempt` before re-rendering and re-queuing the
 *   email. Use case: organizer is opening earned spots up to first-come-
 *   first-serve and needs to nudge previously-invited athletes that
 *   they could lose their qualifying spot.
 *
 * - `"skip"`   — terminal active state (e.g. `accepted_paid`). The
 *   athlete is already registered; re-sending would be spam.
 */
export type AlreadyActiveResolution = "draft" | "resend" | "skip"

export interface AlreadyActiveInvite {
  email: string
  existingInviteId: string
  resolution: AlreadyActiveResolution
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

/**
 * Decide what to do with an active invite the organizer is trying to
 * (re-)issue. See {@link AlreadyActiveResolution} for the contract.
 *
 * The four input dimensions:
 *   1. `status` — pending vs. terminal (accepted_paid, etc.).
 *   2. `claimToken` — null means the row is a bespoke draft.
 *   3. `emailDeliveryStatus` — `"failed"` means the prior dispatch
 *      crashed before the email reached the recipient.
 *
 * The PENDING + token + non-failed branch is the "athlete already has a
 * working link" case — preserve the token, just refresh the expiration.
 */
function resolveAlreadyActive(
  existingRow: Pick<
    CompetitionInvite,
    "status" | "claimToken" | "emailDeliveryStatus"
  >,
): AlreadyActiveResolution {
  if (existingRow.status !== COMPETITION_INVITE_STATUS.PENDING) {
    return "skip"
  }
  if (!existingRow.claimToken) {
    return "draft"
  }
  if (
    existingRow.emailDeliveryStatus ===
    COMPETITION_INVITE_EMAIL_DELIVERY_STATUS.FAILED
  ) {
    return "draft"
  }
  return "resend"
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
          resolution: resolveAlreadyActive(existingRow),
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
      const plaintextToken = generateInviteClaimTokenPlaintext()
      const id = createCompetitionInviteId()
      const now = new Date()
      const row: CompetitionInvite = {
        id,
        championshipCompetitionId: input.championshipCompetitionId,
        roundId: input.roundId ?? "",
        origin: r.origin,
        sourceId:
          r.origin === COMPETITION_INVITE_ORIGIN.SOURCE
            ? (r.sourceId ?? null)
            : null,
        sourceCompetitionId:
          r.origin === COMPETITION_INVITE_ORIGIN.SOURCE
            ? (r.sourceCompetitionId ?? null)
            : null,
        sourcePlacement:
          r.origin === COMPETITION_INVITE_ORIGIN.SOURCE
            ? (r.sourcePlacement ?? null)
            : null,
        sourcePlacementLabel: r.sourcePlacementLabel ?? null,
        bespokeReason:
          r.origin === COMPETITION_INVITE_ORIGIN.BESPOKE
            ? (r.bespokeReason ?? null)
            : null,
        championshipDivisionId: input.championshipDivisionId,
        email: r.email,
        userId: r.userId ?? null,
        inviteeFirstName: r.inviteeFirstName ?? null,
        inviteeLastName: r.inviteeLastName ?? null,
        claimToken: plaintextToken,
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
      inserted.push({ invite: row, plaintextToken })
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
 * 1. Activate a draft bespoke invite (no `claimToken` yet).
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

  const plaintextToken = generateInviteClaimTokenPlaintext()
  const nextSendAttempt = existing.sendAttempt + 1
  const now = new Date()

  const updateResult = await db
    .update(competitionInvitesTable)
    .set({
      claimToken: plaintextToken,
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

  // Read affected count off both driver shapes — mysql2 returns
  // `[ResultSetHeader, FieldPacket[]]` (look at `[0].affectedRows`),
  // planetscale-serverless returns `{ rowsAffected }`. Reading
  // `.affectedRows` on the array yields `undefined`, which silently
  // bypassed the concurrent-transition guard below.
  const affected =
    (updateResult as unknown as { rowsAffected?: number }).rowsAffected ??
    (updateResult as unknown as [{ affectedRows?: number }])[0]?.affectedRows ??
    0
  if (affected === 0) {
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
    claimToken: plaintextToken,
    expiresAt: input.newExpiresAt,
    sendAttempt: nextSendAttempt,
    status: COMPETITION_INVITE_STATUS.PENDING,
    activeMarker: COMPETITION_INVITE_ACTIVE_MARKER,
    emailDeliveryStatus: COMPETITION_INVITE_EMAIL_DELIVERY_STATUS.QUEUED,
    emailLastError: null,
    roundId: input.roundId ?? existing.roundId,
    updatedAt: now,
  }

  return { invite: rotated, plaintextToken }
}

// ============================================================================
// Redeliver (resend the SAME token with a fresh expiration date)
// ============================================================================

export interface RedeliverInviteInput {
  inviteId: string
  newExpiresAt: Date
  roundId?: string
}

/**
 * Re-deliver a pending invite to an athlete who already has the prior
 * link. Bumps `expiresAt` + `sendAttempt`, queues a fresh email
 * dispatch, but **preserves the existing `claimToken`** so the URL the
 * athlete already received from the prior email stays valid.
 *
 * Use case: organizer is opening earned spots up to first-come-first-
 * serve and needs to nudge previously-invited athletes that they could
 * lose their qualifying spot. Rotating the token here would invalidate
 * the link they already had in hand.
 *
 * Pre-conditions enforced here:
 * - Row must exist.
 * - `status` must be `pending` (terminal states are skip-only).
 * - `claimToken` must be non-null (a draft has nothing to preserve —
 *   call {@link reissueInvite} to mint the first token instead).
 *
 * Concurrent-claim protection mirrors {@link reissueInvite}: the UPDATE
 * pins `status = pending` in the WHERE clause, and a 0-row outcome
 * forces a re-read to distinguish "vanished" from "raced to a terminal
 * status mid-flight".
 */
export async function redeliverInvite(
  input: RedeliverInviteInput,
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

  if (existing.status !== COMPETITION_INVITE_STATUS.PENDING) {
    throw new InviteIssueValidationError(
      `Invite ${input.inviteId} cannot be redelivered from status ${existing.status}`,
    )
  }

  if (!existing.claimToken) {
    throw new InviteIssueValidationError(
      `Invite ${input.inviteId} has no claim token — use reissueInvite to activate a draft`,
    )
  }

  await assertDivisionIsPaid({
    competitionId: existing.championshipCompetitionId,
    divisionId: existing.championshipDivisionId,
  })

  const nextSendAttempt = existing.sendAttempt + 1
  const now = new Date()

  const updateResult = await db
    .update(competitionInvitesTable)
    .set({
      // claimToken intentionally omitted — the prior link must keep working.
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
        eq(competitionInvitesTable.status, COMPETITION_INVITE_STATUS.PENDING),
      ),
    )

  const affected =
    (updateResult as unknown as { rowsAffected?: number }).rowsAffected ??
    (updateResult as unknown as [{ affectedRows?: number }])[0]?.affectedRows ??
    0
  if (affected === 0) {
    const fresh = await db
      .select({ status: competitionInvitesTable.status })
      .from(competitionInvitesTable)
      .where(eq(competitionInvitesTable.id, input.inviteId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
    throw new InviteIssueValidationError(
      `Invite ${input.inviteId} cannot be redelivered — concurrently transitioned to ${fresh?.status ?? "unknown"}`,
    )
  }

  const refreshed: CompetitionInvite = {
    ...existing,
    expiresAt: input.newExpiresAt,
    sendAttempt: nextSendAttempt,
    status: COMPETITION_INVITE_STATUS.PENDING,
    activeMarker: COMPETITION_INVITE_ACTIVE_MARKER,
    emailDeliveryStatus: COMPETITION_INVITE_EMAIL_DELIVERY_STATUS.QUEUED,
    emailLastError: null,
    roundId: input.roundId ?? existing.roundId,
    updatedAt: now,
  }

  return { invite: refreshed, plaintextToken: existing.claimToken }
}
