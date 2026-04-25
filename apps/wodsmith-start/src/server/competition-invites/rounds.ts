/**
 * Competition invite round helpers (Phase 3).
 *
 * Round CRUD + state-machine transitions for `competition_invite_rounds`.
 * A round is the unit of "send" — it carries subject/body/deadline metadata,
 * a recipient snapshot, and the `draft → sending → sent | failed` lifecycle.
 *
 * Why state machine matters: the send transition is the only place we touch
 * Resend, so an organizer double-click on Send must not produce two batches
 * of email. Vitess does not support cross-shard `SELECT ... FOR UPDATE`, so
 * we guard transitions with a conditional UPDATE keyed on the prior status
 * — the affected-rows count tells us whether we won the race.
 *
 * Three primary helpers:
 *  - {@link createRoundDraft} — stage a fresh round in the `draft` state.
 *    Computes the next dense `roundNumber` for the championship.
 *  - {@link updateRoundDraft} — edit subject/body/deadline/label while the
 *    round is still in `draft`. Rejects if the round has already advanced.
 *  - {@link sendRound} — `draft → sending` precondition + `sending → sent`
 *    on success. Rolls back to `failed` on caller error so retries are safe.
 *
 * Helpers do not enqueue email — that lives in the server fn layer
 * (`competition-invite-fns.ts`) which composes this layer with the
 * issue helper and the email queue.
 */
// @lat: [[competition-invites#Round helpers]]

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { getDb } from "@/db"
import { createCompetitionInviteRoundId } from "@/db/schemas/common"
import {
  COMPETITION_INVITE_ACTIVE_MARKER,
  COMPETITION_INVITE_ROUND_STATUS,
  COMPETITION_INVITE_STATUS,
  competitionInviteRoundsTable,
  competitionInvitesTable,
  type CompetitionInviteRound,
  type CompetitionInviteRoundStatus,
} from "@/db/schemas/competition-invites"

// ============================================================================
// Errors
// ============================================================================

export class RoundValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RoundValidationError"
  }
}

/**
 * Thrown when a state-machine transition fails because the round is no
 * longer in the expected source state. Carries the observed status so the
 * caller can decide whether to surface it as a conflict or treat it as
 * "already done."
 */
export class RoundStateConflictError extends Error {
  readonly observedStatus: CompetitionInviteRoundStatus | null
  constructor(roundId: string, observed: CompetitionInviteRoundStatus | null) {
    super(
      `Round ${roundId} cannot transition: observed status ${observed ?? "missing"}`,
    )
    this.name = "RoundStateConflictError"
    this.observedStatus = observed
  }
}

// ============================================================================
// Inputs
// ============================================================================

export interface CreateRoundDraftInput {
  championshipCompetitionId: string
  label: string
  subject: string
  rsvpDeadlineAt: Date
  /**
   * Stub JSON serialized by the send dialog / round builder. Phase 4
   * formalizes the schema; Phase 3 just persists whatever the caller passed
   * so the round can be re-rendered for preview.
   */
  bodyJson?: string | null
  emailTemplateId?: string | null
  replyTo?: string | null
}

export interface UpdateRoundDraftInput {
  id: string
  label?: string
  subject?: string
  rsvpDeadlineAt?: Date
  bodyJson?: string | null
  emailTemplateId?: string | null
  replyTo?: string | null
}

// ============================================================================
// Reads
// ============================================================================

export async function getRoundById(
  id: string,
): Promise<CompetitionInviteRound | null> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(competitionInviteRoundsTable)
    .where(eq(competitionInviteRoundsTable.id, id))
    .limit(1)
  return row ?? null
}

export async function listRoundsForChampionship(
  championshipCompetitionId: string,
): Promise<CompetitionInviteRound[]> {
  const db = getDb()
  return db
    .select()
    .from(competitionInviteRoundsTable)
    .where(
      eq(
        competitionInviteRoundsTable.championshipCompetitionId,
        championshipCompetitionId,
      ),
    )
    .orderBy(desc(competitionInviteRoundsTable.roundNumber))
}

// ============================================================================
// Create (draft)
// ============================================================================

/**
 * Stage a fresh draft round. Assigns a dense `roundNumber` per championship
 * by reading the current max + 1. Two organizers creating drafts at the
 * same time race here, but the unique index on
 * `(championshipCompetitionId, roundNumber)` makes the loser fail with a
 * dup-key error which the caller can retry.
 */
