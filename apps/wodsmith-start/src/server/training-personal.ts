import {
  createScoreId,
  externalWorkoutImportItemsTable,
  externalWorkoutImportsTable,
  programmingTracksTable,
  trackWorkoutsTable,
  scalingGroupsTable,
  scalingLevelsTable,
  scoreRoundsTable,
  scoresTable,
  workoutMovements,
  workouts,
} from "@repo/wodsmith-db/schema"
import {
  trainingResultsTable,
  trainingSessionsTable,
} from "@repo/wodsmith-db/schemas/training"
import {
  personalTrainingResultsTable,
  personalTrainingSessionsTable,
  trainingPreferencesTable,
} from "@repo/wodsmith-db/schemas/training-personal"
import { and, asc, desc, eq, inArray, isNull, like } from "drizzle-orm"
import type { z } from "zod"
import { ulid } from "ulid"
import { getDb } from "@/db"
import type {
  PersonalTrainingDay,
  PersonalTrainingItem,
  PersonalTrainingItemInput,
  PersonalTrainingSession,
  SavePersonalTrainingResultInput,
  SavePersonalTrainingSessionInput,
  TrainingSourceReference,
} from "@/lib/training/personal-types"
import type { OwnTrainingResult, TrainingSession } from "@/lib/training/types"
import { requireTrackRead, workoutVisibilityCondition } from "./training-access"
import { getPublishedCrossFitDays } from "./crossfit-import"
import { getTrainingContext, requireTrainingAccess } from "./training"
import { writeWorkoutResultRounds } from "./training-logs/rounds"
import { normalizePersonalLibraryScore } from "./training-personal-scoring"
import {
  personalLibraryResultSchema,
  directLibraryResultSchema,
  personalTrainingDaySchema,
  personalTrainingResultSchema,
  personalTrainingSaveSchema,
  personalTrainingScoreLinkSchema,
  trainingLibraryListSchema,
  trainingLibraryWorkoutSchema,
  trainingPreferenceSchema,
} from "./training-personal-validation"
import {
  assertTrainingRevision,
  normalizeTrainingResult,
} from "./training-validation"
import { validateChangedWorkoutReferences } from "./workout-references"

type Db = ReturnType<typeof getDb>
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]
type PersonalRow = typeof personalTrainingSessionsTable.$inferSelect
type ResultRow = typeof personalTrainingResultsTable.$inferSelect

function personalSession(row: PersonalRow): PersonalTrainingSession {
  return {
    id: row.id,
    teamId: row.teamId,
    trainingDate: row.trainingDate,
    revision: row.revision,
    compositionState: row.compositionState,
    items: row.items as PersonalTrainingItem[],
  }
}
function ownPersonalResult(
  row: ResultRow,
  session: PersonalRow,
): OwnTrainingResult {
  if (!row.block) throw new Error("Library results use the workout log")
  return {
    id: row.id,
    sessionId: session.id,
    blockId: row.itemId,
    publishedVersion: 1,
    userId: row.userId,
    userName: "You",
    trainingDate: session.trainingDate,
    trackId: "",
    block: row.block,
    scoreValue: row.scoreValue,
    displayScore: row.displayScore,
    details: row.details,
    scaling: "custom",
    modification: "",
    audience: "private",
    unit: row.unit,
    completed: row.completed,
    cheerCount: 0,
    hasCheered: false,
    notes: row.notes,
  }
}
function sourceMatches(
  a: TrainingSourceReference,
  b: TrainingSourceReference,
): boolean {
  return (
    a.sourceSessionId === b.sourceSessionId &&
    a.sourceBlockId === b.sourceBlockId &&
    a.sourcePublishedVersion === b.sourcePublishedVersion
  )
}
function sourceItem(
  session: TrainingSession,
  blockId: string,
  trackName: string,
  id: string,
): PersonalTrainingItem {
  const block = session.published?.blocks.find((b) => b.id === blockId)
  if (!block) throw new Error("NOT_FOUND: Published workout not found")
  return {
    id,
    kind: "source",
    sourceSessionId: session.id,
    sourceBlockId: block.id,
    sourcePublishedVersion: session.publishedVersion,
    block,
    trackId: session.trackId,
    trackName,
    sourceTrainingDate: session.trainingDate,
  }
}

export async function saveTrainingPreference(input: {
  teamId: string
  defaultTrackId: string
}): Promise<void> {
  const data = trainingPreferenceSchema.parse(input)
  const { userId } = await requireTrainingAccess(
    data.teamId,
    data.defaultTrackId,
  )
  await getDb()
    .insert(trainingPreferencesTable)
    .values({ id: ulid(), userId, ...data })
    .onDuplicateKeyUpdate({ set: { defaultTrackId: data.defaultTrackId } })
}

