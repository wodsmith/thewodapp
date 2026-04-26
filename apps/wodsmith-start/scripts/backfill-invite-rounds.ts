#!/usr/bin/env bun
/**
 * Backfill: every Phase-2 competition_invites row → a synthetic Round 1.
 *
 * Phase 2 stored `roundId = ""` (empty-string sentinel) on every invite.
 * Phase 3 makes `roundId` a logical FK into `competition_invite_rounds`
 * and treats NULL as "draft bespoke not yet picked into a send."
 *
 * Per championship, this script:
 *   1. Inserts a synthetic round (`roundNumber = 1`, label "Round 1 — Backfill",
 *      status `sent`, with sensible deadlines copied from the earliest
 *      affected invite's `expiresAt`) — but only if no round already exists.
 *   2. Re-attributes every empty-string-roundId invite that had a token
 *      issued (`claimToken IS NOT NULL` OR status != pending) to the
 *      synthetic round.
 *   3. Sets `roundId = NULL` on the remaining draft bespoke rows
 *      (`roundId = ""` AND status = pending AND claimToken IS NULL).
 *
 * Idempotent on re-run: already-backfilled championships are skipped, and
 * empty-string rows that no longer exist are no-ops.
 *
 * Usage:
 *   bun run apps/wodsmith-start/scripts/backfill-invite-rounds.ts            # dry run (default)
 *   bun run apps/wodsmith-start/scripts/backfill-invite-rounds.ts --commit   # write to DB
 *
 * Environment:
 *   DATABASE_URL — PlanetScale connection string (the
 *                  `competition-invites` branch when running on staging).
 */

import { and, eq, isNull, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/mysql2"
import mysql from "mysql2/promise"
import { createCompetitionInviteRoundId } from "../src/db/schemas/common"
import {
  COMPETITION_INVITE_ROUND_STATUS,
  COMPETITION_INVITE_STATUS,
  competitionInviteRoundsTable,
  competitionInvitesTable,
} from "../src/db/schemas/competition-invites"

const DRY_RUN = !process.argv.includes("--commit")
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error("ERROR: Set DATABASE_URL in environment")
  process.exit(1)
}

if (DRY_RUN) {
  console.log("🔍 DRY RUN — no writes. Pass --commit to apply.\n")
} else {
  console.log("✏️  COMMIT MODE — backfill will write to the database.\n")
}

const connection = await mysql.createConnection({
  uri: DATABASE_URL,
  multipleStatements: false,
})
const db = drizzle(connection, { mode: "default", casing: "snake_case" })

// ---------------------------------------------------------------------------
// Step 1 — find all championships with empty-string roundId rows
// ---------------------------------------------------------------------------

const championshipsToBackfill = await db
  .selectDistinct({
    championshipCompetitionId: competitionInvitesTable.championshipCompetitionId,
  })
  .from(competitionInvitesTable)
  .where(eq(competitionInvitesTable.roundId, ""))

console.log(
  `Found ${championshipsToBackfill.length} championship(s) with sentinel-roundId invites.\n`,
)

let totalReattributed = 0
let totalDraftsCleared = 0
let roundsCreated = 0

