import { createWodsmithDb, type WodsmithDb } from "@repo/wodsmith-db/mysql"
import {
  programmingTracksTable,
  scalingGroupsTable,
  scalingLevelsTable,
  scoreRoundsTable,
  scoresTable,
  teamMembershipTable,
  teamTable,
  userTable,
  workouts,
} from "@repo/wodsmith-db/schema"
import {
  personalTrainingResultsTable,
  personalTrainingSessionsTable,
  trainingPreferencesTable,
} from "@repo/wodsmith-db/schemas/training-personal"
import {
  trainingResultsTable,
  trainingSessionsTable,
} from "@repo/wodsmith-db/schemas/training"
import { eq } from "drizzle-orm"
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
import type { PersonalTrainingItemInput } from "@/lib/training/personal-types"
import type { TrainingBlock } from "@/lib/training/types"
import { personalTrainingSaveSchema } from "./training-personal-validation"
import { normalizePersonalLibraryScore } from "./training-personal-scoring"
import * as roundWriter from "./training-logs/rounds"
const state = vi.hoisted(() => ({
  userId: "personal_athlete",
  feature: true,
  db: null as unknown,
}))
vi.mock("@/db", () => ({ getDb: () => state.db }))
vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: async () =>
    state.userId ? { userId: state.userId } : null,
}))
vi.mock("@/utils/team-auth", () => ({
  getActiveTeamId: async () => "personal_gym",
}))
vi.mock("@/server/entitlements", () => ({
  hasFeature: async () => state.feature,
}))
import { saveTrainingResult } from "./training"
import {
  getPersonalTrainingDay,
  getPersonalLibraryScalingLevels,
  getPersonalTrainingHistory,
  getTrainingLibraryWorkout,
  linkPersonalTrainingScore,
  savePersonalLibraryResult,
  savePersonalTrainingResult,
  savePersonalTrainingSession,
  saveTrainingPreference,
} from "./training-personal"
const day = { teamId: "personal_gym", trainingDate: "2026-09-05" }
const block: TrainingBlock = {
  id: "block",
  kind: "reps",
  title: "Pull-ups",
  prescription: "Accumulate 30 reps",
  coachGuidance: "",
  scalingGuidance: "",
}
const personalItem: PersonalTrainingItemInput = {
  id: "bike",
  kind: "personal",
  block: {
    ...block,
    id: "bike",
    title: "Bike",
    kind: "time",
    prescription: "Easy 15 minutes",
  },
}
const sourceItem: PersonalTrainingItemInput = {
  id: "source",
  kind: "source",
  sourceSessionId: "personal_source",
  sourceBlockId: "block",
  sourcePublishedVersion: 1,
}