export async function getPersonalTrainingDay(input: {
  teamId: string
  trainingDate: string
  trackId?: string
}): Promise<PersonalTrainingDay> {
  const data = personalTrainingDaySchema.parse(input)
  const { userId } = await requireTrainingAccess(data.teamId, data.trackId)
  const context = await getTrainingContext()
  const team = context.teams.find((t) => t.id === data.teamId)
  if (!team) throw new Error("FORBIDDEN: Training access changed")
  const [preference] = await getDb()
    .select()
    .from(trainingPreferencesTable)
    .where(
      and(
        eq(trainingPreferencesTable.userId, userId),
        eq(trainingPreferencesTable.teamId, data.teamId),
      ),
    )
  const defaultTrackId =
    team.tracks.find((t) => t.id === preference?.defaultTrackId)?.id ??
    team.tracks[0]?.id ??
    null
  const selectedTrackId = data.trackId ?? defaultTrackId
  const [source] = selectedTrackId
    ? await getDb()
        .select()
        .from(trainingSessionsTable)
        .where(
          and(
            eq(trainingSessionsTable.teamId, data.teamId),
            eq(trainingSessionsTable.trackId, selectedTrackId),
            eq(trainingSessionsTable.trainingDate, data.trainingDate),
          ),
        )
    : []
  const sourceSession: TrainingSession | null = source?.published
    ? { ...source, draft: null }
    : null
  const [personal] = await getDb()
    .select()
    .from(personalTrainingSessionsTable)
    .where(
      and(
        eq(personalTrainingSessionsTable.userId, userId),
        eq(personalTrainingSessionsTable.teamId, data.teamId),
        eq(personalTrainingSessionsTable.trainingDate, data.trainingDate),
      ),
    )
  const resultRows = personal
    ? await getDb()
        .select()
        .from(personalTrainingResultsTable)
        .where(
          and(
            eq(personalTrainingResultsTable.personalSessionId, personal.id),
            eq(personalTrainingResultsTable.userId, userId),
          ),
        )
    : []
  const items: PersonalTrainingItem[] =
    personal && personal.compositionState !== "result_only"
      ? (personal.items as PersonalTrainingItem[])
      : (sourceSession?.published?.blocks.map((b) =>
          sourceItem(
            sourceSession,
            b.id,
            team.tracks.find((t) => t.id === selectedTrackId)?.name ??
              "Programming",
            ulid(),
          ),
        ) ?? [])
  const sourceIds = [
    ...new Set(
      items.flatMap((item) =>
        item.kind === "source" ? [item.sourceSessionId] : [],
      ),
    ),
  ]
  const currentSources = sourceIds.length
    ? await getDb()
        .select()
        .from(trainingSessionsTable)
        .where(inArray(trainingSessionsTable.id, sourceIds))
    : []
  const sourceResults = sourceIds.length
    ? await getDb()
        .select()
        .from(trainingResultsTable)
        .where(
          and(
            eq(trainingResultsTable.userId, userId),
            inArray(trainingResultsTable.sessionId, sourceIds),
          ),
        )
    : []
  const visibleSourceResults: OwnTrainingResult[] = sourceResults.flatMap(
    (row) => {
      const item = items.find(
        (i) =>
          i.kind === "source" &&
          i.sourceSessionId === row.sessionId &&
          i.sourceBlockId === row.blockId &&
          i.sourcePublishedVersion === row.publishedVersion,
      )
      if (!item || item.kind !== "source") return []
      return [
        {
          ...row,
          userName: "You",
          trainingDate: item.sourceTrainingDate,
          trackId: item.trackId,
          cheerCount: 0,
          hasCheered: false,
        },
      ]
    },
  )
  return {
    source: sourceSession
      ? { kind: "coach-session", session: sourceSession }
      : selectedTrackId
        ? await providerSource(selectedTrackId, data.trainingDate)
        : { kind: "unavailable" },
    defaultUnavailable:
      !!preference?.defaultTrackId &&
      !team.tracks.some((track) => track.id === preference.defaultTrackId),
    defaultTrackId,
    selectedTrackId,
    sourceSession,
    personalSession: personal ? personalSession(personal) : null,
    items: items.map((item) =>
      item.kind === "source"
        ? {
            ...item,
            sourceIsCurrent: currentSources.some(
              (source) =>
                source.id === item.sourceSessionId &&
                source.publishedVersion === item.sourcePublishedVersion,
            ),
          }
        : item,
    ),
    results: [
      ...visibleSourceResults,
      ...(personal
        ? resultRows
            .filter((r) => r.block)
            .map((r) => ownPersonalResult(r, personal))
        : []),
    ],
    libraryResults: resultRows.flatMap((r) =>
      r.legacyScoreId
        ? [
            {
              itemId: r.itemId,
              scoreId: r.legacyScoreId,
              displayScore: r.displayScore,
              occurrence: r.libraryItem?.occurrence,
              workoutId: r.libraryItem?.workoutId,
              provenance: r.libraryItem?.provenance,
            },
          ]
        : [],
    ),
  }
}

const libraryFields = {
  id: workouts.id,
  name: workouts.name,
  description: workouts.description,
  scheme: workouts.scheme,
  scoreType: workouts.scoreType,
  roundsToScore: workouts.roundsToScore,
  timeCap: workouts.timeCap,
  repsPerRound: workouts.repsPerRound,
  tiebreakScheme: workouts.tiebreakScheme,
  scalingGroupId: workouts.scalingGroupId,
}
export async function listTrainingLibraryWorkouts(input: {
  teamId: string
  search?: string
}) {
  const data = trainingLibraryListSchema.parse(input)
  await requireTrainingAccess(data.teamId)
  const visibility = await workoutVisibilityCondition()
  return getDb()
    .select(libraryFields)
    .from(workouts)
    .where(
      and(
        visibility,
        data.search ? like(workouts.name, `%${data.search}%`) : undefined,
      ),
    )
    .orderBy(workouts.name)
    .limit(50)
}
export async function getTrainingLibraryWorkout(input: {
  teamId: string
  workoutId: string
  sourceTrackId?: string
  sourceDate?: string
}): Promise<
  Pick<typeof workouts.$inferSelect, keyof typeof libraryFields> & {
    provenance?: import("@/lib/training/personal-types").ProviderProvenance
    movementIds: string[]
  }