export async function createRoundDraft(
  input: CreateRoundDraftInput,
): Promise<CompetitionInviteRound> {
  if (!input.label.trim()) {
    throw new RoundValidationError("Round label is required")
  }
  if (!input.subject.trim()) {
    throw new RoundValidationError("Round subject is required")
  }
  if (input.rsvpDeadlineAt.getTime() <= Date.now()) {
    throw new RoundValidationError("Round RSVP deadline must be in the future")
  }

  const db = getDb()

  return db.transaction(async (tx) => {
    const [maxRow] = await tx
      .select({
        max: sql<number | null>`max(${competitionInviteRoundsTable.roundNumber})`,
      })
      .from(competitionInviteRoundsTable)
      .where(
        eq(
          competitionInviteRoundsTable.championshipCompetitionId,
          input.championshipCompetitionId,
        ),
      )

    const nextRoundNumber = (maxRow?.max ?? 0) + 1
    const id = createCompetitionInviteRoundId()
    const now = new Date()
    const row: CompetitionInviteRound = {
      id,
      championshipCompetitionId: input.championshipCompetitionId,
      roundNumber: nextRoundNumber,
      label: input.label,
      emailTemplateId: input.emailTemplateId ?? null,
      subject: input.subject,
      bodyJson: input.bodyJson ?? null,
      replyTo: input.replyTo ?? null,
      rsvpDeadlineAt: input.rsvpDeadlineAt,
      status: COMPETITION_INVITE_ROUND_STATUS.DRAFT,
      sentAt: null,
      sentByUserId: null,
      recipientCount: 0,
      createdAt: now,
      updatedAt: now,
      updateCounter: 0,
    }
    await tx.insert(competitionInviteRoundsTable).values(row)
    return row
  })
}

// ============================================================================
// Update (draft only)
// ============================================================================

/**
 * Edit a draft round's metadata. The conditional UPDATE pins
 * `status = "draft"` so a concurrent send can't be silently overwritten:
 * a 0-row outcome surfaces as {@link RoundStateConflictError} so the UI
 * can refresh and tell the organizer the round has already shipped.
 */
export async function updateRoundDraft(
  input: UpdateRoundDraftInput,
): Promise<CompetitionInviteRound> {
  if (input.label !== undefined && !input.label.trim()) {
    throw new RoundValidationError("Round label cannot be empty")
  }
  if (input.subject !== undefined && !input.subject.trim()) {
    throw new RoundValidationError("Round subject cannot be empty")
  }
  if (
    input.rsvpDeadlineAt !== undefined &&
    input.rsvpDeadlineAt.getTime() <= Date.now()
  ) {
    throw new RoundValidationError("Round RSVP deadline must be in the future")
  }

  const db = getDb()
  const updates: Partial<CompetitionInviteRound> = { updatedAt: new Date() }
  if (input.label !== undefined) updates.label = input.label
  if (input.subject !== undefined) updates.subject = input.subject
  if (input.rsvpDeadlineAt !== undefined)
    updates.rsvpDeadlineAt = input.rsvpDeadlineAt
  if (input.bodyJson !== undefined) updates.bodyJson = input.bodyJson
  if (input.emailTemplateId !== undefined)
    updates.emailTemplateId = input.emailTemplateId
  if (input.replyTo !== undefined) updates.replyTo = input.replyTo

  const result = await db
    .update(competitionInviteRoundsTable)
    .set(updates)
    .where(
      and(
        eq(competitionInviteRoundsTable.id, input.id),
        eq(
          competitionInviteRoundsTable.status,
          COMPETITION_INVITE_ROUND_STATUS.DRAFT,
        ),
      ),
    )

  const affected = (result as unknown as { affectedRows?: number }).affectedRows
  // Treat undefined as a miss — a future driver bump that drops the
  // `affectedRows` field shouldn't silently skip the conflict guard.
  if (affected == null || affected === 0) {
    const fresh = await getRoundById(input.id)
    throw new RoundStateConflictError(input.id, fresh?.status ?? null)
  }

  const fresh = await getRoundById(input.id)
  if (!fresh) {
    throw new RoundValidationError(`Round ${input.id} disappeared mid-update`)
  }
  return fresh
}

// ============================================================================
// State transitions
// ============================================================================

export interface BeginSendingResult {
  round: CompetitionInviteRound
}

/**
 * Atomically transition a round from `draft → sending`. Required first step
 * of a send: callers may then run their insert/enqueue work and finalize
 * with {@link finalizeRoundSend} (`sending → sent`) on success or
 * {@link markRoundFailed} (`sending → failed`) on failure.
 *
 * The conditional UPDATE keyed on `status = "draft"` is the double-click
 * defense — a second click hits a row that is no longer `draft` and the
 * affected-rows guard raises {@link RoundStateConflictError}.
 */
export async function beginSendingRound(params: {
  roundId: string
}): Promise<BeginSendingResult> {
  const db = getDb()
  const result = await db
    .update(competitionInviteRoundsTable)
    .set({
      status: COMPETITION_INVITE_ROUND_STATUS.SENDING,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(competitionInviteRoundsTable.id, params.roundId),
        eq(
          competitionInviteRoundsTable.status,
          COMPETITION_INVITE_ROUND_STATUS.DRAFT,
        ),
      ),
    )

  const affected = (result as unknown as { affectedRows?: number }).affectedRows
  // Treat undefined as a miss — a future driver bump that drops the
  // `affectedRows` field shouldn't silently skip the conflict guard.
  if (affected == null || affected === 0) {
    const fresh = await getRoundById(params.roundId)
    throw new RoundStateConflictError(
      params.roundId,
      fresh?.status ?? null,
    )
  }

  const fresh = await getRoundById(params.roundId)
  if (!fresh) {
    throw new RoundValidationError(
      `Round ${params.roundId} disappeared mid-send`,
    )
  }
  return { round: fresh }
}

