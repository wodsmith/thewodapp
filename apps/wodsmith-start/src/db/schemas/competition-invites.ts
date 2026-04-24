/**
 * Competition Invites Schema
 *
 * Tables powering ADR-0011 "Competition Invites" — the organizer-facing
 * qualification-source → roster → invite-round system.
 *
 * Phase 1 shipped `competition_invite_sources`. Phase 2 adds
 * `competition_invites` — the per-athlete invite row carrying the
 * email-locked claim token, status, and origin attribution. Rounds
 * (Phase 3) and email templates (Phase 4) follow.
 */
// @lat: [[competition-invites#Sources schema]]

import type { InferSelectModel } from "drizzle-orm"
import {
  datetime,
  index,
  int,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import {
  commonColumns,
  createCompetitionInviteId,
  createCompetitionInviteRoundId,
  createCompetitionInviteSourceId,
} from "./common"

// ============================================================================
// Source Kinds
// ============================================================================

export const COMPETITION_INVITE_SOURCE_KIND = {
  COMPETITION: "competition",
  SERIES: "series",
} as const

export type CompetitionInviteSourceKind =
  (typeof COMPETITION_INVITE_SOURCE_KIND)[keyof typeof COMPETITION_INVITE_SOURCE_KIND]

// ============================================================================
// Competition Invite Sources
// ============================================================================

/**
 * A qualification source attached to a championship competition. Exactly one
 * of `sourceCompetitionId` / `sourceGroupId` is non-null — the `kind`
 * discriminator indicates which. Spot allocations describe how many invitees
 * this source contributes to the championship.
 *
 * Write-time constraints are enforced in helpers, not the DB, to match
 * PlanetScale conventions (no FKs).
 */
export const competitionInviteSourcesTable = mysqlTable(
  "competition_invite_sources",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCompetitionInviteSourceId())
      .notNull(),
    // The competition receiving invites from this source.
    championshipCompetitionId: varchar({ length: 255 }).notNull(),
    // "competition" | "series"
    kind: varchar({ length: 20 })
      .$type<CompetitionInviteSourceKind>()
      .notNull(),
    // When kind = "competition".
    sourceCompetitionId: varchar({ length: 255 }),
    // When kind = "series". Logical reference to competitionGroupsTable.id.
    sourceGroupId: varchar({ length: 255 }),
    // For series: how many top-N per comp in the series get a direct slot.
    directSpotsPerComp: int(),
    // For series: how many additional spots come from the global leaderboard.
    // For single-comp: the total top-N that qualifies.
    globalSpots: int(),
    // JSON: [{ sourceDivisionId, championshipDivisionId, spots? }]
    divisionMappings: text(),
    // Display order of sources in the organizer sources tab.
    sortOrder: int().default(0).notNull(),
    // Organizer-visible free-text note about this source.
    notes: text(),
  },
  (table) => [
    index("competition_invite_sources_championship_sort_idx").on(
      table.championshipCompetitionId,
      table.sortOrder,
    ),
    index("competition_invite_sources_source_competition_idx").on(
      table.sourceCompetitionId,
    ),
    index("competition_invite_sources_source_group_idx").on(
      table.sourceGroupId,
    ),
  ],
)

export type CompetitionInviteSource = InferSelectModel<
  typeof competitionInviteSourcesTable
>

// ============================================================================
// Invite Origin
// ============================================================================

export const COMPETITION_INVITE_ORIGIN = {
  SOURCE: "source",
  BESPOKE: "bespoke",
} as const

export type CompetitionInviteOrigin =
  (typeof COMPETITION_INVITE_ORIGIN)[keyof typeof COMPETITION_INVITE_ORIGIN]

// ============================================================================
// Invite Status
// ============================================================================

/**
 * `pending` — invite issued, token live, waiting for the athlete to claim.
 * `accepted_paid` — the athlete finished Stripe Checkout and their
 *   `competition_registrations` row exists; set by the Stripe workflow.
 * `declined` — athlete explicitly declined via the decline route.
 * `expired` — cron-sweep transitioned a past-deadline pending invite.
 * `revoked` — organizer or an R2 send revoked the R1 invite.
 *
 * No intermediate `accepted` state — the Stripe-in-flight window is still
 * `pending` until the webhook confirms payment. See ADR-0011 "Capacity Math".
 */
