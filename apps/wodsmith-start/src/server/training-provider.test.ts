import { createWodsmithDb, type WodsmithDb } from "@repo/wodsmith-db/mysql"
import {
  externalWorkoutImportItemsTable as importItems,
  externalWorkoutImportsTable as imports,
  scalingGroupsTable,
  scalingLevelsTable,
  scoreRoundsTable,
  scoresTable,
  teamProgrammingTracksTable as subscriptions,
  teamMembershipTable,
  teamTable,
  programmingTracksTable as tracks,
  userTable,
  workouts,
} from "@repo/wodsmith-db/schema"
import { trainingSessionsTable } from "@repo/wodsmith-db/schemas/training"
import {
  personalTrainingResultsTable,
  personalTrainingSessionsTable,
  trainingPreferencesTable,
} from "@repo/wodsmith-db/schemas/training-personal"
import { eq, inArray } from "drizzle-orm"
import mysql from "mysql2"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  db: null as unknown,
  userId: "provider_athlete",
  feature: true,
}))
vi.mock("@/db", () => ({ getDb: () => state.db }))
vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: async () => ({ userId: state.userId }),
}))
vi.mock("@/utils/team-auth", () => ({
  getActiveTeamId: async () => "provider_personal",
}))
vi.mock("@/server/entitlements", () => ({
  hasFeature: async () => state.feature,
}))

import { CROSSFIT_TRACK_ID } from "@/lib/crossfit/source"
import { getPublishedCrossFitDays } from "./crossfit-import"
import { getTrainingWeek } from "./training"
import {
  getPersonalTrainingDay,
  getPersonalTrainingHistory,
  saveDirectLibraryResult,
  getTrainingLibraryWorkout,
  savePersonalLibraryResult,
  savePersonalTrainingSession,
} from "./training-personal"