/**
 * Finalize a send by recording the recipient count + sender + sent-at
 * timestamp and flipping `sending → sent`. Idempotent on retries because
 * the conditional WHERE only matches a row still in `sending`.
 */
export async function finalizeRoundSend(params: {
  roundId: string
  recipientCount: number
  sentByUserId: string
}): Promise<void> {
  const db = getDb()
  const now = new Date()
  const result = await db
    .update(competitionInviteRoundsTable)
    .set({
      status: COMPETITION_INVITE_ROUND_STATUS.SENT,
      recipientCount: params.recipientCount,
      sentAt: now,
      sentByUserId: params.sentByUserId,
      updatedAt: now,
    })
    .where(
      and(
        eq(competitionInviteRoundsTable.id, params.roundId),
        eq(
          competitionInviteRoundsTable.status,
          COMPETITION_INVITE_ROUND_STATUS.SENDING,
        ),
      ),
    )

  const affected = (result as unknown as { affectedRows?: number }).affectedRows
  // Treat undefined as a miss — a future driver bump that drops the
  // `affectedRows` field shouldn't silently skip the conflict guard.
  if (affected == null || affected === 0) {
    const fresh = await getRoundById(params.roundId)
    throw new RoundStateConflictError(
      params.roundId,
      fresh?.status ?? null,
    )
  }
}

/**
 * Reset `sending → failed` so the organizer can retry. Used when the send
 * pipeline crashes after `beginSendingRound` succeeded but before
 * `finalizeRoundSend`. We don't move backwards to `draft` because the
 * round may have partially-inserted invite rows that need to be observed
 * (and possibly re-issued) before the next attempt.
 */
export async function markRoundFailed(params: {
  roundId: string
}): Promise<void> {
  const db = getDb()
  await db
    .update(competitionInviteRoundsTable)
    .set({
      status: COMPETITION_INVITE_ROUND_STATUS.FAILED,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(competitionInviteRoundsTable.id, params.roundId),
        eq(
          competitionInviteRoundsTable.status,
          COMPETITION_INVITE_ROUND_STATUS.SENDING,
        ),
      ),
    )
}

// ============================================================================
// Pre-send revoke (R2 supersedes R1)
// ============================================================================

/**
 * Revoke any active invites for a (championship, division, email-set) so
 * a new round's invites can be issued without colliding with the
 * unique-active-invite index. Returns the ids of invites that were revoked
 * — the caller can use this to attribute the revoke event to the issuing
 * round (e.g. for audit).
 *
 * Runs inside the same transaction as the new-invite insert so a partial
 * failure doesn't leave the championship with two active invites for the
 * same email. Caller is expected to wrap this + the insert in a
 * `db.transaction(...)` boundary; the helper itself is db-arg-driven so
 * it composes.
 */
export async function revokeActiveInvitesForEmails(
  tx: ReturnType<typeof getDb>,
  params: {
    championshipCompetitionId: string
    championshipDivisionId: string
    emails: string[]
    revokedByUserId: string
    revokingRoundId: string
  },
): Promise<{ revokedInviteIds: string[] }> {
  if (params.emails.length === 0) {
    return { revokedInviteIds: [] }
  }

  const existing = await tx
    .select({ id: competitionInvitesTable.id })
    .from(competitionInvitesTable)
    .where(
      and(
        eq(
          competitionInvitesTable.championshipCompetitionId,
          params.championshipCompetitionId,
        ),
        eq(
          competitionInvitesTable.championshipDivisionId,
          params.championshipDivisionId,
        ),
        eq(
          competitionInvitesTable.activeMarker,
          COMPETITION_INVITE_ACTIVE_MARKER,
        ),
        // We only revoke the still-pending rows. accepted_paid stays
        // active — a paid invite is still "this athlete is registered"
        // and a re-invite would be a no-op anyway.
        eq(competitionInvitesTable.status, COMPETITION_INVITE_STATUS.PENDING),
        inArray(competitionInvitesTable.email, params.emails),
      ),
    )
    .orderBy(asc(competitionInvitesTable.id))

  const revokedInviteIds = existing.map((row) => row.id)
  if (revokedInviteIds.length === 0) {
    return { revokedInviteIds }
  }

  const now = new Date()
  await tx
    .update(competitionInvitesTable)
    .set({
      status: COMPETITION_INVITE_STATUS.REVOKED,
      revokedAt: now,
      revokedByUserId: params.revokedByUserId,
      claimTokenHash: null,
      activeMarker: null,
      updatedAt: now,
    })
    .where(inArray(competitionInvitesTable.id, revokedInviteIds))

  return { revokedInviteIds }
}