> {
  const data = trainingLibraryWorkoutSchema.parse(input)
  if (data.sourceDate && !data.sourceTrackId)
    throw new Error("Choose a source track with the programmed date")
  await requireTrainingAccess(data.teamId)
  const visibility = await workoutVisibilityCondition()
  const [workout] = await getDb()
    .select(libraryFields)
    .from(workouts)
    .where(and(eq(workouts.id, data.workoutId), visibility))
  if (!workout) throw new Error("FORBIDDEN: Workout is not available to you")
  if (data.sourceTrackId) await requireTrackRead(data.sourceTrackId)
  const [provenance] = await getDb()
    .select({
      importId: externalWorkoutImportsTable.id,
      trackId: externalWorkoutImportsTable.trackId,
      trackName: programmingTracksTable.name,
      sourceDate: externalWorkoutImportsTable.sourceDate,
      sourceUrl: externalWorkoutImportsTable.sourceUrl,
    })
    .from(externalWorkoutImportItemsTable)
    .innerJoin(
      externalWorkoutImportsTable,
      eq(
        externalWorkoutImportsTable.id,
        externalWorkoutImportItemsTable.importId,
      ),
    )
    .innerJoin(
      programmingTracksTable,
      eq(programmingTracksTable.id, externalWorkoutImportsTable.trackId),
    )
    .where(
      and(
        eq(externalWorkoutImportItemsTable.workoutId, workout.id),
        eq(externalWorkoutImportsTable.status, "published"),
        data.sourceTrackId
          ? eq(externalWorkoutImportsTable.trackId, data.sourceTrackId)
          : undefined,
        data.sourceDate
          ? eq(externalWorkoutImportsTable.sourceDate, data.sourceDate)
          : undefined,
      ),
    )
    .limit(1)
  if (data.sourceTrackId && !provenance) {
    const [association] = await getDb()
      .select({ id: trackWorkoutsTable.id })
      .from(trackWorkoutsTable)
      .where(
        and(
          eq(trackWorkoutsTable.trackId, data.sourceTrackId),
          eq(trackWorkoutsTable.workoutId, workout.id),
        ),
      )
      .limit(1)
    if (!association || data.sourceDate)
      throw new Error("FORBIDDEN: Published source occurrence is not available")
  }
  let sourceProvenance:
    | import("@/lib/training/personal-types").ProviderProvenance
    | undefined = provenance ?? undefined
  if (sourceProvenance && !data.sourceTrackId) {
    try {
      await requireTrackRead(sourceProvenance.trackId)
    } catch {
      sourceProvenance = undefined
    }
  }
  const movementRows = await getDb()
    .select({ id: workoutMovements.movementId })
    .from(workoutMovements)
    .where(eq(workoutMovements.workoutId, workout.id))
  const movementIds = movementRows.flatMap((row) => (row.id ? [row.id] : []))
  if (!workout.scalingGroupId) {
    const [group] = await getDb()
      .select({ id: scalingGroupsTable.id })
      .from(scalingGroupsTable)
      .where(eq(scalingGroupsTable.isSystem, true))
      .limit(1)
    return {
      ...workout,
      movementIds,
      provenance: sourceProvenance,
      scalingGroupId: group?.id ?? null,
    }
  }
  return { ...workout, movementIds, provenance: sourceProvenance }
}