for (const { championshipCompetitionId } of championshipsToBackfill) {
  if (!championshipCompetitionId) continue

  // Look at the population: which empty-string rows are issued (have token
  // or non-pending status) vs draft-pending (no token, status = pending).
  const issued = await db
    .select({
      count: sql<number>`count(*)`,
      minExpiry: sql<Date | null>`min(${competitionInvitesTable.expiresAt})`,
      maxExpiry: sql<Date | null>`max(${competitionInvitesTable.expiresAt})`,
    })
    .from(competitionInvitesTable)
    .where(
      and(
        eq(
          competitionInvitesTable.championshipCompetitionId,
          championshipCompetitionId,
        ),
        eq(competitionInvitesTable.roundId, ""),
        sql`(${competitionInvitesTable.claimToken} IS NOT NULL OR ${competitionInvitesTable.status} != ${COMPETITION_INVITE_STATUS.PENDING})`,
      ),
    )

  const drafts = await db
    .select({ count: sql<number>`count(*)` })
    .from(competitionInvitesTable)
    .where(
      and(
        eq(
          competitionInvitesTable.championshipCompetitionId,
          championshipCompetitionId,
        ),
        eq(competitionInvitesTable.roundId, ""),
        eq(competitionInvitesTable.status, COMPETITION_INVITE_STATUS.PENDING),
        isNull(competitionInvitesTable.claimToken),
      ),
    )

  const issuedCount = Number(issued[0]?.count ?? 0)
  const draftCount = Number(drafts[0]?.count ?? 0)
  // The synthetic Round 1's `rsvpDeadlineAt` should cover every invite
  // we are about to attribute to it, so we pick the *latest* per-invite
  // expiry. If none of the affected rows have an expiry (paid invites
  // can have null), fall back to 30 days out so the column constraint
  // is satisfied — backfilled rounds are sent rather than draft, so the
  // deadline is informational at this point.
  const synthDeadline =
    issued[0]?.maxExpiry ??
    issued[0]?.minExpiry ??
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  console.log(
    `· championship ${championshipCompetitionId}: ${issuedCount} issued, ${draftCount} draft`,
  )

  // Skip if a Round 1 already exists for this championship — re-runs after
  // a partial backfill should not create a second synthetic row.
  const [existingRound1] = await db
    .select({ id: competitionInviteRoundsTable.id })
    .from(competitionInviteRoundsTable)
    .where(
      and(
        eq(
          competitionInviteRoundsTable.championshipCompetitionId,
          championshipCompetitionId,
        ),
        eq(competitionInviteRoundsTable.roundNumber, 1),
      ),
    )
    .limit(1)

  let roundId: string
  if (existingRound1) {
    roundId = existingRound1.id
    console.log(`  ↳ reusing existing Round 1 row ${roundId}`)
  } else {
    roundId = createCompetitionInviteRoundId()
    if (issuedCount > 0) {
      const now = new Date()
      const row = {
        id: roundId,
        championshipCompetitionId,
        roundNumber: 1,
        label: "Round 1 — Backfill",
        emailTemplateId: null,
        subject: "Backfilled invitations",
        bodyJson: null,
        replyTo: null,
        rsvpDeadlineAt: synthDeadline,
        status: COMPETITION_INVITE_ROUND_STATUS.SENT,
        sentAt: now,
        sentByUserId: null,
        recipientCount: issuedCount,
        createdAt: now,
        updatedAt: now,
        updateCounter: 0,
      }
      console.log(
        `  ↳ ${DRY_RUN ? "WOULD insert" : "inserting"} Round 1 row ${roundId} (recipientCount=${issuedCount})`,
      )
      if (!DRY_RUN) {
        await db.insert(competitionInviteRoundsTable).values(row)
        roundsCreated += 1
      }
    } else {
      console.log(
        `  ↳ no issued invites — skipping Round 1 creation; only clearing drafts`,
      )
    }
  }

  if (issuedCount > 0) {
    console.log(
      `  ↳ ${DRY_RUN ? "WOULD re-attribute" : "re-attributing"} ${issuedCount} invite(s) to ${roundId}`,
    )
    if (!DRY_RUN) {
      await db
        .update(competitionInvitesTable)
        .set({ roundId, updatedAt: new Date() })
        .where(
          and(
            eq(
              competitionInvitesTable.championshipCompetitionId,
              championshipCompetitionId,
            ),
            eq(competitionInvitesTable.roundId, ""),
            sql`(${competitionInvitesTable.claimToken} IS NOT NULL OR ${competitionInvitesTable.status} != ${COMPETITION_INVITE_STATUS.PENDING})`,
          ),
        )
      totalReattributed += issuedCount
    }
  }

  if (draftCount > 0) {
    console.log(
      `  ↳ ${DRY_RUN ? "WOULD clear" : "clearing"} ${draftCount} draft row(s) (roundId → NULL)`,
    )
    if (!DRY_RUN) {
      await db
        .update(competitionInvitesTable)
        .set({ roundId: null, updatedAt: new Date() })
        .where(
          and(
            eq(
              competitionInvitesTable.championshipCompetitionId,
              championshipCompetitionId,
            ),
            eq(competitionInvitesTable.roundId, ""),
            eq(
              competitionInvitesTable.status,
              COMPETITION_INVITE_STATUS.PENDING,
            ),
            isNull(competitionInvitesTable.claimToken),
          ),
        )
      totalDraftsCleared += draftCount
    }
  }
}

console.log(
  `\nDone. Synthetic rounds created: ${roundsCreated}; invites re-attributed: ${totalReattributed}; drafts cleared: ${totalDraftsCleared}.`,
)

await connection.end()
