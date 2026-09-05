import {
  createWodsmithDb,
  createWodsmithMysqlConnection,
} from "@repo/wodsmith-db/mysql"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { scoreRoundsTable, scoresTable } from "@/db/schemas/scores"
import { decideCompetitionResult } from "@/server/competition-results/decision"
import {
  persistCompetitionResult,
  persistCompetitionResultInTransaction,
  updateReviewedSubmissionWorkoutResult,
} from "@/server/competition-results/repository"

import { normalizeSubmissionScoreAdjustment } from "@/server/competition-results/review"

// Run against a disposable, schema-initialized MySQL database.
describe.skipIf(!process.env.RESULT_TEST_DATABASE_URL)(
  "competition result MySQL persistence",
  () => {
    const eventId = `result_test_${Date.now()}`
    let client: ReturnType<typeof createWodsmithMysqlConnection>
    let db: ReturnType<typeof createWodsmithDb>
    const target = {
      athleteUserId: "result-test-athlete",
      ownerTeamId: "result-test-team",
      workoutId: "result-test-workout",
      trackWorkoutId: eventId,
      divisionId: null,
    }
    const workout = {
      workoutId: target.workoutId,
      scheme: "time-with-cap",
      scoreType: "sum",
      roundsToScore: 2,
      timeCap: 600,
      tiebreakScheme: null,
    }
    const revision = decideCompetitionResult(
      {
        status: "scored",
        roundScores: [
          { score: "4:00" },
          { score: "", status: "cap", secondaryScore: "150" },
        ],
      },
      workout,
    )

    beforeAll(() => {
      client = createWodsmithMysqlConnection(
        process.env.RESULT_TEST_DATABASE_URL!,
      )
      db = createWodsmithDb(client)
    })
    afterAll(async () => {
      const scores = await db
        .select({ id: scoresTable.id })
        .from(scoresTable)
        .where(eq(scoresTable.competitionEventId, eventId))
      for (const score of scores)
        await db
          .delete(scoreRoundsTable)
          .where(eq(scoreRoundsTable.scoreId, score.id))
      await db
        .delete(scoresTable)
        .where(eq(scoresTable.competitionEventId, eventId))
      await client.promise().end()
    })

    // @lat: [[competition-results#Competition Result Commands#MySQL rollback and division isolation]]
    it("isolates open and named divisions and rolls back a failed replacement", async () => {
      const open = await persistCompetitionResult({
        db,
        target,
        revision,
        recordedAt: new Date(),
      })
      const named = await persistCompetitionResult({
        db,
        target: { ...target, divisionId: "rx" },
        revision,
        recordedAt: new Date(),
      })
      expect(open.scoreId).not.toBe(named.scoreId)
      const replacement = decideCompetitionResult(
        {
          status: "scored",
          roundScores: [{ score: "5:00" }, { score: "6:00" }],
        },
        workout,
      )
      await expect(
        db.transaction(async (tx) => {
          await persistCompetitionResultInTransaction({
            db: tx,
            target,
            revision: replacement,
            recordedAt: new Date(),
          })
          throw new Error("later submission write failed")
        }),
      ).rejects.toThrow("later submission write failed")
      const [persisted] = await db
        .select()
        .from(scoresTable)
        .where(eq(scoresTable.id, open.scoreId))
      const rounds = await db
        .select()
        .from(scoreRoundsTable)
        .where(eq(scoreRoundsTable.scoreId, open.scoreId))
        .orderBy(scoreRoundsTable.roundNumber)
      expect(persisted).toMatchObject({
        scoreValue: 840000,
        secondaryValue: 150,
        sortKey: revision.sortKey,
      })
      expect(
        rounds.map(({ value, status, secondaryValue }) => ({
          value,
          status,
          secondaryValue,
        })),
      ).toEqual([
        { value: 240000, status: "scored", secondaryValue: null },
        { value: 600000, status: "cap", secondaryValue: 150 },
      ])
      const adjustment = normalizeSubmissionScoreAdjustment({
        score: "14:02",
        status: "cap",
        existingRounds: rounds,
        workout: {
          scheme: workout.scheme,
          scoreType: workout.scoreType,
          roundsToScore: 2,
          timeCapMs: 600000,
          tiebreakScheme: null,
        },
      })
      await db.transaction((tx) =>
        updateReviewedSubmissionWorkoutResult({
          db: tx,
          scoreId: open.scoreId,
          result: adjustment,
          context: { verificationStatus: "adjusted" },
        }),
      )
      const [reviewed] = await db
        .select()
        .from(scoresTable)
        .where(eq(scoresTable.id, open.scoreId))
      expect(reviewed).toMatchObject({
        scoreValue: 842000,
        status: "cap",
        secondaryValue: 150,
        verificationStatus: "adjusted",
      })
      expect(
        await db
          .select()
          .from(scoreRoundsTable)
          .where(eq(scoreRoundsTable.scoreId, open.scoreId))
          .orderBy(scoreRoundsTable.roundNumber),
      ).toEqual(rounds)
      const cleared = decideCompetitionResult({ status: "dq" }, workout)
      await persistCompetitionResult({
        db,
        target,
        revision: cleared,
        recordedAt: new Date(),
      })
      expect(
        await db
          .select()
          .from(scoreRoundsTable)
          .where(eq(scoreRoundsTable.scoreId, open.scoreId)),
      ).toHaveLength(0)
      expect(
        await db
          .select()
          .from(scoreRoundsTable)
          .where(eq(scoreRoundsTable.scoreId, named.scoreId)),
      ).toHaveLength(2)
    })
  },
)
