import { randomUUID } from "node:crypto"
import { createWodsmithDb } from "@repo/wodsmith-db/mysql"
import { getTableColumns, getTableName } from "drizzle-orm"
import { CasingCache } from "drizzle-orm/casing"
import mysql, { type Pool, type RowDataPacket } from "mysql2"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import type { Database } from "@/db"
import {
  competitionEventsTable,
  competitionRegistrationsTable,
  competitionsTable,
  programmingTracksTable,
  scalingLevelsTable,
  scoreRoundsTable,
  scoresTable,
  scoreVerificationLogsTable,
  trackWorkoutsTable,
  videoSubmissionsTable,
  workouts,
} from "@/db/schema"
import { mysqlTestConfig } from "./mysql-test-config"

const fixture = vi.hoisted(() => ({ db: undefined as Database | undefined }))
vi.mock("@/db", () => ({ getDb: () => fixture.db }))
vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: async () => ({ userId: "athlete" }),
}))
vi.mock("@/utils/team-auth", () => ({
  requireSubmissionReviewAccess: async () => ({
    organizingTeamId: "organizer",
  }),
}))
vi.mock("@/lib/evlog", () => ({ getEvlog: () => undefined }))
vi.mock("@/lib/logging", () => ({ logInfo: vi.fn() }))
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (parse: (data: unknown) => unknown) => ({
      handler:
        (fn: (ctx: { data: unknown }) => Promise<unknown>) =>
        (ctx: { data: unknown }) =>
          fn({ data: parse(ctx.data) }),
    }),
  }),
  createServerOnlyFn: (fn: unknown) => fn,
}))

import { verifySubmissionScoreFn } from "@/server-fns/submission-verification-fns"
import { submitVideoFn } from "@/server-fns/video-submission-fns"

// Only explicit test configuration enables real database access. Each run owns
// a random database; application DATABASE_URL and credentials are never read.
const casing = new CasingCache("snake_case")
const databaseName = `submission_test_${randomUUID().replaceAll("-", "")}`
const tables = [
  competitionsTable,
  competitionEventsTable,
  competitionRegistrationsTable,
  programmingTracksTable,
  trackWorkoutsTable,
  workouts,
  scalingLevelsTable,
  videoSubmissionsTable,
  scoresTable,
  scoreRoundsTable,
  scoreVerificationLogsTable,
]
let admin: Pool
let pool: Pool

async function insert(
  table: (typeof tables)[number],
  values: Record<string, unknown>,
) {
  const columns = getTableColumns(table)
  const names = Object.keys(values).map((key) => {
    const column = columns[key as keyof typeof columns]
    if (!column) throw new Error(`Unknown fixture column: ${key}`)
    return `\`${casing.getColumnCasing(column)}\``
  })
  await pool
    .promise()
    .query(
      `INSERT INTO \`${getTableName(table)}\` (${names.join(",")}) VALUES (${names.map(() => "?").join(",")})`,
      Object.values(values),
    )
}

async function rows(table: (typeof tables)[number]) {
  const [result] = await pool
    .promise()
    .query<RowDataPacket[]>(
      `SELECT * FROM \`${getTableName(table)}\` ORDER BY id`,
    )
  return result
}

async function snapshot() {
  return Promise.all(tables.map(rows))
}