export async function savePersonalTrainingSession(
  input: SavePersonalTrainingSessionInput,
): Promise<PersonalTrainingSession> {
  const data = personalTrainingSaveSchema.parse(input)
  const { userId } = await requireTrainingAccess(data.teamId)
  const context = await getTrainingContext()
  const team = context.teams.find((t) => t.id === data.teamId)
  if (!team) throw new Error("FORBIDDEN: Training access changed")
  const [previousSession] = await getDb()
    .select()
    .from(personalTrainingSessionsTable)
    .where(
      and(
        eq(personalTrainingSessionsTable.userId, userId),
        eq(personalTrainingSessionsTable.teamId, data.teamId),
        eq(personalTrainingSessionsTable.trainingDate, data.trainingDate),
      ),
    )
  const previousItems = (previousSession?.items ?? []) as PersonalTrainingItem[]
  const library = new Map<
    string,
    Awaited<ReturnType<typeof getTrainingLibraryWorkout>>
  >()
  for (const item of data.items)
    if (
      item.kind === "library" &&
      !previousItems.some(
        (old) =>
          old.kind === "library" &&
          !!old.provenance &&
          old.id === item.id &&
          old.workoutId === item.workoutId,
      )
    )
      library.set(
        item.id,
        await getTrainingLibraryWorkout({
          teamId: data.teamId,
          workoutId: item.workoutId,
          sourceTrackId: item.sourceTrackId,
          sourceDate: item.sourceDate,
        }),
      )
  try {
    return await getDb().transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(personalTrainingSessionsTable)
        .where(
          and(
            eq(personalTrainingSessionsTable.userId, userId),
            eq(personalTrainingSessionsTable.teamId, data.teamId),
            eq(personalTrainingSessionsTable.trainingDate, data.trainingDate),
          ),
        )
        .for("update")
      const previous = (existing?.items ?? []) as PersonalTrainingItem[]
      const sameInput = (
        left: PersonalTrainingItem,
        right: PersonalTrainingItemInput,
      ) =>
        left.id === right.id &&
        left.kind === right.kind &&
        (left.kind === "library" && right.kind === "library"
          ? left.workoutId === right.workoutId &&
            left.occurrence?.trackId === right.sourceTrackId &&
            left.occurrence?.sourceDate === right.sourceDate
          : left.kind === "source" && right.kind === "source"
            ? sourceMatches(left, right)
            : JSON.stringify(left) === JSON.stringify(right))
      const sameOccurrence = (
        left: PersonalTrainingItem,
        right: PersonalTrainingItemInput,
      ) =>
        data.allowDuplicate
          ? sameInput(left, right)
          : left.kind === "library" && right.kind === "library"
            ? left.workoutId === right.workoutId &&
              left.occurrence?.trackId === right.sourceTrackId &&
              left.occurrence?.sourceDate === right.sourceDate
            : left.kind === "source" && right.kind === "source"
              ? sourceMatches(left, right)
              : sameInput(left, right)
      if (
        data.mode === "append" &&
        existing &&
        data.items.every((item) =>
          previous.some((old) => sameOccurrence(old, item)),
        )
      )
        return personalSession(existing)
      assertTrainingRevision(existing?.revision ?? 0, data.expectedRevision)
      if (data.mode === "append") {
        if (
          data.items.some((item) =>
            previous.some((old) => old.id === item.id && !sameInput(old, item)),
          )
        )
          throw new Error(
            "CONFLICT: This addition belongs to a different workout",
          )
        data.items = [
          ...previous,
          ...data.items.filter(
            (item) => !previous.some((old) => sameOccurrence(old, item)),
          ),
        ]
      } else if (data.mode === "undo") {
        const ids = new Set(data.items.map((item) => item.id))
        const scored = existing
          ? await tx
              .select()
              .from(personalTrainingResultsTable)
              .where(
                eq(personalTrainingResultsTable.personalSessionId, existing.id),
              )
          : []
        const sourceItems = previous.filter(
          (item) => ids.has(item.id) && item.kind === "source",
        )
        const sourceScores = sourceItems.length
          ? await tx
              .select()
              .from(trainingResultsTable)
              .where(
                and(
                  eq(trainingResultsTable.userId, userId),
                  inArray(
                    trainingResultsTable.sessionId,
                    sourceItems.flatMap((item) =>
                      item.kind === "source" ? [item.sourceSessionId] : [],
                    ),
                  ),
                ),
              )
          : []
        if (
          scored.some((result) => ids.has(result.itemId)) ||
          sourceItems.some(
            (item) =>
              item.kind === "source" &&
              sourceScores.some(
                (result) =>
                  result.sessionId === item.sourceSessionId &&
                  result.blockId === item.sourceBlockId &&
                  result.publishedVersion === item.sourcePublishedVersion,
              ),
          )
        )
          throw new Error(
            "CONFLICT: This item has a score and cannot be undone",
          )
        data.items = previous.filter((item) => !ids.has(item.id))
      }
      if (data.items.length > 40)
        throw new Error("Your session can contain up to 40 sections")
      const previousResults = existing
        ? await tx
            .select()
            .from(personalTrainingResultsTable)
            .where(
              eq(personalTrainingResultsTable.personalSessionId, existing.id),
            )
        : []
      for (const item of data.items) {
        if (item.kind !== "personal" || !item.block.workout) continue
        const stored = previous.find(
          (old) => old.kind === "personal" && old.id === item.id,
        )
        const previousWorkout =
          stored?.kind === "personal" ? stored.block.workout : undefined
        await validateChangedWorkoutReferences(
          tx,
          item.block.workout,
          previousWorkout,
          data.teamId,
        )
      }
      const sourceRefs = data.items.flatMap((item) =>
        item.kind === "source"
          ? [item]
          : item.kind === "personal" && item.remixedFrom
            ? [item.remixedFrom]
            : [],
      )
      const sources = new Map<string, TrainingSession>()
      for (const sourceId of [
        ...new Set(sourceRefs.map((r) => r.sourceSessionId)),
      ].sort()) {
        const [source] = await tx
          .select()
          .from(trainingSessionsTable)
          .where(eq(trainingSessionsTable.id, sourceId))
          .for("update")
        if (
          !source ||
          source.teamId !== data.teamId ||
          !team.tracks.some((t) => t.id === source.trackId)
        )
          throw new Error(
            "FORBIDDEN: Source programming is not available to this gym",
          )
        sources.set(sourceId, { ...source, draft: null })
      }
      const resolveSource = (
        ref: TrainingSourceReference,
        id: string,
      ): PersonalTrainingItem => {
        const preserved = previous.find(
          (item) => item.kind === "source" && sourceMatches(item, ref),
        )
        if (preserved) return { ...preserved, id }
        const source = sources.get(ref.sourceSessionId)
        if (!source || source.publishedVersion !== ref.sourcePublishedVersion)
          throw new Error(
            "CONFLICT: Source programming changed. Refresh before adding it.",
          )
        return sourceItem(
          source,
          ref.sourceBlockId,
          team.tracks.find((t) => t.id === source.trackId)?.name ??
            "Programming",
          id,
        )
      }
      const items: PersonalTrainingItem[] = data.items.map(
        (item: PersonalTrainingItemInput) => {
          if (item.kind === "source") return resolveSource(item, item.id)
          if (item.kind === "library") {
            const preserved = previous.find(
              (old) =>
                old.id === item.id &&
                old.kind === "library" &&
                old.workoutId === item.workoutId,
            )
            if (preserved) return preserved
            const workout = library.get(item.id)
            if (!workout)
              throw new Error("NOT_FOUND: Library workout not found")
            return {
              ...item,
              workout,
              provenance: workout.provenance,
              occurrence: item.sourceTrackId
                ? { trackId: item.sourceTrackId, sourceDate: item.sourceDate }
                : undefined,
            }
          }
          if (item.remixedFrom) {
            const remixedFrom = item.remixedFrom
            const previousRemix = previous.find(
              (old) =>
                old.id === item.id &&
                old.kind === "personal" &&
                old.remixedFrom &&
                sourceMatches(old.remixedFrom, remixedFrom),
            )
            if (!previousRemix) resolveSource(item.remixedFrom, item.id)
          }
          return { ...item, block: { ...item.block, id: item.id } }
        },
      )
      for (const result of previousResults) {
        const before = previous.find((i) => i.id === result.itemId)
        const after = items.find((i) => i.id === result.itemId)
        if (
          result.legacyScoreId &&
          !result.libraryItem &&
          before?.kind === "library"
        ) {
          await tx
            .update(personalTrainingResultsTable)
            .set({ libraryItem: before })
            .where(eq(personalTrainingResultsTable.id, result.id))
        }
        if (after && JSON.stringify(before) !== JSON.stringify(after))
          throw new Error(
            "CONFLICT: This workout has a result. Add a new remix to change it.",
          )
      }
      const value = {
        id: existing?.id ?? ulid(),
        userId,
        teamId: data.teamId,
        trainingDate: data.trainingDate,
        revision: (existing?.revision ?? 0) + 1,
        compositionState: "customized" as const,
        items,
      }
      if (existing)
        await tx
          .update(personalTrainingSessionsTable)
          .set({
            items,
            revision: value.revision,
            compositionState: "customized",
          })
          .where(eq(personalTrainingSessionsTable.id, existing.id))
      else await tx.insert(personalTrainingSessionsTable).values(value)
      return personalSession(value as PersonalRow)
    })
  } catch (error) {
    const candidate = error as { code?: string; cause?: { code?: string } }
    if (
      candidate.code === "ER_DUP_ENTRY" ||
      candidate.cause?.code === "ER_DUP_ENTRY"
    )
      throw new Error(
        "CONFLICT: Your session was created elsewhere. Refresh before saving.",
      )
    throw error
  }
}