export const COMPETITION_INVITE_STATUS = {
  PENDING: "pending",
  ACCEPTED_PAID: "accepted_paid",
  DECLINED: "declined",
  EXPIRED: "expired",
  REVOKED: "revoked",
} as const

export type CompetitionInviteStatus =
  (typeof COMPETITION_INVITE_STATUS)[keyof typeof COMPETITION_INVITE_STATUS]

// ============================================================================
// Invite Email Delivery Status
// ============================================================================

export const COMPETITION_INVITE_EMAIL_DELIVERY_STATUS = {
  QUEUED: "queued",
  SENT: "sent",
  FAILED: "failed",
  SKIPPED: "skipped",
} as const

export type CompetitionInviteEmailDeliveryStatus =
  (typeof COMPETITION_INVITE_EMAIL_DELIVERY_STATUS)[keyof typeof COMPETITION_INVITE_EMAIL_DELIVERY_STATUS]

/**
 * Literal value stored in `activeMarker` while the invite is in an active
 * state (`pending` or `accepted_paid`). Nulled the moment the invite
 * transitions to `declined`, `expired`, or `revoked`. Combined with the
 * unique index on `(championshipCompetitionId, email, championshipDivisionId,
 * activeMarker)`, this enforces at most one active invite per
 * (championship, division, email) while still allowing historical rows to
 * accumulate (MySQL treats multiple NULLs as distinct in unique indexes).
 */
export const COMPETITION_INVITE_ACTIVE_MARKER = "active" as const

// ============================================================================
// Competition Invites
// ============================================================================

/**
 * A per-athlete invite. Carries the email-locked claim token (hashed),
 * status, origin attribution (source vs bespoke), and round attribution.
 *
 * Phase 2: `roundId` is `varchar(255) NOT NULL` with an empty-string
 * sentinel default. Rounds are introduced in Phase 3 along with a backfill
 * that rewrites every Phase-2 row to a synthetic "Round 1 — Backfill".
 *
 * Token model:
 * - Only the SHA-256 hash of the URL-safe plaintext token lives here.
 * - `claimTokenLast4` is support-facing ("did this athlete click the right
 *   link?") and is rotated alongside the hash on every re-send.
 * - Terminal transitions (`declined`, `expired`, `revoked`, `accepted_paid`)
 *   set `claimTokenHash = NULL`. The unique index on the hash permits
 *   multiple NULLs (MySQL semantics) so this is safe.
 * - The `sendAttempt` counter is included in the Resend `Idempotency-Key`
 *   so a reused `invite.id` does not get silently deduplicated when the
 *   organizer extends / re-issues.
 */
