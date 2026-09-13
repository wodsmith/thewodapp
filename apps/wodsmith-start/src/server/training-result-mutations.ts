import {
  personalTrainingResultsTable,
  personalTrainingSessionsTable,
  scoreRoundsTable,
  scoresTable,
  trainingCheersTable,
  trainingResultsTable,
  trainingSessionsTable,
} from "@repo/wodsmith-db/schema"
import { assertTrainingScope } from "@repo/wodsmith-training"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"
import { matchesLibraryOccurrence } from "@/lib/training/library-occurrence"
import {
  assertTrainingVersion,
  expectedVersionSchema,
  mutationFields,
  runTrainingMutation,
  trainingVersion,
} from "./training-mutations"
import { createPersonalTrainingServiceInTransaction } from "./training-personal-service"
import {
  directLibraryResultSchema,
  personalLibraryResultSchema,
  personalTrainingResultSchema,
} from "./training-personal-validation"
import {
  createTrainingService,
  createTrainingServiceInTransaction,
} from "./training-service"
import type {
  TrainingServiceDependencies,
  TrainingTransaction,
} from "./training-service-contract"
import {
  trainingDateSchema,
  trainingResultInputSchema,
} from "./training-validation"

const id = z.string().min(1).max(255)
export const resultTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("source"),
    sessionId: id,
    blockId: id,
    publishedVersion: z.number().int().positive(),
  }),
  z.object({ kind: z.literal("personal"), personalSessionId: id, itemId: id }),
  z.object({
    kind: z.literal("direct"),
    trainingDate: trainingDateSchema,
    itemId: id,
  }),
])
const resultEntrySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("source"), value: trainingResultInputSchema }),
  z.object({
    kind: z.literal("personal"),
    value: personalTrainingResultSchema,
  }),
  z.object({
    kind: z.literal("library"),
    value: personalLibraryResultSchema.omit({ replaceExisting: true }),
  }),
  z.object({
    kind: z.literal("direct"),
    value: directLibraryResultSchema.omit({
      replaceExisting: true,
      teamId: true,
    }),
  }),
])
export const getOwnedResultSchema = z.object({
  teamId: id,
  target: resultTargetSchema,
})
export const createOwnedResultSchema = z.object({
  ...mutationFields,
  entry: resultEntrySchema,
})
export const updateOwnedResultSchema = createOwnedResultSchema.extend({
  expectedVersion: expectedVersionSchema,
})
export const deleteOwnedResultSchema = getOwnedResultSchema.extend({
  ...mutationFields,
  expectedVersion: expectedVersionSchema,
})