async function ownedSession(
  id: string,
): Promise<{ session: PersonalRow; userId: string }> {
  const [session] = await getDb()
    .select()
    .from(personalTrainingSessionsTable)
    .where(eq(personalTrainingSessionsTable.id, id))
  if (!session) throw new Error("NOT_FOUND: Personal session not found")
  const { userId } = await requireTrainingAccess(session.teamId)
  if (session.userId !== userId)
    throw new Error("FORBIDDEN: This session belongs to another athlete")
  return { session, userId }
}
async function storedLibraryResultItem(
  db: Pick<Db, "select">,
  personalSessionId: string,
  userId: string,
  itemId: string,
) {
  const [result] = await db
    .select({ libraryItem: personalTrainingResultsTable.libraryItem })
    .from(personalTrainingResultsTable)
    .where(
      and(
        eq(personalTrainingResultsTable.personalSessionId, personalSessionId),
        eq(personalTrainingResultsTable.userId, userId),
        eq(personalTrainingResultsTable.itemId, itemId),
      ),
    )
    .for("update")
  return result?.libraryItem ?? null
}

async function lockOwnedItem(
  tx: Tx,
  sessionId: string,
  userId: string,
  itemId: string,
  revision: number,
  includeHistoricalLibrary = false,
) {
  const [session] = await tx
    .select()
    .from(personalTrainingSessionsTable)
    .where(
      and(
        eq(personalTrainingSessionsTable.id, sessionId),
        eq(personalTrainingSessionsTable.userId, userId),
      ),
    )
    .for("update")
  if (!session) throw new Error("NOT_FOUND: Personal session not found")
  assertTrainingRevision(session.revision, revision)
  const currentItem = (session.items as PersonalTrainingItem[]).find(
    (i) => i.id === itemId,
  )
  const historicalItem = includeHistoricalLibrary
    ? await storedLibraryResultItem(tx, sessionId, userId, itemId)
    : null
  const item = historicalItem ?? currentItem
  if (!item) throw new Error("NOT_FOUND: Workout is no longer in your session")
  return { session, item }
}
export async function savePersonalTrainingResult(
  input: SavePersonalTrainingResultInput,
): Promise<OwnTrainingResult> {
  const data = personalTrainingResultSchema.parse(input)
  const { userId } = await ownedSession(data.personalSessionId)
  return getDb().transaction(async (tx) => {
    const { session, item } = await lockOwnedItem(
      tx,
      data.personalSessionId,
      userId,
      data.itemId,
      data.expectedRevision,
    )
    if (item.kind === "library")
      throw new Error(
        "Use the workout log to preserve this workout's scoring format",
      )
    const normalized = normalizeTrainingResult(item.block, {
      ...data,
      sessionId: session.id,
      blockId: item.id,
      publishedVersion: 1,
      scaling: "custom",
      modification: "",
      audience: "private",
    })
    const [existing] = await tx
      .select()
      .from(personalTrainingResultsTable)
      .where(
        and(
          eq(personalTrainingResultsTable.personalSessionId, session.id),
          eq(personalTrainingResultsTable.itemId, item.id),
        ),
      )
    const values = {
      id: existing?.id ?? ulid(),
      personalSessionId: session.id,
      itemId: item.id,
      userId,
      block: item.block,
      scoreValue: normalized.scoreValue,
      displayScore: normalized.displayScore,
      details: normalized.details ?? null,
      notes: data.notes,
      unit: data.unit,
      completed: data.completed,
      legacyScoreId: null,
    }
    await tx
      .insert(personalTrainingResultsTable)
      .values(values)
      .onDuplicateKeyUpdate({ set: values })
    return ownPersonalResult(values as ResultRow, session)
  })
}
export async function linkPersonalTrainingScore(input: {
  personalSessionId: string
  itemId: string
  expectedRevision: number
  scoreId: string
}): Promise<void> {
  const data = personalTrainingScoreLinkSchema.parse(input)
  const { userId } = await ownedSession(data.personalSessionId)
  await getDb().transaction(async (tx) => {
    const { session, item } = await lockOwnedItem(
      tx,
      data.personalSessionId,
      userId,
      data.itemId,
      data.expectedRevision,
    )
    if (item.kind !== "library")
      throw new Error("Only library workouts can link a workout log")
    const [score] = await tx
      .select()
      .from(scoresTable)
      .where(
        and(
          eq(scoresTable.id, data.scoreId),
          eq(scoresTable.userId, userId),
          eq(scoresTable.workoutId, item.workoutId),
          isNull(scoresTable.competitionEventId),
        ),
      )
    if (!score)
      throw new Error("FORBIDDEN: This score does not belong to your workout")
    if (score.recordedAt.toISOString().slice(0, 10) !== session.trainingDate)
      throw new Error("Choose a score recorded on this session's date")
    const [existing] = await tx
      .select()
      .from(personalTrainingResultsTable)
      .where(
        and(
          eq(personalTrainingResultsTable.personalSessionId, session.id),
          eq(personalTrainingResultsTable.itemId, item.id),
        ),
      )
    const values = {
      id: existing?.id ?? ulid(),
      personalSessionId: session.id,
      itemId: item.id,
      userId,
      block: null,
      libraryItem: existing?.libraryItem ?? item,
      scoreValue: null,
      displayScore: "Logged",
      notes: "",
      unit: "lb" as const,
      completed: true,
      legacyScoreId: score.id,
    }
    await tx
      .insert(personalTrainingResultsTable)
      .values(values)
      .onDuplicateKeyUpdate({ set: values })
  })
}

