/**
 * Bespoke invite staging helpers (Phase 2).
 *
 * Bespoke invites are first-class invites with no source attribution — the
 * organizer types an email directly (or pastes a list) and a draft row is
 * staged in `competition_invites`. A draft row has:
 *   - `origin = "bespoke"`
 *   - `status = "pending"`
 *   - `activeMarker = "active"` — enforces the unique-active index so the
 *     organizer cannot add the same (email, division) twice.
 *   - `roundId = ""` (Phase 2 sentinel)
 *   - `claimTokenHash = NULL` — no token issued until the row is picked
 *     into a send.
 *
 * Two entry points:
 *  - {@link createBespokeInvite} — single-email path.
 *  - {@link createBespokeInvitesBulk} — CSV/TSV paste path. Accepts
 *    email-only lines too. Caps at 500 rows per submission (ADR-0011
 *    OQ#8 = 500). Duplicates and invalid rows come back as structured
 *    results, not exceptions, so the organizer UI can render row-level
 *    feedback.
 *
 * Both paths reject when the target division's registration fee is $0 —
 * free competitions are not eligible for invites in the MVP.
 */
// @lat: [[competition-invites#Bespoke helpers]]

import { and, eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import { createCompetitionInviteId } from "@/db/schemas/common"
import {
  COMPETITION_INVITE_ACTIVE_MARKER,
  COMPETITION_INVITE_EMAIL_DELIVERY_STATUS,
  COMPETITION_INVITE_ORIGIN,
  COMPETITION_INVITE_STATUS,
  type CompetitionInvite,
  competitionInvitesTable,
} from "@/db/schemas/competition-invites"
import { getRegistrationFee } from "@/server/commerce/fee-calculator"
import {
  FreeCompetitionNotEligibleError,
  InviteIssueValidationError,
  normalizeInviteEmail,
} from "./issue"

// ============================================================================
// Bulk cap (ADR-0011 OQ#8)
// ============================================================================

export const BESPOKE_BULK_MAX_ROWS = 500

// ============================================================================
// Single-add
// ============================================================================

export interface CreateBespokeInviteInput {
  championshipCompetitionId: string
  championshipDivisionId: string
  email: string
  inviteeFirstName?: string | null
  inviteeLastName?: string | null
  bespokeReason?: string | null
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function assertDivisionIsPaid(params: {
  competitionId: string
  divisionId: string
}): Promise<void> {
  const fee = await getRegistrationFee(params.competitionId, params.divisionId)
  if (fee <= 0) {
    throw new FreeCompetitionNotEligibleError(params)
  }
}

export async function createBespokeInvite(
  input: CreateBespokeInviteInput,
): Promise<CompetitionInvite> {
  const email = normalizeInviteEmail(input.email)
  if (!EMAIL_PATTERN.test(email)) {
    throw new InviteIssueValidationError(`Invalid email: ${input.email}`)
  }

  await assertDivisionIsPaid({
    competitionId: input.championshipCompetitionId,
    divisionId: input.championshipDivisionId,
  })

  const db = getDb()

  const existing = await db
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
        eq(competitionInvitesTable.email, email),
        eq(
          competitionInvitesTable.activeMarker,
          COMPETITION_INVITE_ACTIVE_MARKER,
        ),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null)

  if (existing) {
    throw new InviteIssueValidationError(
      `${email} already has an active invite for this championship division`,
    )
  }

  const id = createCompetitionInviteId()
  const now = new Date()
  const row: CompetitionInvite = {
    id,
    championshipCompetitionId: input.championshipCompetitionId,
    roundId: "",
    origin: COMPETITION_INVITE_ORIGIN.BESPOKE,
    sourceId: null,
    sourceCompetitionId: null,
    sourcePlacement: null,
    sourcePlacementLabel: null,
    bespokeReason: input.bespokeReason ?? null,
    championshipDivisionId: input.championshipDivisionId,
    email,
    userId: null,
    inviteeFirstName: input.inviteeFirstName ?? null,
    inviteeLastName: input.inviteeLastName ?? null,
    claimTokenHash: null,
    claimTokenLast4: null,
    expiresAt: null,
    sendAttempt: 0,
    status: COMPETITION_INVITE_STATUS.PENDING,
    paidAt: null,
    declinedAt: null,
    revokedAt: null,
    revokedByUserId: null,
    claimedRegistrationId: null,
    emailDeliveryStatus: COMPETITION_INVITE_EMAIL_DELIVERY_STATUS.SKIPPED,
    emailLastError: null,
    activeMarker: COMPETITION_INVITE_ACTIVE_MARKER,
    createdAt: now,
    updatedAt: now,
    updateCounter: 0,
  }

  await db.insert(competitionInvitesTable).values(row)
  return row
}

// ============================================================================
// Bulk paste (CSV / TSV / one-email-per-line)
// ============================================================================

export interface BulkRowInput {
  /** 1-based index in the original paste body. */
  rowNumber: number
  email: string
  inviteeFirstName?: string | null
  inviteeLastName?: string | null
  bespokeReason?: string | null
}

export interface BulkInvalidRow {
  rowNumber: number
  rawLine: string
  reason: string
}

export interface BulkDuplicateRow {
  rowNumber: number
  email: string
  reason: "already_invited" | "duplicate_in_paste"
}

export interface CreateBespokeInvitesBulkResult {
  created: CompetitionInvite[]
  duplicates: BulkDuplicateRow[]
  invalid: BulkInvalidRow[]
}

export interface CreateBespokeInvitesBulkInput {
  championshipCompetitionId: string
  championshipDivisionId: string
  /** Raw paste body — CSV, TSV, or one-email-per-line. */
  pasteText: string
}

/**
 * Parse a single paste-body line into a candidate row. Emits null if the
 * line is blank or looks like a header (literal "email" in the first
 * column, case-insensitive). The parser auto-detects tab vs comma delimiter
 * per line, preferring tab when present (Google Sheets paste is TSV).
 */
export function parseBespokePasteLine(
  line: string,
  rowNumber: number,
): BulkRowInput | null {
  const trimmed = line.trim()
  if (trimmed === "") return null

  const delimiter = trimmed.includes("\t") ? "\t" : ","
  const fields = trimmed.split(delimiter).map((f) => f.trim())

  const emailField = fields[0] ?? ""
  if (emailField === "") return null
  if (emailField.toLowerCase() === "email") return null // header row

  return {
    rowNumber,
    email: emailField,
    inviteeFirstName: fields[1] || null,
    inviteeLastName: fields[2] || null,
    // Field 3 is a division hint we ignore in Phase 2 (caller supplies
    // the division). Field 4 is the bespoke reason.
    bespokeReason: fields[4] || null,
  }
}

/**
 * Split the paste body into parsed rows + invalid rows. Pure function.
 * Caps at {@link BESPOKE_BULK_MAX_ROWS}; overflow rows are silently dropped
 * (the caller should surface the cap in the UI).
 */
export function parseBespokePaste(pasteText: string): {
  rows: BulkRowInput[]
  invalid: BulkInvalidRow[]
} {
  const normalizedLines = pasteText
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .slice(0, BESPOKE_BULK_MAX_ROWS + 1) // +1 so a header line doesn't eat a real row

  const rows: BulkRowInput[] = []
  const invalid: BulkInvalidRow[] = []

  normalizedLines.forEach((line, i) => {
    const rowNumber = i + 1
    const parsed = parseBespokePasteLine(line, rowNumber)
    if (!parsed) return
    const normalizedEmail = normalizeInviteEmail(parsed.email)
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      invalid.push({
        rowNumber,
        rawLine: line,
        reason: `Invalid email: ${parsed.email}`,
      })
      return
    }
    rows.push({ ...parsed, email: normalizedEmail })
  })

  return { rows: rows.slice(0, BESPOKE_BULK_MAX_ROWS), invalid }
}

