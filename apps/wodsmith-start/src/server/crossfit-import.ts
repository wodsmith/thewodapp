import type { WodsmithDb } from "@repo/wodsmith-db/mysql"
import { and, asc, desc, eq, inArray, max, ne } from "drizzle-orm"
import {
  externalWorkoutImportsTable as imports,
  externalWorkoutImportItemsTable as items,
  trackWorkoutsTable as links,
  programmingTracksTable as tracks,
  workouts,
} from "@/db/schema"
import { validateCrossFitConversion } from "@/lib/crossfit/conversion"
import { CrossFitImportReviewError } from "@/lib/crossfit/errors"
import {
  CROSSFIT_OWNER_TEAM_ID,
  CROSSFIT_PARSER_VERSION,
  CROSSFIT_TRACK_ID,
  type CrossFitSource,
  crossFitSourceUrl,
  sourceDateSchema,
} from "@/lib/crossfit/source"

export function crossFitImportId(date: string) {
  return `cf-import-${sourceDateSchema.parse(date)}`
}

export async function getCrossFitImport(db: WodsmithDb, date: string) {
  return (
    (
      await db
        .select()
        .from(imports)
        .where(eq(imports.id, crossFitImportId(date)))
        .limit(1)
    )[0] ?? null
  )
}

export async function beginCrossFitImport(
  db: WodsmithDb,
  date: string,
  workflowId: string,
) {
  const id = crossFitImportId(date)
  await db
    .insert(imports)
    .values({
      id,
      provider: "crossfit",
      trackId: CROSSFIT_TRACK_ID,
      sourceDate: date,
      sourceUrl: crossFitSourceUrl(date),
      workflowId,
      status: "pending",
    })
    .onDuplicateKeyUpdate({ set: { id } })
  return getCrossFitImport(db, date)
}

export async function snapshotCrossFitImport(
  db: WodsmithDb,
  source: CrossFitSource,
) {
  await db
    .update(imports)
    .set({
      sourceId: source.sourceId,
      sourceModified: source.modified,
      sourceHash: source.hash,
      sourceMarkdown: source.markdown,
      parserVersion: CROSSFIT_PARSER_VERSION,
    })
    .where(
      and(
        eq(imports.id, crossFitImportId(source.date)),
        ne(imports.status, "published"),
      ),
    )
}

export async function failCrossFitImport(
  db: WodsmithDb,
  date: string,
  status: "failed" | "needs_review",
  error: string,
) {
  await db
    .update(imports)
    .set({ status, error: error.slice(0, 2000) })
    .where(
      and(
        eq(imports.id, crossFitImportId(date)),
        ne(imports.status, "published"),
      ),
    )
}

// @lat: [[crossfit-import#CrossFit Daily Import#Publication]]
export async function publishCrossFitImport(
  db: WodsmithDb,
  source: CrossFitSource,
  value: unknown,
  model: string | null,
) {
  const normalized = validateCrossFitConversion(value, source)
  return db.transaction(async (tx) => {
    const [entry] = await tx
      .select()
      .from(imports)
      .where(eq(imports.id, crossFitImportId(source.date)))
      .for("update")
    if (!entry) throw new Error("Import must be initialized before publication")
    if (entry.status === "published")
      return { id: entry.id, alreadyPublished: true }
    const [track] = await tx
      .select()
      .from(tracks)
      .where(eq(tracks.id, CROSSFIT_TRACK_ID))
      .for("update")
    if (
      !track ||
      track.type !== "official_3rd_party" ||
      track.isPublic !== 1 ||
      track.competitionId ||
      track.ownerTeamId !== CROSSFIT_OWNER_TEAM_ID
    ) {
      throw new Error(
        "CrossFit destination track does not match the configured production identity",
      )
    }
    if (entry.sourceHash !== source.hash)
      throw new CrossFitImportReviewError(
        "Source changed during import; restart for review",
      )
    const [last] = await tx
      .select({ order: max(links.trackOrder) })
      .from(links)
      .where(eq(links.trackId, track.id))
    const nextOrder = Math.floor(Number(last?.order ?? 0)) + 1
    if (nextOrder + normalized.components.length - 1 > 9999)
      throw new Error("Track order capacity reached")
    for (const [index, component] of normalized.components.entries()) {
      const workoutId = `cf-${source.date}-${index + 1}`
      const trackWorkoutId = `cf-track-${source.date}-${index + 1}`
      const scoreLabel =
        component.scheme === "load"
          ? "Load"
          : component.scheme.startsWith("time")
            ? "Time"
            : component.scheme
      await tx.insert(workouts).values({
        id: workoutId,
        name: `CrossFit.com ${source.date}${normalized.components.length > 1 ? ` · ${index + 1}: ${scoreLabel}` : ""}`,
        description: `${normalized.components.length > 1 ? `**Score for this entry: ${scoreLabel}.**\n\n` : ""}${source.markdown}\n\n[Source: CrossFit.com](${source.url})`,
        scope: "public",
        scheme: component.scheme,
        scoreType: component.scoreType,
        roundsToScore: component.roundsToScore,
        timeCap: component.timeCap,
        sourceTrackId: track.id,
        teamId: track.ownerTeamId,
      })
      await tx.insert(links).values({
        id: trackWorkoutId,
        trackId: track.id,
        workoutId,
        trackOrder: nextOrder + index,
        notes: `CrossFit.com WOD for ${source.date}`,
        eventStatus: "published",
      })
      await tx.insert(items).values({
        id: `${entry.id}-${index}`,
        importId: entry.id,
        componentIndex: index,
        workoutId,
        trackWorkoutId,
      })
    }
    await tx
      .update(imports)
      .set({
        normalized,
        model,
        kind: normalized.kind,
        status: "published",
        error: null,
        publishedAt: new Date(),
      })
      .where(eq(imports.id, entry.id))
    return { id: entry.id, alreadyPublished: false }
  })
}

// @lat: [[crossfit-import#CrossFit Daily Import#Dated Track Feed]]
export async function getPublishedCrossFitDays(
  db: WodsmithDb,
  trackId: string,
) {
  if (trackId !== CROSSFIT_TRACK_ID) return []
  const days = await db
    .select({
      id: imports.id,
      date: imports.sourceDate,
      url: imports.sourceUrl,
      kind: imports.kind,
      markdown: imports.sourceMarkdown,
    })
    .from(imports)
    .where(and(eq(imports.trackId, trackId), eq(imports.status, "published")))
    .orderBy(desc(imports.sourceDate))
    .limit(60)
  if (!days.length) return []
  const publishedItems = await db
    .select({
      importId: items.importId,
      workoutId: workouts.id,
      name: workouts.name,
      scheme: workouts.scheme,
    })
    .from(items)
    .innerJoin(imports, eq(imports.id, items.importId))
    .innerJoin(workouts, eq(workouts.id, items.workoutId))
    .where(
      and(
        inArray(
          items.importId,
          days.map((day) => day.id),
        ),
        eq(imports.status, "published"),
      ),
    )
    .orderBy(asc(items.componentIndex))
  return days.map((day) => ({
    ...day,
    workouts: publishedItems.filter((item) => item.importId === day.id),
  }))
}