export async function savePersonalLibraryResult(input: {
  personalSessionId: string
  itemId: string
  expectedRevision: number
  score: string
  notes?: string
  asRx: boolean
  scalingLevelId?: string
  roundScores?: { score: string }[]
  replaceExisting?: boolean
  unit?: "lb" | "kg"
  tiebreakScore?: string
}) {
  const data = personalLibraryResultSchema.parse(input)
  const { userId } = await ownedSession(data.personalSessionId)
  return getDb().transaction(async (tx) => {
    const { session, item } = await lockOwnedItem(
      tx,
      data.personalSessionId,
      userId,
      data.itemId,
      data.expectedRevision,
      true,
    )
    return writePersonalLibraryResult(tx, session, item, userId, data)
  })
}

async function writePersonalLibraryResult(
  tx: Tx,
  session: PersonalRow,
  item: PersonalTrainingItem,
  userId: string,
  data: Omit<
    z.infer<typeof personalLibraryResultSchema>,
    "personalSessionId" | "expectedRevision"
  >,
) {
  if (item.kind !== "library")
    throw new Error("Use the session score entry for this workout")
  const [existing] = await tx
    .select()
    .from(personalTrainingResultsTable)
    .where(
      and(
        eq(personalTrainingResultsTable.personalSessionId, session.id),
        eq(personalTrainingResultsTable.itemId, item.id),
      ),
    )
    .for("update")
  if (existing?.legacyScoreId && !data.replaceExisting)
    return {
      success: true as const,
      scoreId: existing.legacyScoreId,
      formatted: existing.displayScore,
    }
  const workout = {
    ...item.workout,
    scoreType: item.workout.scoreType ?? null,
    timeCap: item.workout.timeCap ?? null,
  }
  const result = normalizePersonalLibraryScore(workout, data)
  const displayScore =
    `${result.formatted}${result.scheme === "load" ? ` ${data.unit ?? "lb"}` : ""}`.slice(
      0,
      100,
    )
  let groupId = workout.scalingGroupId ?? null
  if (!groupId) {
    const [group] = await tx
      .select()
      .from(scalingGroupsTable)
      .where(eq(scalingGroupsTable.isSystem, true))
      .limit(1)
    groupId = group?.id ?? null
  }
  if (!groupId) throw new Error("No scaling group available")
  const [level] = await tx
    .select()
    .from(scalingLevelsTable)
    .where(
      and(
        eq(scalingLevelsTable.scalingGroupId, groupId),
        data.scalingLevelId
          ? eq(scalingLevelsTable.id, data.scalingLevelId)
          : undefined,
      ),
    )
    .orderBy(asc(scalingLevelsTable.position))
    .limit(1)
  if (!level) throw new Error("Choose a scaling level for this workout")
  const scoreId = existing?.legacyScoreId ?? createScoreId()
  const scoreValues = {
    userId,
    teamId: session.teamId,
    workoutId: item.workoutId,
    scheme: result.scheme,
    scoreType: result.scoreType,
    scoreValue: result.scoreValue,
    status: result.status,
    statusOrder: result.statusOrder,
    sortKey: result.sortKey,
    scalingLevelId: level.id,
    asRx: data.asRx,
    notes: data.notes ?? null,
    recordedAt: new Date(`${session.trainingDate}T00:00:00Z`),
    timeCapMs: result.timeCapMs,
    secondaryValue: result.secondaryValue,
    tiebreakScheme: result.tiebreakScheme,
    tiebreakValue: result.tiebreakValue,
  }
  if (existing?.legacyScoreId) {
    const [linked] = await tx
      .select({ id: scoresTable.id })
      .from(scoresTable)
      .where(
        and(
          eq(scoresTable.id, scoreId),
          eq(scoresTable.userId, userId),
          eq(scoresTable.workoutId, item.workoutId),
          isNull(scoresTable.competitionEventId),
        ),
      )
      .for("update")
    if (!linked) throw new Error("NOT_FOUND: Linked personal score not found")
    await tx
      .update(scoresTable)
      .set(scoreValues)
      .where(eq(scoresTable.id, scoreId))
  } else await tx.insert(scoresTable).values({ id: scoreId, ...scoreValues })
  await writeWorkoutResultRounds(tx, scoreId, result.rounds, {
    replaceExisting: !!existing?.legacyScoreId,
  })
  for (const round of result.rounds)
    if (round.secondaryValue !== null)
      await tx
        .update(scoreRoundsTable)
        .set({ secondaryValue: round.secondaryValue })
        .where(
          and(
            eq(scoreRoundsTable.scoreId, scoreId),
            eq(scoreRoundsTable.roundNumber, round.roundNumber),
          ),
        )
  if (existing)
    await tx
      .update(personalTrainingResultsTable)
      .set({
        displayScore,
        legacyScoreId: scoreId,
        libraryItem: existing.libraryItem ?? item,
        notes: data.notes ?? "",
        unit: data.unit ?? "lb",
      })
      .where(eq(personalTrainingResultsTable.id, existing.id))
  else
    await tx.insert(personalTrainingResultsTable).values({
      id: ulid(),
      personalSessionId: session.id,
      itemId: item.id,
      userId,
      block: null,
      libraryItem: item,
      scoreValue: null,
      displayScore,
      notes: data.notes ?? "",
      unit: data.unit ?? "lb",
      completed: true,
      legacyScoreId: scoreId,
    })
  return { success: true as const, scoreId, formatted: result.formatted }
}

