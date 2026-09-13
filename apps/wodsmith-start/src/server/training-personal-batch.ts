import {
  externalWorkoutImportItemsTable,
  externalWorkoutImportsTable,
  userTable,
  workoutMovements,
  workouts,
} from "@repo/wodsmith-db/schema"
import { trainingSessionsTable } from "@repo/wodsmith-db/schemas/training"
import { personalTrainingSessionsTable } from "@repo/wodsmith-db/schemas/training-personal"
import { and, eq, inArray } from "drizzle-orm"
import { matchesLibraryOccurrence } from "@/lib/training/library-occurrence"
import type {
  PersonalTrainingItem,
  SavePersonalTrainingSessionInput,
} from "@/lib/training/personal-types"
import {
  createPersonalTrainingService,
  savePersonalTrainingSessionInTransaction,
} from "./training-personal-service"
import { personalTrainingSaveSchema } from "./training-personal-validation"
import { createTrainingService } from "./training-service"
import {
  assertTrainingScope,
  type TrainingServiceDependencies,
  type TrainingTransaction,
} from "./training-service-contract"
import { assertTrainingRevision } from "./training-validation"
import { validateChangedWorkoutReferences } from "./workout-references"

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`
  return JSON.stringify(value) ?? "null"
}

export type PreparedPersonalSessions = Awaited<
  ReturnType<typeof preparePersonalSessions>
>["prepared"]

/** Read-only resolution. Never creates a personal day or logs a result. */
export async function preparePersonalSessions(
  dependencies: TrainingServiceDependencies,
  inputs: SavePersonalTrainingSessionInput[],
) {
  assertTrainingScope(dependencies.actor, "training:read")
  if (inputs.length > 7)
    throw new Error("VALIDATION: A batch supports at most seven days")
  const parsed = inputs
    .map((input) => personalTrainingSaveSchema.parse(input))
    .sort((a, b) => a.trainingDate.localeCompare(b.trainingDate))
  if (new Set(parsed.map((input) => input.trainingDate)).size !== parsed.length)
    throw new Error("VALIDATION: A batch must contain unique dates")
  if (parsed.some((input) => input.mode !== "replace"))
    throw new Error("VALIDATION: Planning batches replace reviewed days")
  const service = createPersonalTrainingService(dependencies)
  const days = []
  for (const input of parsed) {
    // Inspect all owned contexts before filtering access; never expose hidden rows.
    const owned = await dependencies.db
      .select()
      .from(personalTrainingSessionsTable)
      .where(
        and(
          eq(personalTrainingSessionsTable.userId, dependencies.actor.userId),
          eq(personalTrainingSessionsTable.trainingDate, input.trainingDate),
        ),
      )
      .for("share")
    if (owned.length > 1 || owned.some((row) => row.teamId !== input.teamId))
      throw new Error(
        "CONFLICT: This day has another workspace composition; resolve it in Training before saving",
      )
    const previous = owned[0]
    assertTrainingRevision(previous?.revision ?? 0, input.expectedRevision)
    await createTrainingService(dependencies).requireTrainingAccess(
      input.teamId,
    )
    const current = {
      personalSession: previous
        ? {
            id: previous.id,
            teamId: previous.teamId,
            trainingDate: previous.trainingDate,
            revision: previous.revision,
            compositionState: previous.compositionState,
            items: previous.items as PersonalTrainingItem[],
          }
        : null,
    }
    for (const item of input.items) {
      if (item.kind !== "library") continue
      const stored = current.personalSession?.items.find(
        (old) => old.id.toLowerCase() === item.id.toLowerCase(),
      )
      if (
        stored?.kind === "library" &&
        !matchesLibraryOccurrence(stored, item.workoutId, {
          trackId: item.sourceTrackId,
          sourceDate: item.sourceDate,
        })
      )
        throw new Error(
          "CONFLICT: Use a new item ID when changing a workout occurrence",
        )
    }
    const sources = []
    const library = []
    for (const item of input.items) {
      if (item.kind === "personal" && item.block.workout) {
        const previousItem = current.personalSession?.items.find(
          (old) => old.id.toLowerCase() === item.id.toLowerCase(),
        )
        await validateChangedWorkoutReferences(
          dependencies.db,
          item.block.workout,
          previousItem?.kind === "personal"
            ? previousItem.block.workout
            : undefined,
          input.teamId,
        )
      }

      if (item.kind === "library") {
        const stored = (
          previous?.items as PersonalTrainingItem[] | undefined
        )?.find(
          (old) =>
            old.id.toLowerCase() === item.id.toLowerCase() &&
            old.kind === "library" &&
            old.workoutId === item.workoutId,
        )
        library.push({
          itemId: item.id,
          workout:
            stored?.kind === "library" && stored.provenance
              ? stored.workout
              : await service.getTrainingLibraryWorkout({
                  teamId: input.teamId,
                  workoutId: item.workoutId,
                  sourceTrackId: item.sourceTrackId,
                  sourceDate: item.sourceDate,
                }),
        })
      }
      const ref =
        item.kind === "source"
          ? item
          : item.kind === "personal"
            ? item.remixedFrom
            : undefined
      if (ref) {
        const [source] = await dependencies.db
          .select()
          .from(trainingSessionsTable)
          .where(eq(trainingSessionsTable.id, ref.sourceSessionId))
          .for("share")
        // Domain access and exact published version are also checked again by the canonical writer.
        if (!source || source.teamId !== input.teamId || !source.published)
          throw new Error("FORBIDDEN: Source programming is unavailable")
        const context =
          await createTrainingService(dependencies).getTrainingContext()
        if (
          !context.teams
            .find((team) => team.id === input.teamId)
            ?.tracks.some((track) => track.id === source.trackId)
        )
          throw new Error("FORBIDDEN: Source programming is unavailable")
        const preserved = current.personalSession?.items.some(
          (old) =>
            (old.kind === "source" &&
              old.sourceSessionId === ref.sourceSessionId &&
              old.sourceBlockId === ref.sourceBlockId &&
              old.sourcePublishedVersion === ref.sourcePublishedVersion) ||
            (item.kind === "personal" &&
              old.kind === "personal" &&
              old.id.toLowerCase() === item.id.toLowerCase() &&
              old.remixedFrom?.sourceSessionId === ref.sourceSessionId &&
              old.remixedFrom.sourceBlockId === ref.sourceBlockId &&
              old.remixedFrom.sourcePublishedVersion ===
                ref.sourcePublishedVersion),
        )
        if (
          !preserved &&
          source.publishedVersion !== ref.sourcePublishedVersion
        )
          throw new Error(
            "CONFLICT: Source programming changed; refresh before adding it",
          )
        if (
          !preserved &&
          !source.published.blocks.some(
            (block) => block.id === ref.sourceBlockId,
          )
        )
          throw new Error("NOT_FOUND: Published workout not found")
        sources.push({
          id: source.id,
          teamId: source.teamId,
          trackId: source.trackId,
          revision: source.revision,
          publishedVersion: source.publishedVersion,
          published: source.published,
        })
      }
    }
    const removedItems = (current.personalSession?.items ?? []).filter(
      (item) => !input.items.some((next) => next.id === item.id),
    )
    days.push({
      input,
      previous: current.personalSession,
      sources,
      library,
      removedItems,
      historyPolicy:
        "Performed results and their saved definitions are preserved" as const,
    })
  }
  const review = {
    days,
    identityCapability: "unambiguous_existing_workspace_day" as const,
  }
  return {
    prepared: { userId: dependencies.actor.userId, inputs: parsed, review },
    review,
  }
}

/** Lock the entire dependency set before validating the review, without writing any day. */
export async function validatePreparedPersonalSessions(
  dependencies: TrainingServiceDependencies,
  tx: TrainingTransaction,
  prepared: PreparedPersonalSessions,
): Promise<void> {
  if (prepared.userId !== dependencies.actor.userId)
    throw new Error("FORBIDDEN: Prepared days belong to another athlete")
  await tx
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.id, prepared.userId))
    .for("update")
  for (const input of prepared.inputs) {
    await tx
      .select()
      .from(personalTrainingSessionsTable)
      .where(
        and(
          eq(personalTrainingSessionsTable.userId, prepared.userId),
          eq(personalTrainingSessionsTable.trainingDate, input.trainingDate),
        ),
      )
      .orderBy(personalTrainingSessionsTable.id)
      .for("update")
  }
  const sourceIds = [
    ...new Set(
      prepared.review.days.flatMap((day) =>
        day.sources.map((source) => source.id),
      ),
    ),
  ].sort()
  if (sourceIds.length)
    await tx
      .select()
      .from(trainingSessionsTable)
      .where(inArray(trainingSessionsTable.id, sourceIds))
      .orderBy(trainingSessionsTable.id)
      .for("update")
  const workoutIds = [
    ...new Set(
      prepared.inputs.flatMap((day) =>
        day.items.flatMap((item) =>
          item.kind === "library" ? [item.workoutId] : [],
        ),
      ),
    ),
  ].sort()
  if (workoutIds.length) {
    await tx
      .select()
      .from(workouts)
      .where(inArray(workouts.id, workoutIds))
      .orderBy(workouts.id)
      .for("update")
    await tx
      .select()
      .from(workoutMovements)
      .where(inArray(workoutMovements.workoutId, workoutIds))
      .orderBy(workoutMovements.id)
      .for("update")
    await tx
      .select({ id: externalWorkoutImportsTable.id })
      .from(externalWorkoutImportsTable)
      .innerJoin(
        externalWorkoutImportItemsTable,
        eq(
          externalWorkoutImportItemsTable.importId,
          externalWorkoutImportsTable.id,
        ),
      )
      .where(inArray(externalWorkoutImportItemsTable.workoutId, workoutIds))
      .orderBy(externalWorkoutImportsTable.id)
      .for("update")
  }
  const fresh = await preparePersonalSessions(
    { ...dependencies, db: tx },
    prepared.inputs,
  )
  if (canonical(fresh.review) !== canonical(prepared.review))
    throw new Error(
      "CONFLICT: Training or source programming changed; preview again",
    )
}

/** Revalidates even when called without the planning layer's earlier validation. */
export async function savePreparedPersonalSessions(
  dependencies: TrainingServiceDependencies,
  tx: TrainingTransaction,
  prepared: PreparedPersonalSessions,
) {
  assertTrainingScope(dependencies.actor, "training:write")
  await validatePreparedPersonalSessions(dependencies, tx, prepared)
  const sessions = []
  for (const input of prepared.inputs)
    sessions.push(
      await savePersonalTrainingSessionInTransaction(dependencies, tx, input),
    )
  return sessions
}