const url = process.env.TRAINING_TEST_DATABASE_URL
const day = { teamId: "provider_personal", trainingDate: "2026-09-04" }
describe.skipIf(!url)("provider projection and persistence", () => {
  let db: WodsmithDb
  let pool: ReturnType<typeof mysql.createPool>
  beforeAll(async () => {
    if (!url) throw new Error("Local test database required")
    const parsed = new URL(url)
    if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/training_test")
      throw new Error("Use a disposable local training_test database")
    pool = mysql.createPool(url)
    db = createWodsmithDb(pool)
    state.db = db
    await db
      .insert(userTable)
      .values({ id: state.userId, firstName: "Provider" })
    await db.insert(teamTable).values([
      {
        id: day.teamId,
        name: "My training",
        slug: day.teamId,
        isPersonalTeam: true,
        personalTeamOwnerId: state.userId,
      },
      { id: "provider_owner", name: "Source owner", slug: "provider-owner" },
    ])
    await db.insert(teamMembershipTable).values({
      id: "provider_member",
      userId: state.userId,
      teamId: day.teamId,
      roleId: "owner",
    })
    await db.insert(tracks).values({
      id: CROSSFIT_TRACK_ID,
      name: "CrossFit.com",
      ownerTeamId: "provider_owner",
      type: "official_3rd_party",
      isPublic: 1,
    })
    await db
      .insert(subscriptions)
      .values({ teamId: day.teamId, trackId: CROSSFIT_TRACK_ID, isActive: 1 })
    await db
      .insert(scalingGroupsTable)
      .values({ id: "provider_scaling", title: "Scaling", isSystem: true })
    await db.insert(scalingLevelsTable).values({
      id: "provider_rx",
      scalingGroupId: "provider_scaling",
      label: "Rx",
      position: 0,
    })
    await db.insert(workouts).values([
      {
        id: "provider_cap",
        name: "Timed",
        description: "For time",
        scheme: "time-with-cap",
        timeCap: 180,
        roundsToScore: 1,
        scoreType: "min",
        scope: "public",
      },
      {
        id: "provider_load",
        name: "Lift",
        description: "Three sets",
        scheme: "load",
        roundsToScore: 3,
        scoreType: "max",
        scope: "public",
      },
    ])
    await db.insert(imports).values([
      {
        id: "provider_import_work",
        workflowId: "provider-workflow",
        provider: "crossfit",
        trackId: CROSSFIT_TRACK_ID,
        sourceDate: "2026-09-04",
        sourceUrl: "https://www.crossfit.com/260904",
        status: "published",
        kind: "workout",
        sourceMarkdown: "For time, then lift",
      },
      {
        id: "provider_import_rest",
        workflowId: "provider-workflow",
        provider: "crossfit",
        trackId: CROSSFIT_TRACK_ID,
        sourceDate: "2026-09-06",
        sourceUrl: "https://www.crossfit.com/260906",
        status: "published",
        kind: "rest",
      },
      {
        id: "provider_private",
        workflowId: "provider-workflow",
        provider: "crossfit",
        trackId: CROSSFIT_TRACK_ID,
        sourceDate: "2026-09-05",
        sourceUrl: "https://www.crossfit.com/260905",
        status: "needs_review",
        kind: "workout",
        error: "private diagnostic",
      },
    ])
    await db.insert(importItems).values([
      {
        id: "provider_item_1",
        importId: "provider_import_work",
        componentIndex: 0,
        workoutId: "provider_cap",
        trackWorkoutId: "provider_link_1",
      },
      {
        id: "provider_item_2",
        importId: "provider_import_work",
        componentIndex: 1,
        workoutId: "provider_load",
        trackWorkoutId: "provider_link_2",
      },
    ])
  })
  afterAll(async () => {
    if (!pool) return
    await db
      .delete(personalTrainingResultsTable)
      .where(eq(personalTrainingResultsTable.userId, state.userId))
    await db
      .delete(personalTrainingSessionsTable)
      .where(eq(personalTrainingSessionsTable.userId, state.userId))
    await db
      .delete(trainingPreferencesTable)
      .where(eq(trainingPreferencesTable.userId, state.userId))
    await db
      .delete(trainingSessionsTable)
      .where(eq(trainingSessionsTable.teamId, day.teamId))
    const fixtureScores = await db
      .select({ id: scoresTable.id })
      .from(scoresTable)
      .where(eq(scoresTable.userId, state.userId))
    if (fixtureScores.length)
      await db.delete(scoreRoundsTable).where(
        inArray(
          scoreRoundsTable.scoreId,
          fixtureScores.map((score) => score.id),
        ),
      )
    await db.delete(scoresTable).where(eq(scoresTable.userId, state.userId))
    await db
      .delete(importItems)
      .where(
        inArray(importItems.importId, [
          "provider_import_work",
          "provider_import_rest",
          "provider_private",
        ]),
      )
    await db.delete(imports).where(eq(imports.trackId, CROSSFIT_TRACK_ID))
    await db
      .delete(workouts)
      .where(inArray(workouts.id, ["provider_cap", "provider_load"]))
    await db
      .delete(scalingLevelsTable)
      .where(eq(scalingLevelsTable.id, "provider_rx"))
    await db
      .delete(scalingGroupsTable)
      .where(eq(scalingGroupsTable.id, "provider_scaling"))
    await db.delete(subscriptions).where(eq(subscriptions.teamId, day.teamId))
    await db.delete(tracks).where(eq(tracks.id, CROSSFIT_TRACK_ID))
    await db
      .delete(teamMembershipTable)
      .where(eq(teamMembershipTable.teamId, day.teamId))
    await db
      .delete(teamTable)
      .where(inArray(teamTable.id, [day.teamId, "provider_owner"]))
    await db.delete(userTable).where(eq(userTable.id, state.userId))
    await pool.promise().end()
  })
  // @lat: [[training#Provider Verification#Read-only dates and precedence]]
  it("projects published dates without writes and gives only published coaching precedence", async () => {
    const insert = vi.spyOn(db, "insert")
    const week = await getTrainingWeek({
      teamId: day.teamId,
      trackId: CROSSFIT_TRACK_ID,
      startDate: "2026-08-31",
      mode: "athlete",
    })
    expect(week.providerDays?.map((d) => d.kind)).toEqual(["rest", "workout"])
    expect(
      (await getPersonalTrainingDay({ ...day, trackId: CROSSFIT_TRACK_ID }))
        .source?.kind,
    ).toBe("provider-day")
    expect(
      (
        await getPersonalTrainingDay({
          ...day,
          trainingDate: "2026-09-05",
          trackId: CROSSFIT_TRACK_ID,
        })
      ).source,
    ).toEqual({ kind: "unavailable" })
    expect(insert).not.toHaveBeenCalled()
    insert.mockRestore()
    const content = {
      title: "Coach",
      coachNote: "",
      isRestDay: false,
      blocks: [],
    }
    await db.insert(trainingSessionsTable).values({
      id: "provider_draft",
      teamId: day.teamId,
      trackId: CROSSFIT_TRACK_ID,
      trainingDate: day.trainingDate,
      timezone: "UTC",
      draft: content,
    })
    expect(
      (await getPersonalTrainingDay({ ...day, trackId: CROSSFIT_TRACK_ID }))
        .source?.kind,
    ).toBe("provider-day")
    await db
      .update(trainingSessionsTable)
      .set({ published: content, publishedVersion: 1 })
      .where(eq(trainingSessionsTable.id, "provider_draft"))
    expect(
      (await getPersonalTrainingDay({ ...day, trackId: CROSSFIT_TRACK_ID }))
        .source?.kind,
    ).toBe("coach-session")
    expect(
      (
        await getTrainingWeek({
          teamId: day.teamId,
          trackId: CROSSFIT_TRACK_ID,
          startDate: "2026-08-31",
          mode: "athlete",
        })
      ).providerDays?.map((d) => d.kind),
    ).toEqual(["rest"])
    expect(
      await getPublishedCrossFitDays(db, CROSSFIT_TRACK_ID, {
        startDate: "2026-09-04",
        endDate: "2026-09-04",
      }),
    ).toHaveLength(1)
  })
  // @lat: [[training-personal#Verification#Provider snapshot and atomic additions]]
  it("atomically stores ordered rich components and server provenance on the performed date", async () => {
    const detail = await getTrainingLibraryWorkout({
      teamId: day.teamId,
      workoutId: "provider_cap",
    })
    expect(detail).toMatchObject({
      scheme: "time-with-cap",
      timeCap: 180,
      roundsToScore: 1,
      movementIds: [],
      scalingGroupId: "provider_scaling",
      provenance: {
        importId: "provider_import_work",
        sourceDate: "2026-09-04",
        trackId: CROSSFIT_TRACK_ID,
      },
    })
    const performed = { ...day, trainingDate: "2026-09-07" }
    const items = [
      { id: "cap", kind: "library" as const, workoutId: "provider_cap" },
      { id: "load", kind: "library" as const, workoutId: "provider_load" },
    ]
    const session = await savePersonalTrainingSession({
      ...performed,
      expectedRevision: 0,
      items,
    })
    expect(
      session.items.map(
        (item) => item.kind === "library" && item.provenance?.sourceDate,
      ),
    ).toEqual(["2026-09-04", "2026-09-04"])
    expect(session.items[1]).toMatchObject({
      workout: { roundsToScore: 3, scoreType: "max" },
    })
    await expect(
      savePersonalTrainingSession({ ...performed, expectedRevision: 0, items }),
    ).rejects.toThrow("CONFLICT")
    await expect(
      savePersonalTrainingSession({
        ...performed,
        expectedRevision: 1,
        items: Array.from({ length: 41 }, (_, i) => ({
          ...items[0],
          id: `item_${i}`,
        })),
      }),
    ).rejects.toThrow()
    await savePersonalLibraryResult({
      personalSessionId: session.id,
      itemId: "cap",
      expectedRevision: 1,
      score: "CAP+35",
      notes: "",
      asRx: true,
    })
    await savePersonalLibraryResult({
      personalSessionId: session.id,
      itemId: "load",
      expectedRevision: 1,
      score: "",
      notes: "",
      asRx: true,
      roundScores: [{ score: "185" }, { score: "205" }, { score: "225" }],
    })
    const savedScores = await db
      .select()
      .from(scoresTable)
      .where(eq(scoresTable.userId, state.userId))
    expect(savedScores).toHaveLength(2)
    expect(
      await db
        .select()
        .from(scoreRoundsTable)
        .where(
          inArray(
            scoreRoundsTable.scoreId,
            savedScores.map((score) => score.id),
          ),
        ),
    ).toHaveLength(3)
    await db
      .update(subscriptions)
      .set({ isActive: 0 })
      .where(eq(subscriptions.teamId, day.teamId))
    expect((await getPersonalTrainingDay(performed)).selectedTrackId).toBeNull()
    expect((await getPersonalTrainingDay(performed)).items).toHaveLength(2)
    await db
      .update(workouts)
      .set({ description: "Changed source" })
      .where(eq(workouts.id, "provider_cap"))
    await db.delete(workouts).where(eq(workouts.id, "provider_load"))
    await savePersonalTrainingSession({
      ...performed,
      expectedRevision: 1,
      items,
    })
    expect((await getPersonalTrainingDay(performed)).items[1]).toMatchObject({
      workout: { description: "Three sets" },
    })
    const history = await db
      .select()
      .from(personalTrainingResultsTable)
      .where(eq(personalTrainingResultsTable.userId, state.userId))
    expect(history).toHaveLength(2)
    expect(
      history.every(
        (result) => result.libraryItem?.provenance?.sourceDate === "2026-09-04",
      ),
    ).toBe(true)
  })
  it("reads a selected date independently of the sixty-day archive", async () => {
    await db.insert(imports).values(
      Array.from({ length: 61 }, (_, index) => {
        const date = new Date(Date.UTC(2027, 0, index + 1))
          .toISOString()
          .slice(0, 10)
        return {
          id: `provider_archive_${index}`,
          workflowId: "provider-workflow",
          provider: "crossfit",
          trackId: CROSSFIT_TRACK_ID,
          sourceDate: date,
          sourceUrl: "https://www.crossfit.com/270101",
          status: "published" as const,
          kind: "rest" as const,
        }
      }),
    )
    expect(await getPublishedCrossFitDays(db, CROSSFIT_TRACK_ID)).toHaveLength(
      60,
    )
    const selected = await getPublishedCrossFitDays(db, CROSSFIT_TRACK_ID, {
      startDate: "2026-09-06",
      endDate: "2026-09-06",
    })
    expect(selected.map((day) => day.date)).toEqual(["2026-09-06"])
  })
  // @lat: [[training-personal#Verification#Repeated provider workout occurrences]]
  it("keeps a reused workout on different programmed dates distinct and rejects unpublished provenance", async () => {
    await db
      .insert(imports)
      .values({
        id: "provider_repeat",
        workflowId: "provider-workflow",
        provider: "crossfit",
        trackId: CROSSFIT_TRACK_ID,
        sourceDate: "2026-09-07",
        sourceUrl: "https://www.crossfit.com/260907",
        status: "published",
        kind: "workout",
      })
    await db
      .insert(importItems)
      .values({
        id: "provider_repeat_item",
        importId: "provider_repeat",
        componentIndex: 0,
        workoutId: "provider_cap",
        trackWorkoutId: "provider_repeat_link",
      })
    try {
      const destination = { ...day, trainingDate: "2026-09-10" }
      const firstItem = {
        id: "first-date",
        kind: "library" as const,
        workoutId: "provider_cap",
        sourceTrackId: CROSSFIT_TRACK_ID,
        sourceDate: "2026-09-04",
      }
      const first = await savePersonalTrainingSession({
        ...destination,
        expectedRevision: 0,
        mode: "append",
        items: [firstItem],
      })
      const retried = await savePersonalTrainingSession({
        ...destination,
        expectedRevision: 0,
        mode: "append",
        items: [{ ...firstItem, id: "different-tab" }],
      })
      expect(retried).toEqual(first)
      const second = await savePersonalTrainingSession({
        ...destination,
        expectedRevision: first.revision,
        mode: "append",
        items: [{ ...firstItem, id: "second-date", sourceDate: "2026-09-07" }],
      })
      expect(second.items).toMatchObject([
        {
          id: "first-date",
          occurrence: { sourceDate: "2026-09-04" },
          provenance: { importId: "provider_import_work" },
        },
        {
          id: "second-date",
          occurrence: { sourceDate: "2026-09-07" },
          provenance: { importId: "provider_repeat" },
        },
      ])
      await expect(
        savePersonalTrainingSession({
          ...destination,
          expectedRevision: second.revision,
          mode: "append",
          items: [{ ...firstItem, id: "draft-date", sourceDate: "2026-09-05" }],
        }),
      ).rejects.toThrow("FORBIDDEN")
      expect(
        (await getPersonalTrainingDay(destination)).personalSession?.revision,
      ).toBe(second.revision)
    } finally {
      await db
        .delete(importItems)
        .where(eq(importItems.id, "provider_repeat_item"))
      await db.delete(imports).where(eq(imports.id, "provider_repeat"))
    }
  })
  // @lat: [[session-review-tests#Legacy provider identity persists without rescoping library work]]
  it("deduplicates legacy provider snapshots while keeping new unscoped library additions separate", async () => {
    const destination = { ...day, trainingDate: "2026-09-12" }
    const input = {
      id: "legacy-provider",
      kind: "library" as const,
      workoutId: "provider_cap",
      sourceTrackId: CROSSFIT_TRACK_ID,
      sourceDate: "2026-09-04",
    }
    const first = await savePersonalTrainingSession({
      ...destination,
      mode: "append",
      expectedRevision: 0,
      items: [input],
    })
    const legacy = first.items.map((item) => {
      if (item.kind !== "library") return item
      const { occurrence: _, ...snapshot } = item
      return snapshot
    })
    await db
      .update(personalTrainingSessionsTable)
      .set({ items: legacy })
      .where(eq(personalTrainingSessionsTable.id, first.id))
    const duplicate = await savePersonalTrainingSession({
      ...destination,
      mode: "append",
      expectedRevision: first.revision,
      items: [{ ...input, id: "another-entry" }],
    })
    expect(duplicate.items).toHaveLength(1)
    expect(duplicate.items[0].id).toBe("legacy-provider")
    expect(duplicate.revision).toBe(first.revision)
    const unscoped = await savePersonalTrainingSession({
      ...destination,
      mode: "append",
      expectedRevision: first.revision,
      items: [{ id: "unscoped", kind: "library", workoutId: "provider_cap" }],
    })
    expect(unscoped.items).toHaveLength(2)
    expect(unscoped.items[1]).toMatchObject({ occurrence: {} })
    const reloaded = (await getPersonalTrainingDay(destination)).personalSession!
    expect(
      Object.keys((reloaded.items[1] as { occurrence: object }).occurrence),
    ).toHaveLength(0)
    const scored = await savePersonalLibraryResult({
      personalSessionId: first.id,
      itemId: "legacy-provider",
      expectedRevision: unscoped.revision,
      score: "CAP+0",
      asRx: true,
    })
    expect(
      (await getPersonalTrainingDay(destination)).libraryResults,
    ).toContainEqual(
      expect.objectContaining({
        itemId: "legacy-provider",
        scoreId: scored.scoreId,
      }),
    )
  })

  // @lat: [[session-review-tests#History retains explicit occurrence without provider metadata]]
  it("retains source dates and track identity from owned occurrence metadata alone", async () => {
    const destination = { ...day, trainingDate: "2026-09-13" }
    await db
      .update(subscriptions)
      .set({ isActive: 1 })
      .where(eq(subscriptions.teamId, day.teamId))
    await saveDirectLibraryResult({
      ...destination,
      workoutId: "provider_cap",
      sourceTrackId: CROSSFIT_TRACK_ID,
      sourceDate: "2026-09-04",
      itemId: "occurrence-only",
      score: "CAP+0",
      asRx: true,
    })
    const [association] = await db
      .select()
      .from(personalTrainingResultsTable)
      .where(eq(personalTrainingResultsTable.itemId, "occurrence-only"))
    const item = association.libraryItem!
    const { provenance: _, ...saved } = item
    await db
      .update(personalTrainingResultsTable)
      .set({ libraryItem: saved })
      .where(eq(personalTrainingResultsTable.id, association.id))
    expect(
      await getPersonalTrainingHistory({ teamId: day.teamId }),
    ).toContainEqual(
      expect.objectContaining({
        blockId: "occurrence-only",
        trackId: CROSSFIT_TRACK_ID,
        sourceLabel: "Programmed 2026-09-04",
      }),
    )
    await db
      .update(subscriptions)
      .set({ isActive: 0 })
      .where(eq(subscriptions.teamId, day.teamId))
    await db
      .update(tracks)
      .set({ isPublic: 0, ownerTeamId: "provider_foreign" })
      .where(eq(tracks.id, CROSSFIT_TRACK_ID))
    try {
      const history = await getPersonalTrainingHistory({ teamId: day.teamId })
      expect(history).toContainEqual(
        expect.objectContaining({
          blockId: "occurrence-only",
          trackId: "",
          sourceLabel: "Programmed 2026-09-04",
          displayScore: "CAP+0",
        }),
      )
    } finally {
      await db
        .update(subscriptions)
        .set({ isActive: 1 })
        .where(eq(subscriptions.teamId, day.teamId))
      await db
        .update(tracks)
        .set({ isPublic: 1, ownerTeamId: null })
        .where(eq(tracks.id, CROSSFIT_TRACK_ID))
    }
  })

  // @lat: [[session-navigation-tests#Real append context and retry contract]]
  it("keeps separate destinations and source occurrences while rejecting reused intent payloads", async () => {
    await db.insert(imports).values({
      id: "context-import",
      workflowId: "provider-workflow",
      provider: "crossfit",
      trackId: CROSSFIT_TRACK_ID,
      sourceDate: "2026-09-14",
      sourceUrl: "https://www.crossfit.com/260914",
      status: "published",
      kind: "workout",
    })
    await db.insert(importItems).values({
      id: "context-import-item",
      importId: "context-import",
      componentIndex: 0,
      workoutId: "provider_cap",
      trackWorkoutId: "context-link",
    })
    const destination = { ...day, trainingDate: "2026-09-20" }
    const a = {
      id: "context-a",
      kind: "library" as const,
      workoutId: "provider_cap",
      sourceTrackId: CROSSFIT_TRACK_ID,
      sourceDate: "2026-09-04",
    }
    try {
      const first = await savePersonalTrainingSession({
        ...destination,
        mode: "append",
        expectedRevision: 0,
        items: [a],
      })
      await expect(
        savePersonalTrainingSession({
          ...destination,
          mode: "append",
          expectedRevision: first.revision,
          items: [{ ...a, sourceDate: "2026-09-14" }],
        }),
      ).rejects.toThrow("CONFLICT")
      const second = await savePersonalTrainingSession({
        ...destination,
        mode: "append",
        expectedRevision: first.revision,
        items: [{ ...a, id: "context-b", sourceDate: "2026-09-14" }],
      })
      expect(second.items.map((item) => item.id)).toEqual([
        "context-a",
        "context-b",
      ])
      expect(
        await savePersonalTrainingSession({
          ...destination,
          mode: "append",
          expectedRevision: 0,
          items: [a],
        }),
      ).toEqual(second)
      const repeated = await savePersonalTrainingSession({
        ...destination,
        mode: "append",
        allowDuplicate: true,
        expectedRevision: second.revision,
        items: [{ ...a, id: "repeat-intent" }],
      })
      expect(repeated.items).toHaveLength(3)
      expect(
        await savePersonalTrainingSession({
          ...destination,
          mode: "append",
          allowDuplicate: true,
          expectedRevision: second.revision,
          items: [{ ...a, id: "repeat-intent" }],
        }),
      ).toEqual(repeated)
      const tomorrow = await savePersonalTrainingSession({
        ...destination,
        trainingDate: "2026-09-21",
        mode: "append",
        expectedRevision: 0,
        items: [a],
      })
      expect(tomorrow.items).toHaveLength(1)
      expect((await getPersonalTrainingDay(destination)).personalSession).toEqual(
        repeated,
      )
    } finally {
      await db
        .delete(importItems)
        .where(eq(importItems.id, "context-import-item"))
      await db.delete(imports).where(eq(imports.id, "context-import"))
    }
  })

})
