import { createWodsmithDb, type WodsmithDb } from "@repo/wodsmith-db/mysql"
import {
  programmingTracksTable,
  teamMembershipTable,
  teamProgrammingTracksTable,
  teamTable,
  userTable,
} from "@repo/wodsmith-db/schema"
import {
  trainingCheersTable,
  trainingResultsTable,
  trainingSessionsTable,
} from "@repo/wodsmith-db/schemas/training"
import { eq, inArray } from "drizzle-orm"
import mysql from "mysql2"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import type {
  SaveTrainingDraftInput,
  SaveTrainingResultInput,
  TrainingBlock,
  TrainingContent,
  TrainingSession,
} from "@/lib/training/types"
import {
  assertTrainingRevision,
  normalizeTrainingResult,
  publishedTrainingBlock,
  trainingContentSchema,
  trainingDateSchema,
  trainingDraftInputSchema,
  trainingResultInputSchema,
  trainingTimezone,
} from "./training-validation"

const state = vi.hoisted(() => ({
  userId: "training_test_coach",
  feature: true,
  db: null as unknown,
}))
vi.mock("@/db", () => ({ getDb: () => state.db }))
vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: async () =>
    state.userId ? { userId: state.userId } : null,
}))
vi.mock("@/utils/team-auth", () => ({
  getActiveTeamId: async () => "training_test_gym",
}))
vi.mock("@/server/entitlements", () => ({
  hasFeature: async () => state.feature,
}))

import {
  copyTrainingSession,
  getTrainingContext,
  getTrainingHistory,
  getTrainingWeek,
  publishTrainingSession,
  saveTrainingDraft,
  saveTrainingResult,
  setTrainingCheer,
} from "./training"

const block: TrainingBlock = {
  id: "test_block",
  kind: "load",
  title: "Front squat",
  prescription: "Build to a heavy triple",
  coachGuidance: "Keep the elbows high",
  scalingGuidance: "Use a box if needed",
}
const content: TrainingContent = {
  title: "Strength day",
  coachNote: "Move well",
  isRestDay: false,
  blocks: [block],
}
const draft: SaveTrainingDraftInput = {
  teamId: "training_test_gym",
  trackId: "training_test_track",
  trainingDate: "2026-09-05",
  timezone: "America/Boise",
  expectedRevision: 0,
  content,
}
const score: SaveTrainingResultInput = {
  sessionId: "session",
  blockId: block.id,
  publishedVersion: 1,
  score: "225",
  scaling: "rx",
  modification: "",
  notes: "Private recovery detail",
  audience: "gym",
  unit: "lb",
  completed: true,
}
const session: TrainingSession = {
  id: "session",
  teamId: draft.teamId,
  trackId: draft.trackId,
  trainingDate: draft.trainingDate,
  timezone: draft.timezone,
  revision: 2,
  publishedVersion: 1,
  draft: null,
  published: content,
}