export async function saveDirectLibraryResult(
  input: z.infer<typeof directLibraryResultSchema>,
) {
  const data = directLibraryResultSchema.parse(input)
  const { userId } = await requireTrainingAccess(data.teamId)
  const workout = await getTrainingLibraryWorkout(data)
  return getDb().transaction(async (tx) => {
    // The unique day key serializes concurrent first attempts without changing a custom plan.
    const [present] = await tx
      .select()
      .from(personalTrainingSessionsTable)
      .where(
        and(
          eq(personalTrainingSessionsTable.userId, userId),
          eq(personalTrainingSessionsTable.teamId, data.teamId),
          eq(personalTrainingSessionsTable.trainingDate, data.trainingDate),
        ),
      )
    if (!present)
      await tx
        .insert(personalTrainingSessionsTable)
        .values({
          id: ulid(),
          userId,
          teamId: data.teamId,
          trainingDate: data.trainingDate,
          revision: 1,
          compositionState: "result_only",
          items: [],
        })
        .onDuplicateKeyUpdate({ set: { userId } })
    const [session] = await tx
      .select()
      .from(personalTrainingSessionsTable)
      .where(
        and(
          eq(personalTrainingSessionsTable.userId, userId),
          eq(personalTrainingSessionsTable.teamId, data.teamId),
          eq(personalTrainingSessionsTable.trainingDate, data.trainingDate),
        ),
      )
      .for("update")
    if (!session)
      throw new Error("Your result destination is no longer available")
    const historical = await storedLibraryResultItem(
      tx,
      session.id,
      userId,
      data.itemId,
    )
    const planned = (session.items as PersonalTrainingItem[]).find(
      (item) => item.id === data.itemId,
    )
    if (
      planned ||
      (historical &&
        (historical.workoutId !== workout.id ||
          historical.occurrence?.trackId !== data.sourceTrackId ||
          historical.occurrence?.sourceDate !== data.sourceDate))
    )
      throw new Error("CONFLICT: This attempt belongs to a different workout")
    return writePersonalLibraryResult(
      tx,
      session,
      historical ?? {
        id: data.itemId,
        kind: "library",
        workoutId: workout.id,
        workout,
        provenance: workout.provenance,
        occurrence: {
          trackId: data.sourceTrackId,
          sourceDate: data.sourceDate,
        },
      },
      userId,
      data,
    )
  })
}