type Target = z.infer<typeof resultTargetSchema>
function entryTarget(entry: z.infer<typeof resultEntrySchema>): Target {
  if (entry.kind === "source")
    return {
      kind: "source",
      sessionId: entry.value.sessionId,
      blockId: entry.value.blockId,
      publishedVersion: entry.value.publishedVersion,
    }
  if (entry.kind === "direct")
    return {
      kind: "direct",
      trainingDate: entry.value.trainingDate,
      itemId: entry.value.itemId,
    }
  return {
    kind: "personal",
    personalSessionId: entry.value.personalSessionId,
    itemId: entry.value.itemId,
  }
}
async function loadOwnedResult(
  tx: TrainingTransaction,
  userId: string,
  teamId: string,
  target: Target,
) {
  if (target.kind === "source") {
    const [session] = await tx
      .select()
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.id, target.sessionId),
          eq(trainingSessionsTable.teamId, teamId),
        ),
      )
      .for("update")
    if (!session) throw new Error("NOT_FOUND: Result destination not found")
    const [result] = await tx
      .select()
      .from(trainingResultsTable)
      .where(
        and(
          eq(trainingResultsTable.sessionId, session.id),
          eq(trainingResultsTable.blockId, target.blockId),
          eq(trainingResultsTable.userId, userId),
          eq(trainingResultsTable.publishedVersion, target.publishedVersion),
        ),
      )
      .for("update")
    return result
      ? { kind: "source" as const, result, score: null, rounds: [] }
      : null
  }
  const [session] = await tx
    .select()
    .from(personalTrainingSessionsTable)
    .where(
      and(
        eq(personalTrainingSessionsTable.userId, userId),
        eq(personalTrainingSessionsTable.teamId, teamId),
        target.kind === "personal"
          ? eq(personalTrainingSessionsTable.id, target.personalSessionId)
          : eq(personalTrainingSessionsTable.trainingDate, target.trainingDate),
      ),
    )
    .for("update")
  if (!session) {
    if (target.kind === "direct") return null
    throw new Error("NOT_FOUND: Personal result destination not found")
  }
  const [result] = await tx
    .select()
    .from(personalTrainingResultsTable)
    .where(
      and(
        eq(personalTrainingResultsTable.personalSessionId, session.id),
        eq(personalTrainingResultsTable.itemId, target.itemId),
        eq(personalTrainingResultsTable.userId, userId),
      ),
    )
    .for("update")
  if (!result) return null
  const [score] = result.legacyScoreId
    ? await tx
        .select()
        .from(scoresTable)
        .where(
          and(
            eq(scoresTable.id, result.legacyScoreId),
            eq(scoresTable.userId, userId),
          ),
        )
        .for("update")
    : []
  if (result.legacyScoreId && !score)
    throw new Error("CONFLICT: The linked result is unavailable")
  const rounds = score
    ? await tx
        .select()
        .from(scoreRoundsTable)
        .where(eq(scoreRoundsTable.scoreId, score.id))
        .orderBy(asc(scoreRoundsTable.roundNumber))
        .for("update")
    : []
  return { kind: "personal" as const, result, score: score ?? null, rounds }
}
export async function getOwnedResult(
  deps: TrainingServiceDependencies,
  input: z.infer<typeof getOwnedResultSchema>,
) {
  const data = getOwnedResultSchema.parse(input)
  assertTrainingScope(deps.actor, "training:read")
  return deps.db.transaction(
    async (tx) => {
      await createTrainingService({ ...deps, db: tx }).requireTrainingAccess(
        data.teamId,
      )
      const saved = await loadOwnedResult(
        tx,
        deps.actor.userId,
        data.teamId,
        data.target,
      )
      return {
        target: data.target,
        saved,
        version: saved ? await trainingVersion(saved) : null,
      }
    },
    { isolationLevel: "read committed" },
  )
}
export async function saveOwnedResult(
  deps: TrainingServiceDependencies,
  input:
    | z.infer<typeof createOwnedResultSchema>
    | z.infer<typeof updateOwnedResultSchema>,
  mode: "create" | "update",
) {
  const data =
    mode === "create"
      ? createOwnedResultSchema.parse(input)
      : updateOwnedResultSchema.parse(input)
  assertTrainingScope(deps.actor, "training:read")
  return runTrainingMutation(
    deps,
    `${mode}_result`,
    "results:write",
    data,
    async (tx) => {
      await createTrainingService({ ...deps, db: tx }).requireTrainingAccess(
        data.teamId,
      )
    },
    async (tx) => {
      const target = entryTarget(data.entry)
      const previous = await loadOwnedResult(
        tx,
        deps.actor.userId,
        data.teamId,
        target,
      )
      await assertTrainingVersion(
        previous,
        "expectedVersion" in data
          ? expectedVersionSchema.parse(data.expectedVersion)
          : null,
      )
      const service = createPersonalTrainingServiceInTransaction(deps, tx)
      const entry = data.entry
      if (entry.kind === "source")
        await createTrainingServiceInTransaction(deps, tx).saveTrainingResult(
          entry.value,
        )
      else if (entry.kind === "personal")
        await service.savePersonalTrainingResult(entry.value)
      else if (entry.kind === "library")
        await service.savePersonalLibraryResult({
          ...entry.value,
          replaceExisting: mode === "update",
        })
      else if (previous?.kind === "personal" && previous.result.libraryItem) {
        if (
          !matchesLibraryOccurrence(
            previous.result.libraryItem,
            entry.value.workoutId,
            {
              trackId: entry.value.sourceTrackId,
              sourceDate: entry.value.sourceDate,
            },
          )
        )
          throw new Error(
            "CONFLICT: This attempt belongs to a different workout",
          )
        const [session] = await tx
          .select()
          .from(personalTrainingSessionsTable)
          .where(
            eq(
              personalTrainingSessionsTable.id,
              previous.result.personalSessionId,
            ),
          )
          .for("update")
        await service.savePersonalLibraryResult({
          ...entry.value,
          personalSessionId: session.id,
          expectedRevision: session.revision,
          replaceExisting: true,
        })
      } else
        await service.saveDirectLibraryResult({
          ...entry.value,
          teamId: data.teamId,
          replaceExisting: mode === "update",
        })
      const saved = await loadOwnedResult(
        tx,
        deps.actor.userId,
        data.teamId,
        target,
      )
      if (!saved) throw new Error("UNAVAILABLE: Result was not saved")
      return { target, saved, version: await trainingVersion(saved) }
    },
  )
}
export async function deleteOwnedResult(
  deps: TrainingServiceDependencies,
  input: z.infer<typeof deleteOwnedResultSchema>,
) {
  const data = deleteOwnedResultSchema.parse(input)
  return runTrainingMutation(
    deps,
    "delete_result",
    "results:delete",
    data,
    async (tx) => {
      await createTrainingService({ ...deps, db: tx }).requireTrainingAccess(
        data.teamId,
      )
    },
    async (tx) => {
      const saved = await loadOwnedResult(
        tx,
        deps.actor.userId,
        data.teamId,
        data.target,
      )
      await assertTrainingVersion(saved, data.expectedVersion)
      if (!saved) throw new Error("NOT_FOUND: Owned result not found")
      if (saved.kind === "source") {
        await tx
          .delete(trainingCheersTable)
          .where(eq(trainingCheersTable.resultId, saved.result.id))
        await tx
          .delete(trainingResultsTable)
          .where(
            and(
              eq(trainingResultsTable.id, saved.result.id),
              eq(trainingResultsTable.userId, deps.actor.userId),
            ),
          )
      } else {
        // The private association and rich rounds are one owned result; keep the day composition.
        if (saved.score) {
          if (
            saved.score.competitionEventId ||
            saved.score.scheduledWorkoutInstanceId
          )
            throw new Error(
              "CONFLICT: Delete this scheduled or competition result in its original context",
            )
          await tx
            .delete(scoreRoundsTable)
            .where(eq(scoreRoundsTable.scoreId, saved.score.id))
          await tx
            .delete(scoresTable)
            .where(
              and(
                eq(scoresTable.id, saved.score.id),
                eq(scoresTable.userId, deps.actor.userId),
              ),
            )
        }
        await tx
          .delete(personalTrainingResultsTable)
          .where(
            and(
              eq(personalTrainingResultsTable.id, saved.result.id),
              eq(personalTrainingResultsTable.userId, deps.actor.userId),
            ),
          )
      }
      return { deleted: true, target: data.target, resultId: saved.result.id }
    },
  )
}