describe("training input and score rules", () => {
  it("rejects nonexistent calendar dates and accepts leap day", () => {
    expect(trainingDateSchema.safeParse("2026-02-30").success).toBe(false)
    expect(trainingDateSchema.safeParse("2024-02-29").success).toBe(true)
    expect(trainingDateSchema.safeParse("2026-09-05T00:00:00Z").success).toBe(
      false,
    )
  })

  it("validates IANA zones and discloses UTC as the fallback without changing settings", () => {
    expect(trainingTimezone('{"timezone":"America/Boise"}')).toBe(
      "America/Boise",
    )
    expect(trainingTimezone('{"timezone":"Mars/Base"}')).toBe("UTC")
    expect(trainingTimezone("broken json")).toBe("UTC")
    expect(
      trainingDraftInputSchema.safeParse({ ...draft, timezone: "Mars/Base" })
        .success,
    ).toBe(false)
  })

  it("allows incomplete drafts but rejects duplicated blocks, excess blocks and oversized text", () => {
    expect(
      trainingContentSchema.safeParse({
        ...content,
        title: "",
        blocks: [{ ...block, title: "" }],
      }).success,
    ).toBe(true)
    expect(
      trainingContentSchema.safeParse({ ...content, blocks: [block, block] })
        .success,
    ).toBe(false)
    expect(
      trainingContentSchema.safeParse({
        ...content,
        blocks: Array.from({ length: 21 }, (_, i) => ({
          ...block,
          id: String(i),
        })),
      }).success,
    ).toBe(false)
    expect(
      trainingContentSchema.safeParse({
        ...content,
        coachNote: "x".repeat(4001),
      }).success,
    ).toBe(false)
    expect(
      trainingContentSchema.safeParse({ ...content, isRestDay: true }).success,
    ).toBe(false)
  })

  it("rejects invalid kinds, score metadata and client user IDs are stripped", () => {
    expect(
      trainingContentSchema.safeParse({
        ...content,
        blocks: [{ ...block, kind: "calories" }],
      }).success,
    ).toBe(false)
    expect(
      trainingResultInputSchema.safeParse({ ...score, publishedVersion: 0 })
        .success,
    ).toBe(false)
    expect(
      trainingResultInputSchema.safeParse({ ...score, audience: "everyone" })
        .success,
    ).toBe(false)
    expect(
      trainingResultInputSchema.parse({ ...score, userId: "someone_else" }),
    ).not.toHaveProperty("userId")
  })

  it("normalizes load in grams, time in milliseconds and reps as an integer", () => {
    expect(normalizeTrainingResult(block, score)).toMatchObject({
      scoreValue: 102058,
      displayScore: "225",
    })
    expect(
      normalizeTrainingResult(
        { ...block, kind: "time" },
        { ...score, score: "12:34" },
      ),
    ).toMatchObject({ scoreValue: 754000, displayScore: "12:34" })
    expect(
      normalizeTrainingResult(
        { ...block, kind: "reps" },
        { ...score, score: "125" },
      ).scoreValue,
    ).toBe(125)
    expect(() =>
      normalizeTrainingResult(
        { ...block, kind: "reps" },
        { ...score, score: "1.5" },
      ),
    ).toThrow()
    expect(() =>
      normalizeTrainingResult(block, { ...score, score: "-10" }),
    ).toThrow()
    expect(() =>
      normalizeTrainingResult(block, { ...score, score: "NaN" }),
    ).toThrow()
  })

  it("keeps check-offs and notes private with no ranked score", () => {
    expect(
      normalizeTrainingResult(
        { ...block, kind: "check" },
        { ...score, score: "", completed: false },
      ),
    ).toEqual({
      scoreValue: null,
      displayScore: "Not completed",
      audience: "private",
    })
    expect(
      normalizeTrainingResult({ ...block, kind: "note" }, score).audience,
    ).toBe("private")
  })

  it("binds a result to the exact occurrence, block and published version", () => {
    expect(publishedTrainingBlock(session, score)).toEqual(block)
    expect(() =>
      publishedTrainingBlock(session, { ...score, sessionId: "other" }),
    ).toThrow("CONFLICT")
    expect(() =>
      publishedTrainingBlock(session, { ...score, publishedVersion: 2 }),
    ).toThrow("CONFLICT")
    expect(() =>
      publishedTrainingBlock(session, { ...score, blockId: "other" }),
    ).toThrow("NOT_FOUND")
    expect(() =>
      publishedTrainingBlock({ ...session, published: null }, score),
    ).toThrow("CONFLICT")
    expect(() => assertTrainingRevision(3, 2)).toThrow("CONFLICT")
  })
})

