import { eq } from "drizzle-orm"
import type { Database } from "@/db"
import { scoreRoundsTable } from "@/db/schemas/scores"
import type { NormalizedWorkoutResultRound } from "@/lib/scoring/result"

type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0]

type WorkoutResultRoundWriter = Pick<DatabaseTransaction, "delete" | "insert">

export async function writeWorkoutResultRounds(
  db: WorkoutResultRoundWriter,
  scoreId: string,
  rounds: NormalizedWorkoutResultRound[],
  options: { replaceExisting: boolean },
): Promise<void> {
  if (options.replaceExisting) {
    await db
      .delete(scoreRoundsTable)
      .where(eq(scoreRoundsTable.scoreId, scoreId))
  }

  if (rounds.length > 0) {
    await db.insert(scoreRoundsTable).values(
      rounds.map((round) => ({
        scoreId,
        roundNumber: round.roundNumber,
        value: round.value,
        status: round.status,
      })),
    )
  }
}
