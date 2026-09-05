import { and, eq, isNull } from "drizzle-orm"
import type { Database } from "@/db"
import { scoreRoundsTable, scoresTable } from "@/db/schemas/scores"
import type { CompetitionResultRevision } from "./decision"
import { CompetitionResultError } from "./domain"
import type {
  NormalizedReviewedSubmissionWorkoutResult,
  normalizeManualSubmissionWorkoutResult,
} from "./review"

export type ResultTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0]

export interface CompetitionResultTarget {
  athleteUserId: string
  ownerTeamId: string
  workoutId: string
  trackWorkoutId: string
  divisionId: string | null
}

/** Atomically replaces the current competition result and its exact round set. */
export async function persistCompetitionResult(input: {
  db: Database
  target: CompetitionResultTarget
  revision: CompetitionResultRevision
  recordedAt: Date
}): Promise<{ scoreId: string; isNew: boolean }> {
  const { db } = input

  return db.transaction((tx) =>
    persistCompetitionResultInTransaction({ ...input, db: tx }),
  )
}

export async function persistCompetitionResultInTransaction(input: {
  db: ResultTransaction
  target: CompetitionResultTarget
  revision: CompetitionResultRevision
  recordedAt: Date
}): Promise<{ scoreId: string; isNew: boolean }> {
  const { db: tx, target, revision, recordedAt } = input

  const exactKey = and(
    eq(scoresTable.competitionEventId, target.trackWorkoutId),
    eq(scoresTable.userId, target.athleteUserId),
    target.divisionId
      ? eq(scoresTable.scalingLevelId, target.divisionId)
      : isNull(scoresTable.scalingLevelId),
  )
  const [existing] = await tx
    .select({ id: scoresTable.id })
    .from(scoresTable)
    .where(exactKey)
    .limit(1)

  await tx
    .insert(scoresTable)
    .values({
      userId: target.athleteUserId,
      teamId: target.ownerTeamId,
      workoutId: target.workoutId,
      competitionEventId: target.trackWorkoutId,
      scheme: revision.scheme,
      scoreType: revision.scoreType,
      scoreValue: revision.scoreValue,
      status: revision.status,
      statusOrder: revision.statusOrder,
      sortKey: revision.sortKey,
      tiebreakScheme: revision.tiebreakScheme,
      tiebreakValue: revision.tiebreakValue,
      timeCapMs: revision.timeCapMs,
      secondaryValue: revision.secondaryValue,
      scalingLevelId: target.divisionId,
      asRx: true,
      recordedAt,
    })
    .onDuplicateKeyUpdate({
      set: {
        teamId: target.ownerTeamId,
        workoutId: target.workoutId,
        scheme: revision.scheme,
        scoreType: revision.scoreType,
        scoreValue: revision.scoreValue,
        status: revision.status,
        statusOrder: revision.statusOrder,
        sortKey: revision.sortKey,
        tiebreakScheme: revision.tiebreakScheme,
        tiebreakValue: revision.tiebreakValue,
        timeCapMs: revision.timeCapMs,
        secondaryValue: revision.secondaryValue,
        updatedAt: recordedAt,
      },
    })

  const [current] = await tx
    .select({ id: scoresTable.id })
    .from(scoresTable)
    .where(exactKey)
    .limit(1)
  if (!current) {
    throw new CompetitionResultError(
      "persistence_failed",
      "Failed to retrieve result after upsert",
    )
  }

  await replaceCompetitionResultRounds(tx, current.id, revision.rounds)

  return { scoreId: current.id, isNew: !existing }
}

/** The result aggregate owns its complete round projection. */
export async function replaceCompetitionResultRounds(
  tx: ResultTransaction,
  scoreId: string,
  rounds: CompetitionResultRevision["rounds"],
): Promise<void> {
  await tx.delete(scoreRoundsTable).where(eq(scoreRoundsTable.scoreId, scoreId))
  if (rounds.length > 0) {
    await tx
      .insert(scoreRoundsTable)
      .values(rounds.map((round) => ({ scoreId, ...round })))
  }
}

type ReviewedScoreContext = Partial<
  Pick<
    typeof scoresTable.$inferInsert,
    | "verificationStatus"
    | "verifiedAt"
    | "verifiedByUserId"
    | "penaltyType"
    | "penaltyPercentage"
    | "noRepCount"
    | "updatedAt"
  >
>

// @lat: [[domain#Domain Model#Scoring#Competition-result commands]]
export async function updateReviewedSubmissionWorkoutResult(input: {
  db: ResultTransaction
  scoreId: string
  result: NormalizedReviewedSubmissionWorkoutResult
  context: ReviewedScoreContext
}): Promise<void> {
  const { db, scoreId, result, context } = input

  await db
    .update(scoresTable)
    .set({
      scoreValue: result.scoreValue,
      status: result.status,
      statusOrder: result.statusOrder,
      sortKey: result.sortKey,
      secondaryValue: result.secondaryValue,
      tiebreakValue: result.tiebreakValue,
      ...context,
    })
    .where(eq(scoresTable.id, scoreId))

  if (result.replaceRounds) {
    await replaceCompetitionResultRounds(db, scoreId, result.rounds)
  }
}

export interface ManualSubmissionWorkoutResultTarget {
  userId: string
  teamId: string
  workoutId: string
  trackWorkoutId: string
  divisionId: string | null
}

export async function insertManualSubmissionWorkoutResult(input: {
  db: ResultTransaction
  target: ManualSubmissionWorkoutResultTarget
  result: ReturnType<typeof normalizeManualSubmissionWorkoutResult>
  recordedAt: Date
  context: ReviewedScoreContext
}): Promise<string> {
  const { db, target, result, recordedAt, context } = input

  await db.insert(scoresTable).values({
    userId: target.userId,
    teamId: target.teamId,
    workoutId: target.workoutId,
    competitionEventId: target.trackWorkoutId,
    scheme: result.scheme,
    scoreType: result.scoreType,
    scoreValue: result.scoreValue,
    status: result.status,
    statusOrder: result.statusOrder,
    sortKey: result.sortKey,
    tiebreakScheme: result.tiebreakScheme,
    tiebreakValue: result.tiebreakValue,
    timeCapMs: result.timeCapMs,
    secondaryValue: result.secondaryValue,
    scalingLevelId: target.divisionId,
    asRx: true,
    recordedAt,
    ...context,
  })

  const conditions = [
    eq(scoresTable.competitionEventId, target.trackWorkoutId),
    eq(scoresTable.userId, target.userId),
    target.divisionId
      ? eq(scoresTable.scalingLevelId, target.divisionId)
      : isNull(scoresTable.scalingLevelId),
  ]
  const [inserted] = await db
    .select({ id: scoresTable.id })
    .from(scoresTable)
    .where(and(...conditions))
    .limit(1)

  if (!inserted) throw new Error("Failed to fetch inserted score")

  await replaceCompetitionResultRounds(db, inserted.id, result.rounds)

  return inserted.id
}