// Opt in only against a disposable local database whose schema has been pushed.
// TRAINING_TEST_DATABASE_URL=mysql://root:...@127.0.0.1:.../training_test pnpm test src/server/training.test.ts
const databaseUrl = process.env.TRAINING_TEST_DATABASE_URL
describe.skipIf(!databaseUrl)(
  "training MySQL authorization, privacy and concurrent writes",
  () => {
    let pool: mysql.Pool
    let db: WodsmithDb
    const teamIds = [draft.teamId, "training_test_other", "training_test_event"]
    const userIds = [
      "training_test_coach",
      "training_test_athlete",
      "training_test_outsider",
    ]
    const trackIds = [
      draft.trackId,
      "training_test_external",
      "training_test_inactive",
      "training_test_competition",
      "training_test_series",
    ]

    beforeAll(async () => {
      if (!databaseUrl)
        throw new Error("Missing local training test database URL")
      const url = new URL(databaseUrl)
      if (
        !["127.0.0.1", "localhost"].includes(url.hostname) ||
        !url.pathname.endsWith("/training_test")
      )
        throw new Error(
          "Training integration tests require a disposable local training_test database",
        )
      pool = mysql.createPool(databaseUrl)
      db = createWodsmithDb(pool)
      state.db = db
      await db.insert(userTable).values(
        userIds.map((id) => ({
          id,
          firstName: id.endsWith("coach") ? "Coach" : "Athlete",
        })),
      )
      await db.insert(teamTable).values(
        teamIds.map((id) => ({
          id,
          name: id,
          slug: id,
          type: id.endsWith("event")
            ? ("competition_event" as const)
            : ("gym" as const),
          settings: '{"timezone":"America/Boise"}',
        })),
      )
      await db.insert(teamMembershipTable).values([
        {
          id: "training_test_m1",
          teamId: draft.teamId,
          userId: userIds[0],
          roleId: "owner",
        },
        {
          id: "training_test_m2",
          teamId: draft.teamId,
          userId: userIds[1],
          roleId: "member",
        },
        {
          id: "training_test_m3",
          teamId: teamIds[2],
          userId: userIds[0],
          roleId: "owner",
        },
      ])
      await db.insert(programmingTracksTable).values(
        trackIds.map((id) => ({
          id,
          name: id,
          type: id.endsWith("series") ? "series-template" : "team_owned",
          ownerTeamId:
            id.endsWith("external") || id.endsWith("inactive")
              ? teamIds[1]
              : draft.teamId,
          competitionId: id.endsWith("competition") ? "competition" : null,
        })),
      )
      await db.insert(teamProgrammingTracksTable).values([
        { teamId: draft.teamId, trackId: trackIds[1], isActive: 1 },
        { teamId: draft.teamId, trackId: trackIds[2], isActive: 0 },
      ])
    })

    beforeEach(async () => {
      state.userId = userIds[0]
      state.feature = true
      await db.delete(trainingCheersTable)
      await db.delete(trainingResultsTable)
      await db.delete(trainingSessionsTable)
      await db
        .update(teamMembershipTable)
        .set({ isActive: true, expiresAt: null })
        .where(eq(teamMembershipTable.id, "training_test_m1"))
    })

    afterAll(async () => {
      if (!db) return
      await db.delete(trainingCheersTable)
      await db.delete(trainingResultsTable)
      await db.delete(trainingSessionsTable)
      await db
        .delete(teamProgrammingTracksTable)
        .where(eq(teamProgrammingTracksTable.teamId, draft.teamId))
      await db
        .delete(programmingTracksTable)
        .where(inArray(programmingTracksTable.id, trackIds))
      await db
        .delete(teamMembershipTable)
        .where(inArray(teamMembershipTable.userId, userIds))
      await db.delete(teamTable).where(inArray(teamTable.id, teamIds))
      await db.delete(userTable).where(inArray(userTable.id, userIds))
      await pool.promise().end()
    })

    async function published() {
      const saved = await saveTrainingDraft(draft)
      return publishTrainingSession({
        sessionId: saved.id,
        expectedRevision: saved.revision,
      })
    }

    it("returns only gym memberships and owned/active subscribed noncompetition tracks", async () => {
      const context = await getTrainingContext()
      expect(context.teams.map((t) => t.id)).toEqual([draft.teamId])
      expect(context.teams[0].canProgram).toBe(true)
      expect(context.teams[0].tracks.map((t) => t.id).sort()).toEqual(
        [draft.trackId, trackIds[1]].sort(),
      )
    })

    it("rejects unauthenticated, outsider, inactive and expired memberships", async () => {
      state.userId = ""
      await expect(getTrainingContext()).rejects.toThrow("NOT_AUTHORIZED")
      state.userId = userIds[2]
      await expect(saveTrainingDraft(draft)).rejects.toThrow("FORBIDDEN")
      state.userId = userIds[0]
      await db
        .update(teamMembershipTable)
        .set({ isActive: false })
        .where(eq(teamMembershipTable.id, "training_test_m1"))
      await expect(saveTrainingDraft(draft)).rejects.toThrow("FORBIDDEN")
      await db
        .update(teamMembershipTable)
        .set({ isActive: true, expiresAt: new Date("2020-01-01") })
        .where(eq(teamMembershipTable.id, "training_test_m1"))
      await expect(saveTrainingDraft(draft)).rejects.toThrow("FORBIDDEN")
    })

    it("enforces selected-team tracking entitlement and fresh programming permission", async () => {
      state.feature = false
      expect((await getTrainingContext()).teams).toEqual([])
      await expect(saveTrainingDraft(draft)).rejects.toThrow("Workout tracking")
      state.feature = true
      state.userId = userIds[1]
      await expect(saveTrainingDraft(draft)).rejects.toThrow(
        "Programming permission",
      )
      await expect(
        getTrainingWeek({
          ...draft,
          startDate: draft.trainingDate,
          mode: "coach",
        }),
      ).rejects.toThrow("Programming permission")
      await expect(
        getTrainingWeek({
          ...draft,
          trackId: trackIds[2],
          startDate: draft.trainingDate,
          mode: "athlete",
        }),
      ).rejects.toThrow("track is not available")
    })

    it("hides draft sessions and preserves published content while a coach edits", async () => {
      const saved = await saveTrainingDraft(draft)
      expect(
        (
          await getTrainingWeek({
            ...draft,
            startDate: draft.trainingDate,
            mode: "athlete",
          })
        ).sessions,
      ).toEqual([])
      const live = await publishTrainingSession({
        sessionId: saved.id,
        expectedRevision: saved.revision,
      })
      await saveTrainingDraft({
        ...draft,
        expectedRevision: live.revision,
        content: { ...content, title: "Secret next edit" },
      })
      const week = await getTrainingWeek({
        ...draft,
        startDate: draft.trainingDate,
        mode: "athlete",
      })
      expect(week.sessions[0].draft).toBeNull()
      expect(week.sessions[0].published?.title).toBe(content.title)
      expect(JSON.stringify(week)).not.toContain("Secret next edit")
    })

    it("saves incomplete drafts but prevents incomplete publication", async () => {
      const saved = await saveTrainingDraft({
        ...draft,
        content: { ...content, title: "" },
      })
      await expect(
        publishTrainingSession({
          sessionId: saved.id,
          expectedRevision: saved.revision,
        }),
      ).rejects.toThrow("title")
    })

    it("excludes private results and all notes from team responses", async () => {
      const live = await published()
      const mine = await saveTrainingResult({ ...score, sessionId: live.id })
      const week = await getTrainingWeek({
        ...draft,
        startDate: draft.trainingDate,
        mode: "athlete",
      })
      expect(week.myResults[0].notes).toBe(score.notes)
      expect(week.teamResults[0]).not.toHaveProperty("notes")
      expect(JSON.stringify(week.teamResults)).not.toContain(score.notes)
      await saveTrainingResult({
        ...score,
        sessionId: live.id,
        audience: "private",
      })
      state.userId = userIds[1]
      const other = await getTrainingWeek({
        ...draft,
        startDate: draft.trainingDate,
        mode: "athlete",
      })
      expect(other.teamResults).toEqual([])
      expect(other.myResults).toEqual([])
      await expect(
        setTrainingCheer({ resultId: mine.id, cheered: true }),
      ).rejects.toThrow("not shared")
    })

    it("upserts the same occurrence/version idempotently and keeps old versions in history", async () => {
      const live = await published()
      const first = await saveTrainingResult({ ...score, sessionId: live.id })
      const retry = await saveTrainingResult({
        ...score,
        sessionId: live.id,
        score: "230",
      })
      expect(retry.id).toBe(first.id)
      expect(await getTrainingHistory(draft)).toHaveLength(1)
      const next = await saveTrainingDraft({
        ...draft,
        expectedRevision: live.revision,
        content: { ...content, blocks: [{ ...block, title: "Back squat" }] },
      })
      const republished = await publishTrainingSession({
        sessionId: next.id,
        expectedRevision: next.revision,
      })
      await expect(
        saveTrainingResult({ ...score, sessionId: live.id }),
      ).rejects.toThrow("CONFLICT")
      await saveTrainingResult({
        ...score,
        sessionId: live.id,
        publishedVersion: republished.publishedVersion,
      })
      const history = await getTrainingHistory(draft)
      expect(history).toHaveLength(2)
      expect(history.find((r) => r.publishedVersion === 1)?.block.title).toBe(
        "Front squat",
      )
      expect(
        (
          await getTrainingWeek({
            ...draft,
            startDate: draft.trainingDate,
            mode: "athlete",
          })
        ).teamResults.map((r) => r.publishedVersion),
      ).toEqual([2])
    })

    it("rejects stale draft writes and accepts only one concurrent writer", async () => {
      const saved = await saveTrainingDraft(draft)
      const attempts = await Promise.allSettled([
        saveTrainingDraft({
          ...draft,
          expectedRevision: saved.revision,
          content: { ...content, title: "A" },
        }),
        saveTrainingDraft({
          ...draft,
          expectedRevision: saved.revision,
          content: { ...content, title: "B" },
        }),
      ])
      expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1)
      expect(attempts.filter((r) => r.status === "rejected")).toHaveLength(1)
    })

    it("copies to an independent draft and protects occupied destinations including races", async () => {
      const live = await published()
      const input = {
        sessionId: live.id,
        targetDate: "2026-09-06",
        targetTrackId: draft.trackId,
        expectedRevision: live.revision,
      }
      const copies = await Promise.allSettled([
        copyTrainingSession(input),
        copyTrainingSession(input),
      ])
      expect(copies.filter((r) => r.status === "fulfilled")).toHaveLength(1)
      const copied = copies.find((r) => r.status === "fulfilled")
      if (copied?.status !== "fulfilled") throw new Error("No copy created")
      expect(copied.value.publishedVersion).toBe(0)
      expect(copied.value.draft?.blocks[0].id).not.toBe(block.id)
      expect(copied.value.draft?.blocks[0].title).toBe(block.title)
      await expect(copyTrainingSession(input)).rejects.toThrow(
        "destination already",
      )
      await expect(
        copyTrainingSession({ ...input, targetTrackId: trackIds[2] }),
      ).rejects.toThrow("track is not available")
    })

    it("serializes a publish/result race without attaching the score to the wrong version", async () => {
      const live = await published()
      const next = await saveTrainingDraft({
        ...draft,
        expectedRevision: live.revision,
        content: { ...content, title: "Second version" },
      })
      const attempts = await Promise.allSettled([
        publishTrainingSession({
          sessionId: next.id,
          expectedRevision: next.revision,
        }),
        saveTrainingResult({ ...score, sessionId: live.id }),
      ])
      expect(attempts[0].status).toBe("fulfilled")
      const history = await getTrainingHistory(draft)
      expect(history.every((r) => r.publishedVersion === 1)).toBe(true)
      expect(
        (
          await getTrainingWeek({
            ...draft,
            startDate: draft.trainingDate,
            mode: "athlete",
          })
        ).teamResults,
      ).toEqual([])
    })

    it("makes cheer retries idempotent and removes cheers when a result becomes private", async () => {
      const live = await published()
      const result = await saveTrainingResult({ ...score, sessionId: live.id })
      state.userId = userIds[1]
      await setTrainingCheer({ resultId: result.id, cheered: true })
      await setTrainingCheer({ resultId: result.id, cheered: true })
      expect(
        (
          await getTrainingWeek({
            ...draft,
            startDate: draft.trainingDate,
            mode: "athlete",
          })
        ).teamResults[0].cheerCount,
      ).toBe(1)
      state.userId = userIds[0]
      await saveTrainingResult({
        ...score,
        sessionId: live.id,
        audience: "private",
      })
      expect((await getTrainingHistory(draft))[0].cheerCount).toBe(0)
    })
  },
)