export const competitionInvitesTable = mysqlTable(
  "competition_invites",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCompetitionInviteId())
      .notNull(),
    // The championship receiving this invite. Shortened to 64 so the
    // active-invite unique index below fits under MySQL's 3072-byte key
    // limit; we issue ULIDs (~30 chars with prefix) so 64 is ample.
    championshipCompetitionId: varchar({ length: 64 }).notNull(),
    // The round this invite was sent in. Logical reference to
    // `competition_invite_rounds.id`. NULL on draft bespoke invites that
    // haven't been picked into a send yet — they take on a real round id
    // the moment the organizer issues them. Phase 3 backfills the Phase-2
    // empty-string rows that already had a token to a synthetic
    // "Round 1 — Backfill" per championship; remaining empty-string rows
    // (drafts) become NULL.
    roundId: varchar({ length: 255 }),
    // "source" | "bespoke" — discriminator for how the invite came to exist.
    origin: varchar({ length: 20 })
      .$type<CompetitionInviteOrigin>()
      .notNull(),
    // `competition_invite_sources.id` — which source qualified them.
    // NULL when origin = "bespoke".
    sourceId: varchar({ length: 255 }),
    // Resolved source competition for source invites (for kind=competition
    // this equals source's competition, for kind=series this is the
    // specific comp within the series). NULL when origin = "bespoke".
    sourceCompetitionId: varchar({ length: 255 }),
    // 1-based rank in the source for display. NULL for series-global rows
    // and for bespoke invites.
    sourcePlacement: int(),
    // Denormalized human label, e.g. "Series GLB · 1st unqualified". For
    // bespoke invites this can carry the organizer's note so the roster
    // row has something to show in the source column.
    sourcePlacementLabel: varchar({ length: 255 }),
    // Free-text categorization when origin = "bespoke" ("Sponsored
    // athlete", "Past champion", "Wildcard"). Surfaces as a small chip in
    // the roster. Distinct from the salutation.
    bespokeReason: varchar({ length: 255 }),
    // The target division on the championship. Same 64-byte cap as
    // `championshipCompetitionId` so the active-invite unique index stays
    // within MySQL's 3072-byte key limit.
    championshipDivisionId: varchar({ length: 64 }).notNull(),
    // Lowercased, trimmed at write. This is the invite-locked email.
    email: varchar({ length: 255 }).notNull(),
    // The WODsmith user account, if one exists at issue time or is
    // resolved later by the claim flow.
    userId: varchar({ length: 255 }),
    // Denormalized for email salutation; falls back to `email` if NULL.
    inviteeFirstName: varchar({ length: 255 }),
    inviteeLastName: varchar({ length: 255 }),
    // SHA-256 of the URL-safe plaintext token. Rotated on each re-send.
    // NULLed on terminal transitions.
    claimTokenHash: varchar({ length: 64 }),
    // Last 4 chars of the plaintext token for organizer support queries.
    // Rotated alongside `claimTokenHash`.
    claimTokenLast4: varchar({ length: 8 }),
    // Hard expiry. Mirrors round.rsvpDeadlineAt at send time, but stored
    // per-invite so per-invite extensions work.
    expiresAt: datetime(),
    // Incremented every time the invite is re-sent. Used in the Resend
    // Idempotency-Key so re-sends with the same invite.id actually dispatch.
    sendAttempt: int().default(0).notNull(),
    // Invite lifecycle status. See COMPETITION_INVITE_STATUS.
    status: varchar({ length: 20 })
      .$type<CompetitionInviteStatus>()
      .default("pending")
      .notNull(),
    // Set when status transitions to "accepted_paid".
    paidAt: datetime(),
    // Set when status transitions to "declined".
    declinedAt: datetime(),
    // Set when status transitions to "revoked".
    revokedAt: datetime(),
    revokedByUserId: varchar({ length: 255 }),
    // The competition_registrations.id that resulted from payment.
    claimedRegistrationId: varchar({ length: 255 }),
    // Mirrors broadcast pattern: "queued" | "sent" | "failed" | "skipped".
    emailDeliveryStatus: varchar({ length: 20 })
      .$type<CompetitionInviteEmailDeliveryStatus>()
      .default("queued")
      .notNull(),
    emailLastError: text(),
    // Literal "active" while status IN (pending, accepted_paid); NULL on
    // terminal transitions. Powers the unique-active-invite index below.
    activeMarker: varchar({ length: 8 }),
  },
  (table) => [
    // At most one *active* invite per (championship, division, email).
    // MySQL treats multiple NULLs as distinct, so terminal rows
    // (activeMarker IS NULL) don't collide with a fresh re-invite.
    uniqueIndex("competition_invites_active_invite_idx").on(
      table.championshipCompetitionId,
      table.email,
      table.championshipDivisionId,
      table.activeMarker,
    ),
    // Tokens are globally unique while live. Multiple NULLs coexist so
    // historical terminal rows can accumulate.
    uniqueIndex("competition_invites_claim_token_hash_idx").on(
      table.claimTokenHash,
    ),
    index("competition_invites_round_idx").on(table.roundId),
    index("competition_invites_source_idx").on(table.sourceId),
    index("competition_invites_origin_idx").on(table.origin),
    index("competition_invites_status_idx").on(table.status),
    index("competition_invites_email_idx").on(table.email),
    index("competition_invites_championship_idx").on(
      table.championshipCompetitionId,
    ),
    index("competition_invites_user_idx").on(table.userId),
  ],
)

export type CompetitionInvite = InferSelectModel<typeof competitionInvitesTable>

// ============================================================================
// Round Status
// ============================================================================