async function seedSubmission({
  divisionId = "rx",
  suffix = "rx",
  status = "verified",
}: {
  divisionId?: string | null
  suffix?: string
  status?: "verified" | "adjusted" | "invalid"
} = {}) {
  await insert(competitionRegistrationsTable, {
    id: `registration-${suffix}`,
    eventId: "competition",
    userId: "athlete",
    divisionId,
    status: "active",
  })
  await insert(scoresTable, {
    id: `score-${suffix}`,
    userId: "athlete",
    teamId: "organizer",
    workoutId: "workout",
    competitionEventId: "event-workout",
    scalingLevelId: divisionId,
    scoreValue: 360000,
    scheme: "time-with-cap",
    scoreType: "sum",
    status: "scored",
    statusOrder: 0,
    timeCapMs: 600000,
    verificationStatus: status,
    verifiedAt: new Date("2026-01-01T12:00:00Z"),
    verifiedByUserId: "reviewer",
    penaltyType: "major",
    penaltyPercentage: 15,
    noRepCount: 5,
    recordedAt: new Date("2026-01-01T12:00:00Z"),
  })
  await insert(videoSubmissionsTable, {
    id: `video-${suffix}`,
    registrationId: `registration-${suffix}`,
    trackWorkoutId: "event-workout",
    userId: "athlete",
    videoIndex: 0,
    videoUrl: "https://www.youtube.com/watch?v=old-video",
    reviewStatus: status === "adjusted" ? "penalized" : status,
    reviewedAt: new Date("2026-01-01T12:00:00Z"),
    reviewedBy: "reviewer",
    reviewerNotes: "Old performance notes",
    submittedAt: new Date("2026-01-01T12:00:00Z"),
  })
  await insert(scoreRoundsTable, {
    id: `round-${suffix}-1`,
    scoreId: `score-${suffix}`,
    roundNumber: 1,
    value: 120000,
    status: "scored",
  })
  await insert(scoreRoundsTable, {
    id: `round-${suffix}-2`,
    scoreId: `score-${suffix}`,
    roundNumber: 2,
    value: 240000,
    status: "scored",
  })
  await insert(scoreVerificationLogsTable, {
    id: `log-${suffix}`,
    scoreId: `score-${suffix}`,
    competitionId: "competition",
    trackWorkoutId: "event-workout",
    athleteUserId: "athlete",
    action: status,
    performedByUserId: "reviewer",
    performedAt: new Date("2026-01-01T12:00:00Z"),
  })
}

const replacement = {
  competitionId: "competition",
  trackWorkoutId: "event-workout",
  divisionId: "rx",
  videoUrl: "https://www.youtube.com/watch?v=new-video",
  roundScores: [{ score: "4:00" }, { score: "10:05", status: "cap" as const, secondaryScore: "42" }],
}

const pendingScoreReview = {
  verification_status: null,
  verified_at: null,
  verified_by_user_id: null,
  penalty_type: null,
  penalty_percentage: null,
  no_rep_count: null,
}
const pendingVideoReview = {
  review_status: "pending",
  reviewed_at: null,
  reviewed_by: null,
  reviewer_notes: null,
}