export async function getDirectLibraryEntry(input: {
  teamId: string
  workoutId: string
  sourceTrackId?: string
  sourceDate?: string
}) {
  const workout = await getTrainingLibraryWorkout(input)
  const levels = workout.scalingGroupId
    ? await getDb()
        .select({
          id: scalingLevelsTable.id,
          label: scalingLevelsTable.label,
          position: scalingLevelsTable.position,
        })
        .from(scalingLevelsTable)
        .where(eq(scalingLevelsTable.scalingGroupId, workout.scalingGroupId))
        .orderBy(asc(scalingLevelsTable.position))
    : []
  return { workout, levels }
}

export async function getPersonalTrainingHistory(input: {
  teamId: string
}): Promise<OwnTrainingResult[]> {
  const { teamId } = trainingLibraryListSchema
    .pick({ teamId: true })
    .parse(input)
  const { userId } = await requireTrainingAccess(teamId)
  const rows = await getDb()
    .select({
      result: personalTrainingResultsTable,
      session: personalTrainingSessionsTable,
      score: scoresTable,
    })
    .from(personalTrainingResultsTable)
    .innerJoin(
      personalTrainingSessionsTable,
      eq(
        personalTrainingResultsTable.personalSessionId,
        personalTrainingSessionsTable.id,
      ),
    )
    .leftJoin(
      scoresTable,
      eq(personalTrainingResultsTable.legacyScoreId, scoresTable.id),
    )
    .where(
      and(
        eq(personalTrainingResultsTable.userId, userId),
        eq(personalTrainingSessionsTable.teamId, teamId),
      ),
    )
    .orderBy(
      desc(personalTrainingSessionsTable.trainingDate),
      desc(personalTrainingResultsTable.updatedAt),
    )
    .limit(100)
  return rows.flatMap(({ result, session, score }): OwnTrainingResult[] => {
    if (result.block) return [ownPersonalResult(result, session)]
    const item = result.libraryItem
    if (!item || !result.legacyScoreId) return []
    return [
      {
        id: result.id,
        sessionId: session.id,
        blockId: result.itemId,
        publishedVersion: 1,
        userId,
        userName: "You",
        trainingDate: session.trainingDate,
        trackId: item.provenance?.trackId ?? "",
        block: {
          id: result.itemId,
          kind: "note",
          title: item.workout.name,
          prescription: item.workout.description,
          coachGuidance: "",
          scalingGuidance: "",
        },
        scoreValue: result.scoreValue,
        displayScore: result.displayScore,
        scaling: score?.asRx ? "rx" : "scaled",
        modification: "",
        audience: "private",
        unit: result.unit,
        completed: true,
        cheerCount: 0,
        hasCheered: false,
        notes: score?.notes ?? result.notes,
        logScoreId: result.legacyScoreId,
        sourceLabel: item.provenance
          ? `${item.provenance.trackName} · Programmed ${item.provenance.sourceDate}`
          : "Workout library",
      },
    ]
  })
}

export async function getPersonalLibraryScalingLevels(input: {
  personalSessionId: string
  itemId: string
}) {
  const data = personalTrainingResultSchema
    .pick({ personalSessionId: true, itemId: true })
    .parse(input)
  const { session, userId } = await ownedSession(data.personalSessionId)
  const historicalItem = await storedLibraryResultItem(
    getDb(),
    session.id,
    userId,
    data.itemId,
  )
  const item =
    historicalItem ??
    (session.items as PersonalTrainingItem[]).find(
      (value) => value.id === data.itemId,
    )
  if (!item || item.kind !== "library")
    throw new Error("NOT_FOUND: Library workout is not in your session")
  let groupId = item.workout.scalingGroupId
  if (!groupId) {
    const [group] = await getDb()
      .select({ id: scalingGroupsTable.id })
      .from(scalingGroupsTable)
      .where(eq(scalingGroupsTable.isSystem, true))
      .limit(1)
    groupId = group?.id
  }
  if (!groupId) return { levels: [] }
  const levels = await getDb()
    .select({
      id: scalingLevelsTable.id,
      label: scalingLevelsTable.label,
      position: scalingLevelsTable.position,
    })
    .from(scalingLevelsTable)
    .where(eq(scalingLevelsTable.scalingGroupId, groupId))
    .orderBy(asc(scalingLevelsTable.position))
  return { levels }
}

async function providerSource(
  trackId: string,
  date: string,
): Promise<import("@/lib/training/types").TrainingSource> {
  const [day] = await getPublishedCrossFitDays(getDb(), trackId, {
    startDate: date,
    endDate: date,
  })
  return day ? { kind: "provider-day", day } : { kind: "unavailable" }
}