/**
 * `draft` — organizer is still composing the round; subject/body/deadline
 *   editable; selecting Send transitions to `sending`.
 * `sending` — the send transaction is in flight (insert invites + enqueue
 *   email messages). Set by `sendRound` before any invites are inserted; a
 *   fully-successful send moves to `sent`. A pre-send rollback (validation,
 *   capacity, etc.) leaves the round in `draft`.
 * `sent` — every recipient was inserted and queued. Email-delivery failures
 *   are tracked per-invite via `emailDeliveryStatus`; the round itself is
 *   still `sent` if at least one recipient was dispatched.
 * `failed` — the send transaction crashed *after* `sending` was set and
 *   before `sent`. Recoverable: the round can be retried.
 */
export const COMPETITION_INVITE_ROUND_STATUS = {
  DRAFT: "draft",
  SENDING: "sending",
  SENT: "sent",
  FAILED: "failed",
} as const

export type CompetitionInviteRoundStatus =
  (typeof COMPETITION_INVITE_ROUND_STATUS)[keyof typeof COMPETITION_INVITE_ROUND_STATUS]

// ============================================================================
// Competition Invite Rounds
// ============================================================================

/**
 * A wave of invites for a championship. Rounds carry the metadata that
 * describes a send (subject, body composition, RSVP deadline) and the
 * status of the send itself. Per-recipient rows live on
 * `competition_invites` and reference the round via `roundId`.
 *
 * Body model: `bodyJson` is a serialized React Email composition (Phase 4
 * formalizes the schema; Phase 3 stores plaintext-or-stub JSON written by
 * the existing send dialog). `emailTemplateId` is a logical reference to
 * `competition_invite_email_templates.id` once Phase 4 lands; Phase 3
 * leaves it null.
 *
 * State machine: `draft → sending → sent | failed`. The `sendRound` helper
 * acquires `SELECT ... FOR UPDATE` on the round row and rejects any
 * transition out of `draft`, which is the double-click defense.
 *
 * `roundNumber` is dense per championship and assigned at draft creation
 * (max(roundNumber)+1 within the championship). It's a display value, not
 * a uniqueness key — the unique index on (championshipCompetitionId,
 * roundNumber) just keeps the dense numbering coherent.
 */
export const competitionInviteRoundsTable = mysqlTable(
  "competition_invite_rounds",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCompetitionInviteRoundId())
      .notNull(),
    championshipCompetitionId: varchar({ length: 255 }).notNull(),
    // 1-based, dense per competition. Display value.
    roundNumber: int().notNull(),
    // Organizer-edited display label, e.g. "Round 1 — Guaranteed".
    label: varchar({ length: 255 }).notNull(),
    // Phase 4: optional pointer to a saved email template.
    emailTemplateId: varchar({ length: 255 }),
    // Email subject line as sent.
    subject: varchar({ length: 255 }).notNull(),
    // Serialized React Email composition. Phase 3 stores a minimal shape;
    // Phase 4 finalizes the schema.
    bodyJson: text(),
    // Reply-to address; defaults to the championship's contact email at
    // send time when null.
    replyTo: varchar({ length: 255 }),
    // Hard expiry for invites issued in this round. Mirrored to each
    // invite's `expiresAt` at insert time so per-invite extensions don't
    // re-touch the round.
    rsvpDeadlineAt: datetime().notNull(),
    // See COMPETITION_INVITE_ROUND_STATUS.
    status: varchar({ length: 20 })
      .$type<CompetitionInviteRoundStatus>()
      .default("draft")
      .notNull(),
    sentAt: datetime(),
    sentByUserId: varchar({ length: 255 }),
    // Snapshot of how many invites were inserted. Set by `sendRound` once
    // the insert succeeds; `0` while draft. Stored for fast timeline reads
    // without an aggregate over `competition_invites`.
    recipientCount: int().default(0).notNull(),
  },
  (table) => [
    uniqueIndex("competition_invite_rounds_championship_number_idx").on(
      table.championshipCompetitionId,
      table.roundNumber,
    ),
    index("competition_invite_rounds_championship_status_idx").on(
      table.championshipCompetitionId,
      table.status,
    ),
  ],
)

export type CompetitionInviteRound = InferSelectModel<
  typeof competitionInviteRoundsTable
>