// @lat: [[training-personal#Verification#Composition input boundaries]]
it("rejects duplicate item identities and strips client source snapshots", () => {
  expect(
    personalTrainingSaveSchema.safeParse({
      ...day,
      expectedRevision: 0,
      items: [personalItem, { ...personalItem, id: "BIKE" }],
    }).success,
  ).toBe(false)
  const data = personalTrainingSaveSchema.parse({
    ...day,
    expectedRevision: 0,
    items: [{ ...sourceItem, block: { ...block, title: "Fake" } }],
  })
  expect(data.items[0]).not.toHaveProperty("block")
})
// @lat: [[training-personal#Verification#Capped input requires explicit reps]]
it("accepts explicit capped reps and rejects ambiguous or malformed cap scores", () => {
  const workout = {
    name: "Cap",
    description: "Finish in three minutes",
    scheme: "time-with-cap",
    timeCap: 180,
    roundsToScore: 1,
  }
  expect(
    normalizePersonalLibraryScore(workout, { score: "CAP+0" }),
  ).toMatchObject({ status: "cap", secondaryValue: 0, scoreValue: 180000 })
  expect(
    normalizePersonalLibraryScore(workout, { score: "cap + 35" }),
  ).toMatchObject({ status: "cap", secondaryValue: 35 })
  for (const score of ["CAP", "CAP+", "CAP+-1", "CAP+1.5", "3:01"])
    expect(() => normalizePersonalLibraryScore(workout, { score })).toThrow()
})
const databaseUrl = process.env.TRAINING_TEST_DATABASE_URL
describe.skipIf(!databaseUrl)("personal training database invariants", () => {
  let pool: ReturnType<typeof mysql.createPool>
  let db: WodsmithDb
  beforeAll(async () => {
    if (!databaseUrl) throw new Error("TRAINING_TEST_DATABASE_URL is required")
    const url = new URL(databaseUrl)
    if (
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      url.pathname !== "/training_test"
    )
      throw new Error("Use a disposable local training_test database")
    pool = mysql.createPool(databaseUrl)
    db = createWodsmithDb(pool)
    state.db = db
    await db.insert(userTable).values([
      { id: "personal_athlete", firstName: "Athlete" },
      { id: "personal_other", firstName: "Other" },
    ])
    await db.insert(teamTable).values([
      { id: day.teamId, name: "Gym", slug: "personal-gym", type: "gym" },
      {
        id: "personal_foreign",
        name: "Other gym",
        slug: "personal-foreign",
        type: "gym",
      },
    ])
    await db.insert(teamMembershipTable).values([
      {
        id: "personal_member",
        userId: state.userId,
        teamId: day.teamId,
        roleId: "member",
      },
      {
        id: "personal_member_other",
        userId: "personal_other",
        teamId: day.teamId,
        roleId: "member",
      },
    ])
    await db.insert(programmingTracksTable).values([
      {
        id: "personal_track",
        name: "Daily",
        type: "team_owned",
        ownerTeamId: day.teamId,
      },
      {
        id: "personal_strength",
        name: "Strength",
        type: "team_owned",
        ownerTeamId: day.teamId,
      },
      {
        id: "personal_foreign_track",
        name: "Private",
        type: "team_owned",
        ownerTeamId: "personal_foreign",
      },
    ])
    await db
      .insert(scalingGroupsTable)
      .values({ id: "personal_scaling", title: "Scaling", isSystem: true })
    await db.insert(scalingLevelsTable).values({
      id: "personal_rx",
      scalingGroupId: "personal_scaling",
      label: "Rx",
      position: 0,
    })
    await db.insert(workouts).values([
      {
        id: "personal_library",
        name: "Rounds",
        description: "Three rounds",
        scheme: "reps",
        roundsToScore: 3,
        teamId: day.teamId,
      },
      {
        id: "personal_secret",
        name: "Secret",
        description: "Private",
        scheme: "time",
        teamId: "personal_foreign",
      },
    ])
  })
  beforeEach(async () => {
    state.userId = "personal_athlete"
    state.feature = true
    await db.delete(personalTrainingResultsTable)
    await db.delete(personalTrainingSessionsTable)
    await db.delete(trainingPreferencesTable)
    await db.delete(trainingResultsTable)
    await db.delete(trainingSessionsTable)
    await db.delete(scoreRoundsTable)
    await db.delete(scoresTable)
    await db
      .update(workouts)
      .set({ scheme: "reps", roundsToScore: 3, scalingGroupId: null })
      .where(eq(workouts.id, "personal_library"))
    await db
      .update(teamMembershipTable)
      .set({ isActive: true, expiresAt: null })
      .where(eq(teamMembershipTable.id, "personal_member"))
    await db.insert(trainingSessionsTable).values([
      {
        id: "personal_source",
        teamId: day.teamId,
        trackId: "personal_track",
        trainingDate: day.trainingDate,
        timezone: "UTC",
        revision: 2,
        publishedVersion: 1,
        published: {
          title: "Daily",
          coachNote: "",
          isRestDay: false,
          blocks: [block],
        },
      },
      {
        id: "personal_strength_source",
        teamId: day.teamId,
        trackId: "personal_strength",
        trainingDate: day.trainingDate,
        timezone: "UTC",
        revision: 2,
        publishedVersion: 1,
        published: {
          title: "Strength",
          coachNote: "",
          isRestDay: false,
          blocks: [{ ...block, title: "Squat" }],
        },
      },
    ])
  })
  afterAll(async () => {
    if (!pool) return
    await db.delete(personalTrainingResultsTable)
    await db.delete(personalTrainingSessionsTable)
    await db.delete(trainingPreferencesTable)
    await db.delete(trainingResultsTable)
    await db.delete(trainingSessionsTable)
    await db.delete(scoreRoundsTable)
    await db.delete(scoresTable)
    await db.delete(workouts)
    await db.delete(scalingLevelsTable)
    await db.delete(scalingGroupsTable)
    await db.delete(programmingTracksTable)
    await db.delete(teamMembershipTable)
    await db.delete(teamTable)
    await db.delete(userTable)
    await pool.promise().end()
  })
  // @lat: [[training-personal#Verification#Lazy session ownership]]
  it("reads and logs shared programming without creating athlete sessions", async () => {
    const opened = await getPersonalTrainingDay(day)
    expect(opened.personalSession).toBeNull()
    expect(opened.items).toHaveLength(1)
    await saveTrainingResult({
      sessionId: "personal_source",
      blockId: "block",
      publishedVersion: 1,
      score: "30",
      scaling: "rx",
      modification: "",
      notes: "",
      audience: "gym",
      unit: "lb",
      completed: true,
    })
    expect(await db.select().from(personalTrainingSessionsTable)).toHaveLength(
      0,
    )
    expect(await db.select().from(trainingPreferencesTable)).toHaveLength(0)
  })
  // @lat: [[training-personal#Verification#Durable default preference]]
  it("persists the explicit default independently from browsing and athlete sessions", async () => {
    await saveTrainingPreference({
      teamId: day.teamId,
      defaultTrackId: "personal_strength",
    })
    expect(
      (await getPersonalTrainingDay({ ...day, trackId: "personal_track" }))
        .selectedTrackId,
    ).toBe("personal_track")
    expect((await getPersonalTrainingDay(day)).selectedTrackId).toBe(
      "personal_strength",
    )
    expect(await db.select().from(personalTrainingSessionsTable)).toHaveLength(
      0,
    )
    await expect(
      saveTrainingPreference({
        teamId: day.teamId,
        defaultTrackId: "personal_foreign_track",
      }),
    ).rejects.toThrow("FORBIDDEN")
  })
  // @lat: [[training-personal#Verification#Membership and ownership boundaries]]
  it("rejects revoked membership, disabled tracking, other athlete sessions and private library items", async () => {
    const session = await savePersonalTrainingSession({
      ...day,
      expectedRevision: 0,
      items: [personalItem],
    })
    state.userId = "personal_other"
    await expect(
      savePersonalTrainingResult({
        personalSessionId: session.id,
        itemId: "bike",
        expectedRevision: 1,
        score: "15:00",
        notes: "",
        unit: "lb",
        completed: true,
      }),
    ).rejects.toThrow("FORBIDDEN")
    state.userId = "personal_athlete"
    state.feature = false
    await expect(getPersonalTrainingDay(day)).rejects.toThrow("FORBIDDEN")
    state.feature = true
    await expect(
      getTrainingLibraryWorkout({
        teamId: day.teamId,
        workoutId: "personal_secret",
      }),
    ).rejects.toThrow("FORBIDDEN")
    await db
      .update(teamMembershipTable)
      .set({ expiresAt: new Date("2020-01-01") })
      .where(eq(teamMembershipTable.id, "personal_member"))
    await expect(getPersonalTrainingDay(day)).rejects.toThrow("FORBIDDEN")
  })
  // @lat: [[training-personal#Verification#Publication snapshots and explicit remix]]
  it("preserves references after republishing and only changes prescription on explicit remix", async () => {
    const first = await savePersonalTrainingSession({
      ...day,
      expectedRevision: 0,
      items: [sourceItem, personalItem],
    })
    await db
      .update(trainingSessionsTable)
      .set({
        publishedVersion: 2,
        published: {
          title: "Updated",
          coachNote: "",
          isRestDay: false,
          blocks: [{ ...block, prescription: "50 reps" }],
        },
      })
      .where(eq(trainingSessionsTable.id, "personal_source"))
    const saved = await savePersonalTrainingSession({
      ...day,
      expectedRevision: first.revision,
      items: [personalItem, sourceItem],
    })
    expect(
      saved.items[1].kind === "source" && saved.items[1].block.prescription,
    ).toBe("Accumulate 30 reps")
    expect((await getPersonalTrainingDay(day)).items[1]).toMatchObject({
      sourceIsCurrent: false,
    })
    await expect(
      savePersonalTrainingSession({
        ...day,
        trainingDate: "2026-09-06",
        expectedRevision: 0,
        items: [sourceItem],
      }),
    ).rejects.toThrow("CONFLICT")
    const remixed = await savePersonalTrainingSession({
      ...day,
      expectedRevision: saved.revision,
      items: [
        {
          id: "remix",
          kind: "personal",
          block: { ...block, prescription: "20 reps" },
          remixedFrom: {
            sourceSessionId: "personal_source",
            sourceBlockId: "block",
            sourcePublishedVersion: 1,
          },
        },
      ],
    })
    expect(remixed.items[0].kind).toBe("personal")
    const [source] = await db
      .select()
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.id, "personal_source"))
    expect(source.published?.blocks[0].prescription).toBe("50 reps")
  })
  // @lat: [[training-personal#Verification#Concurrent composition saves]]
  it("allows only one racing first creation and rejects stale revisions", async () => {
    const input = { ...day, expectedRevision: 0, items: [personalItem] }
    const settled = await Promise.allSettled([
      savePersonalTrainingSession(input),
      savePersonalTrainingSession(input),
    ])
    expect(settled.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    expect(await db.select().from(personalTrainingSessionsTable)).toHaveLength(
      1,
    )
    await expect(savePersonalTrainingSession(input)).rejects.toThrow("CONFLICT")
  })
  // @lat: [[training-personal#Verification#Private results preserve history]]
  it("keeps own score snapshots private and available after removing the item", async () => {
    const session = await savePersonalTrainingSession({
      ...day,
      expectedRevision: 0,
      items: [personalItem],
    })
    const result = await savePersonalTrainingResult({
      personalSessionId: session.id,
      itemId: "bike",
      expectedRevision: 1,
      score: "62:34.567",
      notes: "Recovery",
      unit: "lb",
      completed: true,
    })
    expect(result).toMatchObject({
      audience: "private",
      scoreValue: 3754567,
      scaling: "custom",
    })
    await expect(
      savePersonalTrainingSession({
        ...day,
        expectedRevision: 1,
        items: [
          {
            ...personalItem,
            block: { ...block, id: "bike", prescription: "Different" },
          },
        ],
      }),
    ).rejects.toThrow("CONFLICT")
    await savePersonalTrainingSession({
      ...day,
      expectedRevision: 1,
      items: [],
    })
    expect(
      (await getPersonalTrainingHistory({ teamId: day.teamId }))[0],
    ).toMatchObject({ notes: "Recovery", block: { title: "Bike" } })
    state.userId = "personal_other"
    expect(
      await getPersonalTrainingHistory({ teamId: day.teamId }),
    ).toHaveLength(0)
  })
  // @lat: [[training-personal#Verification#Mixed track result identity]]
  it("returns unchanged source results from every composed track", async () => {
    await savePersonalTrainingSession({
      ...day,
      expectedRevision: 0,
      items: [
        sourceItem,
        {
          ...sourceItem,
          id: "strength",
          sourceSessionId: "personal_strength_source",
        },
      ],
    })
    await saveTrainingResult({
      sessionId: "personal_strength_source",
      blockId: "block",
      publishedVersion: 1,
      score: "30",
      scaling: "rx",
      modification: "",
      notes: "",
      audience: "gym",
      unit: "lb",
      completed: true,
    })
    expect((await getPersonalTrainingDay(day)).results).toEqual([
      expect.objectContaining({
        sessionId: "personal_strength_source",
        trackId: "personal_strength",
        audience: "gym",
      }),
    ])
  })
  // @lat: [[training-personal#Verification#Atomic library scoring]]
  it("stores rich round scores and private association atomically and retries without duplication", async () => {
    const session = await savePersonalTrainingSession({
      ...day,
      expectedRevision: 0,
      items: [
        { id: "library", kind: "library", workoutId: "personal_library" },
      ],
    })
    const input = {
      personalSessionId: session.id,
      itemId: "library",
      expectedRevision: 1,
      score: "",
      notes: "Private",
      asRx: true,
      roundScores: [{ score: "10" }, { score: "20" }, { score: "30" }],
    }
    await expect(
      savePersonalLibraryResult({ ...input, roundScores: [{ score: "10" }] }),
    ).rejects.toThrow("every prescribed round")
    expect(await db.select().from(scoresTable)).toHaveLength(0)
    await db
      .update(workouts)
      .set({ scheme: "time", roundsToScore: 1 })
      .where(eq(workouts.id, "personal_library"))
    await db
      .update(workouts)
      .set({ scalingGroupId: "changed_scaling_group" })
      .where(eq(workouts.id, "personal_library"))
    expect(
      await getPersonalLibraryScalingLevels({
        personalSessionId: session.id,
        itemId: "library",
      }),
    ).toEqual({ levels: [{ id: "personal_rx", label: "Rx", position: 0 }] })
    const reordered = await savePersonalTrainingSession({
      ...day,
      expectedRevision: 1,
      items: [
        { id: "library", kind: "library", workoutId: "personal_library" },
        personalItem,
      ],
    })
    const failedRoundWrite = vi
      .spyOn(roundWriter, "writeWorkoutResultRounds")
      .mockRejectedValueOnce(new Error("Round storage unavailable"))
    await expect(
      savePersonalLibraryResult({
        ...input,
        expectedRevision: reordered.revision,
      }),
    ).rejects.toThrow("Round storage unavailable")
    expect(await db.select().from(scoresTable)).toHaveLength(0)
    expect(await db.select().from(personalTrainingResultsTable)).toHaveLength(0)
    failedRoundWrite.mockRestore()
    const result = await savePersonalLibraryResult({
      ...input,
      expectedRevision: reordered.revision,
    })
    expect(
      (await savePersonalLibraryResult({ ...input, expectedRevision: 2 }))
        .scoreId,
    ).toBe(result.scoreId)
    expect(await db.select().from(scoresTable)).toHaveLength(1)
    expect(await db.select().from(scoreRoundsTable)).toHaveLength(3)
    expect((await getPersonalTrainingDay(day)).libraryResults).toEqual([
      { itemId: "library", scoreId: result.scoreId },
    ])
  })
  // @lat: [[training-personal#Verification#Library score linking boundaries]]
  it("rejects linking another athlete's score even for the same workout", async () => {
    const session = await savePersonalTrainingSession({
      ...day,
      expectedRevision: 0,
      items: [
        { id: "library", kind: "library", workoutId: "personal_library" },
      ],
    })
    await db.insert(scoresTable).values({
      id: "foreign_score",
      userId: "personal_other",
      teamId: day.teamId,
      workoutId: "personal_library",
      scheme: "reps",
      recordedAt: new Date("2026-09-05T00:00:00Z"),
    })
    await expect(
      linkPersonalTrainingScore({
        personalSessionId: session.id,
        itemId: "library",
        expectedRevision: 1,
        scoreId: "foreign_score",
      }),
    ).rejects.toThrow("FORBIDDEN")
  })
  // @lat: [[training-personal#Verification#Remixes remain independent]]
  it("keeps remix provenance editable and moved source results independent", async () => {
    const first = await savePersonalTrainingSession({
      ...day,
      expectedRevision: 0,
      items: [
        {
          id: "remix",
          kind: "personal",
          block,
          remixedFrom: {
            sourceSessionId: "personal_source",
            sourceBlockId: "block",
            sourcePublishedVersion: 1,
          },
        },
      ],
    })
    await db
      .update(trainingSessionsTable)
      .set({ publishedVersion: 2 })
      .where(eq(trainingSessionsTable.id, "personal_source"))
    const changed = await savePersonalTrainingSession({
      ...day,
      expectedRevision: first.revision,
      items: [
        {
          id: "remix",
          kind: "personal",
          block: { ...block, prescription: "20 reps" },
          remixedFrom: {
            sourceSessionId: "personal_source",
            sourceBlockId: "block",
            sourcePublishedVersion: 1,
          },
        },
      ],
    })
    expect(changed.revision).toBe(2)
    const moved = await savePersonalTrainingSession({
      ...day,
      trainingDate: "2026-09-06",
      expectedRevision: 0,
      items: [{ ...sourceItem, sourcePublishedVersion: 2 }],
    })
    const result = await savePersonalTrainingResult({
      personalSessionId: moved.id,
      itemId: "source",
      expectedRevision: 1,
      score: "25",
      notes: "",
      unit: "lb",
      completed: true,
    })
    expect(result).toMatchObject({
      trainingDate: "2026-09-06",
      audience: "private",
    })
    expect(await db.select().from(trainingResultsTable)).toHaveLength(0)
  })
  // @lat: [[training-personal#Verification#Capped result edits preserve scoring]]
  it("edits capped and multi-round scores atomically without losing statuses or rep counts", async () => {
    await db
      .update(workouts)
      .set({
        scheme: "time-with-cap",
        timeCap: 180,
        roundsToScore: 2,
        scoreType: "sum",
      })
      .where(eq(workouts.id, "personal_library"))
    const session = await savePersonalTrainingSession({
      ...day,
      expectedRevision: 0,
      items: [
        { id: "library", kind: "library", workoutId: "personal_library" },
      ],
    })
    const input = {
      personalSessionId: session.id,
      itemId: "library",
      expectedRevision: 1,
      score: "",
      asRx: true,
    }
    const saved = await savePersonalLibraryResult({
      ...input,
      roundScores: [{ score: "CAP+35" }, { score: "2:15" }],
    })
    const [original] = await db
      .select()
      .from(scoresTable)
      .where(eq(scoresTable.id, saved.scoreId))
    expect(original).toMatchObject({
      status: "cap",
      secondaryValue: 35,
      scoreValue: 315000,
    })
    expect(
      (
        await db
          .select()
          .from(scoreRoundsTable)
          .where(eq(scoreRoundsTable.scoreId, saved.scoreId))
      )[0],
    ).toMatchObject({ status: "cap", secondaryValue: 35, value: 180000 })
    const edited = await savePersonalLibraryResult({
      ...input,
      replaceExisting: true,
      roundScores: [{ score: "2:00" }, { score: "2:10" }],
    })
    expect(edited.scoreId).toBe(saved.scoreId)
    const [updated] = await db
      .select()
      .from(scoresTable)
      .where(eq(scoresTable.id, saved.scoreId))
    expect(updated).toMatchObject({
      status: "scored",
      secondaryValue: null,
      scoreValue: 250000,
    })
    const rounds = await db
      .select()
      .from(scoreRoundsTable)
      .where(eq(scoreRoundsTable.scoreId, saved.scoreId))
    expect(rounds).toHaveLength(2)
    expect(
      rounds.every(
        (round) => round.status === "scored" && round.secondaryValue === null,
      ),
    ).toBe(true)
    await expect(
      savePersonalLibraryResult({
        ...input,
        replaceExisting: true,
        roundScores: [{ score: "3:01" }, { score: "2:00" }],
      }),
    ).rejects.toThrow("exceeds the cap")
    await db
      .update(workouts)
      .set({ roundsToScore: 1 })
      .where(eq(workouts.id, "personal_library"))
    const single = await savePersonalTrainingSession({
      ...day,
      trainingDate: "2026-09-06",
      expectedRevision: 0,
      items: [
        { id: "library", kind: "library", workoutId: "personal_library" },
      ],
    })
    const singleResult = await savePersonalLibraryResult({
      ...input,
      personalSessionId: single.id,
      score: "CAP+50",
    })
    const [singleRow] = await db
      .select()
      .from(scoresTable)
      .where(eq(scoresTable.id, singleResult.scoreId))
    expect(singleRow).toMatchObject({
      status: "cap",
      secondaryValue: 50,
      scoreValue: 180000,
    })
  })
})