export async function createBespokeInvitesBulk(
  input: CreateBespokeInvitesBulkInput,
): Promise<CreateBespokeInvitesBulkResult> {
  await assertDivisionIsPaid({
    competitionId: input.championshipCompetitionId,
    divisionId: input.championshipDivisionId,
  })

  const { rows, invalid } = parseBespokePaste(input.pasteText)

  // Dedup within the paste body, keeping the first occurrence.
  const seen = new Map<string, BulkRowInput>()
  const duplicates: BulkDuplicateRow[] = []
  for (const r of rows) {
    if (seen.has(r.email)) {
      duplicates.push({
        rowNumber: r.rowNumber,
        email: r.email,
        reason: "duplicate_in_paste",
      })
      continue
    }
    seen.set(r.email, r)
  }
  const uniqueRows = Array.from(seen.values())

  if (uniqueRows.length === 0) {
    return { created: [], duplicates, invalid }
  }

  const db = getDb()

  // One round-trip to find emails that already have an active invite.
  const emails = uniqueRows.map((r) => r.email)
  const existing = await db
    .select({ email: competitionInvitesTable.email })
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

  const existingEmails = new Set(existing.map((e) => e.email))
  const insertable: BulkRowInput[] = []
  for (const r of uniqueRows) {
    if (existingEmails.has(r.email)) {
      duplicates.push({
        rowNumber: r.rowNumber,
        email: r.email,
        reason: "already_invited",
      })
      continue
    }
    insertable.push(r)
  }

  if (insertable.length === 0) {
    return { created: [], duplicates, invalid }
  }

  const now = new Date()
  const newRows: CompetitionInvite[] = insertable.map((r) => ({
    id: createCompetitionInviteId(),
    championshipCompetitionId: input.championshipCompetitionId,
    roundId: "",
    origin: COMPETITION_INVITE_ORIGIN.BESPOKE,
    sourceId: null,
    sourceCompetitionId: null,
    sourcePlacement: null,
    sourcePlacementLabel: null,
    bespokeReason: r.bespokeReason ?? null,
    championshipDivisionId: input.championshipDivisionId,
    email: r.email,
    userId: null,
    inviteeFirstName: r.inviteeFirstName ?? null,
    inviteeLastName: r.inviteeLastName ?? null,
    claimTokenHash: null,
    claimTokenLast4: null,
    expiresAt: null,
    sendAttempt: 0,
    status: COMPETITION_INVITE_STATUS.PENDING,
    paidAt: null,
    declinedAt: null,
    revokedAt: null,
    revokedByUserId: null,
    claimedRegistrationId: null,
    emailDeliveryStatus: COMPETITION_INVITE_EMAIL_DELIVERY_STATUS.SKIPPED,
    emailLastError: null,
    activeMarker: COMPETITION_INVITE_ACTIVE_MARKER,
    createdAt: now,
    updatedAt: now,
    updateCounter: 0,
  }))

  await db.insert(competitionInvitesTable).values(newRows)

  return { created: newRows, duplicates, invalid }
}