describe.skipIf(!mysqlTestConfig)("submission integrity on MySQL", () => {
  beforeAll(async () => {
    if (!mysqlTestConfig)
      throw new Error("MySQL test configuration is required")
    admin = mysql.createPool(mysqlTestConfig)
    await admin.promise().query(`CREATE DATABASE \`${databaseName}\``)
    pool = mysql.createPool({
      ...mysqlTestConfig,
      database: databaseName,
      connectionLimit: 5,
    })
    fixture.db = createWodsmithDb(pool)
    for (const table of tables) {
      const columns = Object.values(getTableColumns(table)).map((column) => {
        // Preserve the production NULL-safe key that makes divisionless upserts work.
        if (table === scoresTable && column === scoresTable.scalingKey) {
          return `\`${casing.getColumnCasing(column)}\` ${column.getSQLType()} GENERATED ALWAYS AS (coalesce(scaling_level_id, '')) STORED`
        }
        const defaultSql = ["string", "number", "boolean"].includes(
          typeof column.default,
        )
          ? ` DEFAULT ${mysql.escape(column.default)}`
          : ""
        return `\`${casing.getColumnCasing(column)}\` ${column.getSQLType()} ${column.primary ? "PRIMARY KEY" : "NULL"}${defaultSql}`
      })
      // Unrelated required fields may be null in this fixture. Real InnoDB
      // transactions and the submission uniqueness constraints stay intact.
      await pool
        .promise()
        .query(
          `CREATE TABLE \`${getTableName(table)}\` (${columns.join(",")}) ENGINE=InnoDB`,
        )
    }
    await pool
      .promise()
      .query(
        "CREATE UNIQUE INDEX idx_scores_competition_user_unique ON scores (competition_event_id, user_id, scaling_key)",
      )
    await pool
      .promise()
      .query(
        "CREATE UNIQUE INDEX idx_score_rounds_unique ON score_rounds (score_id, round_number)",
      )
    await pool
      .promise()
      .query(
        "CREATE UNIQUE INDEX video_submissions_reg_event_idx ON video_submissions (registration_id, track_workout_id, video_index)",
      )
  }, 20_000)

  afterAll(async () => {
    if (pool) await pool.promise().end()
    if (admin) {
      await admin.promise().query(`DROP DATABASE IF EXISTS \`${databaseName}\``)
      await admin.promise().end()
    }
  })

  beforeEach(async () => {
    for (const table of tables)
      await pool.promise().query(`DELETE FROM \`${getTableName(table)}\``)
    await insert(competitionsTable, {
      id: "competition",
      competitionType: "online",
    })
    await insert(competitionEventsTable, {
      id: "event",
      competitionId: "competition",
      trackWorkoutId: "event-workout",
    })
    await insert(programmingTracksTable, {
      id: "track",
      ownerTeamId: "organizer",
    })
    await insert(trackWorkoutsTable, {
      id: "event-workout",
      trackId: "track",
      workoutId: "workout",
    })
    await insert(workouts, {
      id: "workout",
      scheme: "time-with-cap",
      scoreType: "sum",
      timeCap: 600,
      roundsToScore: 2,
    })
    await insert(scalingLevelsTable, { id: "rx", teamSize: 1 })
    await insert(scalingLevelsTable, { id: "partner", teamSize: 2 })
  })

  // @lat: [[submission-integrity#Submission Integrity#Invalid input preserves persisted state]]
  it.each([
    { score: "invalid", roundScores: undefined },
    { roundScores: [{ score: "4:00" }, { score: "invalid" }] },
    { tiebreakScore: "invalid" },
  ])(
    "rejects invalid score input before changing any persisted state: %j",
    async (invalid) => {
      await seedSubmission()
      await pool.promise().query("UPDATE workouts SET tiebreak_scheme = 'time'")
      if ("score" in invalid) await pool.promise().query("UPDATE workouts SET rounds_to_score = 1")
      const before = await snapshot()
      await expect(
        submitVideoFn({ data: { ...replacement, ...invalid } }),
      ).rejects.toThrow(/Invalid/)
      expect(await snapshot()).toEqual(before)
    },
  )

  // @lat: [[submission-integrity#Submission Integrity#Failed round replacement rolls back]]
  it("rolls back video, score, review metadata, and round deletion if round insertion fails", async () => {
    await seedSubmission()
    const before = await snapshot()
    await pool
      .promise()
      .query(
        "CREATE TRIGGER reject_round BEFORE INSERT ON score_rounds FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixture round failure'",
      )
    try {
      await expect(submitVideoFn({ data: replacement })).rejects.toThrow()
      expect(await snapshot()).toEqual(before)
    } finally {
      await pool.promise().query("DROP TRIGGER reject_round")
    }
    await expect(submitVideoFn({ data: replacement })).resolves.toMatchObject({
      success: true,
    })
    expect(await rows(scoresTable)).toMatchObject([
      { score_value: 840000, status: "cap" },
    ])
    expect(await rows(scoreRoundsTable)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          round_number: 1,
          value: 240000,
          status: "scored",
        }),
        expect.objectContaining({
          round_number: 2,
          value: 600000,
          status: "cap",
        }),
      ]),
    )
  })

  // @lat: [[submission-integrity#Submission Integrity#Replacement requires review]]
  it.each(["verified", "adjusted", "invalid"] as const)(
    "reopens a %s score and video without deleting audit history",
    async (status) => {
      await seedSubmission({ status })
      const logs = await rows(scoreVerificationLogsTable)
      await submitVideoFn({ data: replacement })
      expect(await rows(scoresTable)).toMatchObject([
        { ...pendingScoreReview, score_value: 840000 },
      ])
      expect(await rows(videoSubmissionsTable)).toMatchObject([
        { ...pendingVideoReview, video_url: replacement.videoUrl },
      ])
      expect(await rows(scoreVerificationLogsTable)).toEqual(logs)
    },
  )

  // @lat: [[submission-integrity#Submission Integrity#Partner evidence resets shared review]]
  it("reopens shared score review on a partner video-only replacement without touching another division", async () => {
    await seedSubmission()
    await seedSubmission({ divisionId: "partner", suffix: "partner" })
    await insert(videoSubmissionsTable, {
      id: "partner-slot",
      registrationId: "registration-partner",
      trackWorkoutId: "event-workout",
      videoIndex: 1,
      userId: "athlete",
      videoUrl: "https://www.youtube.com/watch?v=partner-old",
      reviewStatus: "verified",
      reviewedBy: "reviewer",
    })
    const scores = await rows(scoresTable)
    const rounds = await rows(scoreRoundsTable)
    const videos = await rows(videoSubmissionsTable)
    const logs = await rows(scoreVerificationLogsTable)
    await submitVideoFn({
      data: {
        ...replacement,
        divisionId: "partner",
        videoIndex: 1,
        roundScores: undefined,
      },
    })
    expect(
      (await rows(scoresTable)).find((row) => row.id === "score-partner"),
    ).toMatchObject({ ...pendingScoreReview, score_value: 360000 })
    expect(
      (await rows(scoresTable)).find((row) => row.id === "score-rx"),
    ).toEqual(scores.find((row) => row.id === "score-rx"))
    expect(
      (await rows(videoSubmissionsTable)).find(
        (row) => row.id === "partner-slot",
      ),
    ).toMatchObject({ ...pendingVideoReview, video_url: replacement.videoUrl })
    expect(
      (await rows(videoSubmissionsTable)).filter(
        (row) => row.id !== "partner-slot",
      ),
    ).toEqual(videos.filter((row) => row.id !== "partner-slot"))
    expect(await rows(scoreRoundsTable)).toEqual(rounds)
    expect(await rows(scoreVerificationLogsTable)).toEqual(logs)
  })

  // @lat: [[submission-integrity#Submission Integrity#Review stays in the score division]]
  it.each([
    ["verify", "partner"],
    ["adjust", "partner"],
    ["invalid", "partner"],
    ["verify", null],
    ["adjust", null],
    ["invalid", null],
  ] as const)(
    "%s updates only the score's matching division (%s)",
    async (action, divisionId) => {
      await seedSubmission()
      await seedSubmission({ divisionId, suffix: "selected" })
      const otherScore = (await rows(scoresTable)).find(
        (row) => row.id === "score-rx",
      )
      const otherVideo = (await rows(videoSubmissionsTable)).find(
        (row) => row.id === "video-rx",
      )
      await verifySubmissionScoreFn({
        data: {
          competitionId: "competition",
          trackWorkoutId: "event-workout",
          scoreId: "score-selected",
          action,
          adjustedScore: "5:00",
          adjustedScoreStatus: "scored",
          reviewerNotes: "Current review",
        },
      })
      const expectedStatus =
        action === "verify"
          ? "verified"
          : action === "adjust"
            ? "adjusted"
            : "invalid"
      expect(
        (await rows(scoresTable)).find((row) => row.id === "score-selected"),
      ).toMatchObject({ verification_status: expectedStatus })
      expect(
        (await rows(videoSubmissionsTable)).find(
          (row) => row.id === "video-selected",
        ),
      ).toMatchObject({
        review_status: expectedStatus,
        reviewer_notes: "Current review",
      })
      expect(
        (await rows(scoresTable)).find((row) => row.id === "score-rx"),
      ).toEqual(otherScore)
      expect(
        (await rows(videoSubmissionsTable)).find(
          (row) => row.id === "video-rx",
        ),
      ).toEqual(otherVideo)
    },
  )
})
