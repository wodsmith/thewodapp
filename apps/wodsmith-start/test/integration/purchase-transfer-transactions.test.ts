import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
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
  benchmarkBatteriesTable,
  benchmarkTestsTable,
  benchmarkTierThresholdsTable,
  commerceProductTable,
  commercePurchaseTable,
  competitionEventsTable,
  competitionHeatAssignmentsTable,
  competitionRegistrationAnswersTable,
  competitionRegistrationsTable,
  competitionsTable,
  programmingTracksTable,
  purchaseTransfersTable,
  scalingLevelsTable,
  scoreRoundsTable,
  scoresTable,
  teamMembershipTable,
  trackWorkoutsTable,
  videoSubmissionsTable,
  waiverSignaturesTable,
  waiversTable,
  workouts,
} from "@/db/schema"
import { mysqlTestConfig } from "./mysql-test-config"

const fixture = vi.hoisted(() => ({ db: undefined as Database | undefined }))
vi.mock("@/db", () => ({ getDb: () => fixture.db }))
vi.mock("@/lib/logging", () => ({
  logInfo: vi.fn(),
  logWarning: vi.fn(),
  addRequestContextAttribute: vi.fn(),
  updateRequestContext: vi.fn(),
}))
vi.mock("@/lib/evlog", () => ({ getEvlog: () => undefined }))
vi.mock("@/server/cohost", () => ({ getCohostPermissions: vi.fn() }))
vi.mock("@/utils/auth", () => ({
  requireVerifiedEmail: async () => ({
    userId: "target",
    user: { email: "target@example.com", role: "admin" },
    teams: [],
  }),
  getSessionFromCookie: vi.fn(),
}))
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
}))
vi.mock("@/utils/bearer-auth", () => ({
  getSessionFromBearerOrCookie: async () => ({ userId: "source" }),
  corsHeaders: () => ({}),
}))
vi.mock("@tanstack/react-start", () => ({
  json: (data: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(data), init),
  createServerFn: () => ({
    inputValidator: (validate: (data: unknown) => unknown) => ({
      handler:
        (fn: (input: { data: unknown }) => unknown) =>
        async (input: { data: unknown }) =>
          fn({ data: validate(input.data) }),
    }),
    handler: (fn: unknown) => fn,
  }),
  createServerOnlyFn: (fn: unknown) => fn,
}))

import { Route as scoreRoute } from "@/routes/api/compete/scores/submit"
import { Route as videoRoute } from "@/routes/api/compete/video/submit"
import { saveBenchmarkScoreInTransaction } from "@/server/benchmark-submissions"
import * as handlers from "@/server/commerce/transfer-handlers"
import { decideCompetitionResult } from "@/server/competition-results/decision"
import * as registrationLock from "@/server/competition-results/registration-lock"
import {
  insertManualSubmissionWorkoutResult,
  persistCompetitionResultInTransaction,
} from "@/server/competition-results/repository"
import { normalizeManualSubmissionWorkoutResult } from "@/server/competition-results/review"
import { recordCompetitionResultInTransaction } from "@/server/competition-results/service"
import { acceptPurchaseTransferFn } from "@/server-fns/purchase-transfer-accept-fns"
import { cancelPurchaseTransferFn } from "@/server-fns/purchase-transfer-fns"
import { transferRegistrationDivisionFn } from "@/server-fns/registration-fns"
import { submitVideoFn } from "@/server-fns/video-submission-fns"
import * as startWaivers from "@/server-fns/waiver-fns"
import { getSessionFromCookie } from "@/utils/auth"
import * as crewWaivers from "../../../crew/src/server-fns/waiver-fns"

const accept = acceptPurchaseTransferFn as unknown as (input: {
  data: {
    transferId: string
    answers?: Array<{ questionId: string; answer: string }>
    waiverSignatures?: Array<{ waiverId: string; signatureName: string }>
  }
}) => Promise<{ success: boolean; competitionSlug: string | null }>
const cancel = cancelPurchaseTransferFn as unknown as (input: {
  data: { transferId: string }
}) => Promise<{ success: boolean }>

// An explicitly supplied local MySQL endpoint enables this suite. It creates/drops only
// its own random database; it never reads application connection credentials.
const casing = new CasingCache("snake_case")
const databaseName = `transfer_test_${randomUUID().replaceAll("-", "")}`
const tables = [
  benchmarkBatteriesTable,
  benchmarkTestsTable,
  benchmarkTierThresholdsTable,
  videoSubmissionsTable,
  programmingTracksTable,
  trackWorkoutsTable,
  workouts,
  commerceProductTable,
  commercePurchaseTable,
  competitionsTable,
  purchaseTransfersTable,
  competitionRegistrationsTable,
  teamMembershipTable,
  competitionHeatAssignmentsTable,
  competitionRegistrationAnswersTable,
  waiverSignaturesTable,
  waiversTable,
  competitionEventsTable,
  scoresTable,
  scoreRoundsTable,
  scalingLevelsTable,
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

async function waitForTransferLock() {
  await vi.waitFor(async () => {
    const [waiting] = await admin
      .promise()
      .query<RowDataPacket[]>(
        "SELECT 1 FROM performance_schema.data_lock_waits AS waits JOIN performance_schema.data_locks AS locks ON locks.ENGINE_LOCK_ID = waits.REQUESTING_ENGINE_LOCK_ID WHERE locks.OBJECT_SCHEMA = ?",
        [databaseName],
      )
    expect(waiting.length).toBeGreaterThan(0)
  })
}

function deferred() {
  let resolve = () => {}
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

// Pause only after the REAL handler's database writes. This exposes uncommitted
// state to a competing operation without replacing the handler with a mock.
function pauseAfterHandler() {
  const entered = deferred()
  const release = deferred()
  const original = handlers.handleCompetitionRegistrationTransfer
  vi.spyOn(
    handlers,
    "handleCompetitionRegistrationTransfer",
  ).mockImplementation(async (...args) => {
    await original(...args)
    entered.resolve()
    await release.promise
  })
  return { entered: entered.promise, release: release.resolve }
}

describe.skipIf(!mysqlTestConfig)(
  "purchase transfer MySQL transactions",
  () => {
    beforeAll(async () => {
      if (!mysqlTestConfig) throw new Error("Missing MySQL test configuration")
      admin = mysql.createPool(mysqlTestConfig)
      await admin.promise().query(`CREATE DATABASE \`${databaseName}\``)
      pool = mysql.createPool({
        ...mysqlTestConfig,
        database: databaseName,
        connectionLimit: 5,
      })
      fixture.db = createWodsmithDb(pool)
      // Use real schema column names/types with InnoDB row locking. Unrelated
      // required fields are nullable so this fixture needs no production seed data.
      for (const table of tables) {
        const columns = Object.values(getTableColumns(table)).map(
          (column) =>
            `\`${casing.getColumnCasing(column)}\` ${column.getSQLType()} ${column.primary ? "PRIMARY KEY" : "NULL"}`,
        )
        await pool
          .promise()
          .query(
            `CREATE TABLE \`${getTableName(table)}\` (${columns.join(",")}) ENGINE=InnoDB`,
          )
      }
      await pool
        .promise()
        .query(
          `ALTER TABLE \`${getTableName(competitionRegistrationsTable)}\` ADD UNIQUE INDEX competition_registrations_event_user_division_idx (event_id, user_id, division_id)`,
        )
      await pool
        .promise()
        .query(
          "ALTER TABLE waiver_signatures ADD UNIQUE INDEX waiver_user (waiver_id, user_id)",
        )
    }, 20_000)

    afterAll(async () => {
      if (pool) await pool.promise().end()
      if (admin) {
        await admin
          .promise()
          .query(`DROP DATABASE IF EXISTS \`${databaseName}\``)
        await admin.promise().end()
      }
    })

    beforeEach(async () => {
      for (const table of tables)
        await pool.promise().query(`DELETE FROM \`${getTableName(table)}\``)
      await insert(commerceProductTable, {
        id: "product",
        type: "COMPETITION_REGISTRATION",
      })
      await insert(commercePurchaseTable, {
        id: "purchase",
        userId: "original-payer",
        productId: "product",
        competitionId: "competition",
        divisionId: "division",
      })
      await insert(competitionsTable, {
        id: "competition",
        slug: "test-competition",
        organizingTeamId: "organizer",
        competitionTeamId: "event-team",
      })
      await insert(purchaseTransfersTable, {
        id: "transfer",
        purchaseId: "purchase",
        sourceUserId: "source",
        targetEmail: "target@example.com",
        transferState: "INITIATED",
        expiresAt: new Date(Date.now() + 60_000),
      })
      await insert(competitionRegistrationsTable, {
        id: "registration",
        userId: "source",
        captainUserId: "source",
        eventId: "competition",
        divisionId: "division",
        status: "active",
        commercePurchaseId: "purchase",
        teamMemberId: "membership",
      })
      await insert(teamMembershipTable, {
        id: "membership",
        teamId: "event-team",
        userId: "source",
        isActive: true,
        roleId: "member",
        isSystemRole: true,
      })
      await insert(competitionHeatAssignmentsTable, {
        id: "heat-assignment",
        registrationId: "registration",
      })
      await insert(competitionRegistrationAnswersTable, {
        id: "old-answer",
        registrationId: "registration",
        userId: "source",
        questionId: "question",
        answer: "Old answer",
      })
      await insert(waiverSignaturesTable, {
        id: "old-waiver",
        registrationId: "registration",
        userId: "source",
        waiverId: "waiver",
      })
      await insert(waiversTable, {
        id: "waiver",
        competitionId: "competition",
        required: false,
      })
      await insert(competitionEventsTable, {
        id: "event",
        trackWorkoutId: "track-workout",
        competitionId: "competition",
      })
      await insert(scoresTable, {
        id: "source-score",
        competitionEventId: "track-workout",
        scalingLevelId: "division",
        userId: "source",
      })
    })

    // @lat: [[commerce#Purchase Transfers#Atomic acceptance rollback]]
    it("rolls back actual handler writes when a late waiver insert fails and permits retry", async () => {
      const before = await snapshot()
      await pool
        .promise()
        .query(
          `CREATE TRIGGER reject_waiver BEFORE INSERT ON \`${getTableName(waiverSignaturesTable)}\` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixture waiver failure'`,
        )
      try {
        await expect(
          accept({
            data: {
              transferId: "transfer",
              answers: [{ questionId: "question", answer: "New answer" }],
              waiverSignatures: [
                { waiverId: "waiver", signatureName: "Target Athlete" },
              ],
            },
          }),
        ).rejects.toThrow("fixture waiver failure")
        expect(await snapshot()).toEqual(before)
      } finally {
        await pool.promise().query("DROP TRIGGER reject_waiver")
      }
      await expect(
        accept({ data: { transferId: "transfer" } }),
      ).resolves.toMatchObject({ success: true })
    })

    // @lat: [[commerce#Purchase Transfers#Inactive recipient registration rollback]]
    it("restores an inactive recipient registration on rollback and replaces it on retry", async () => {
      const inactiveRegistration = {
        id: "inactive-registration",
        userId: "target",
        captainUserId: "target",
        eventId: "competition",
        divisionId: "division",
        status: "removed",
      }
      await insert(competitionRegistrationsTable, inactiveRegistration)
      // Assert the fixture enforces the production constraint before exercising
      // the handler's delete-before-reassignment path.
      await expect(
        insert(competitionRegistrationsTable, {
          ...inactiveRegistration,
          id: "duplicate-registration",
        }),
      ).rejects.toThrow("Duplicate entry")
      const before = await snapshot()
      await pool
        .promise()
        .query(
          `CREATE TRIGGER reject_waiver BEFORE INSERT ON \`${getTableName(waiverSignaturesTable)}\` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixture waiver failure'`,
        )
      try {
        await expect(
          accept({
            data: {
              transferId: "transfer",
              waiverSignatures: [
                { waiverId: "waiver", signatureName: "Target Athlete" },
              ],
            },
          }),
        ).rejects.toThrow("fixture waiver failure")
        expect(await snapshot()).toEqual(before)
      } finally {
        await pool.promise().query("DROP TRIGGER reject_waiver")
      }
      const purchaseBefore = await rows(commercePurchaseTable)
      await expect(
        accept({ data: { transferId: "transfer" } }),
      ).resolves.toMatchObject({ success: true })
      expect(await rows(competitionRegistrationsTable)).toMatchObject([
        { id: "registration", user_id: "target", status: "active" },
      ])
      expect(await rows(commercePurchaseTable)).toEqual(purchaseBefore)
      expect(await rows(purchaseTransfersTable)).toMatchObject([
        { transfer_state: "COMPLETED" },
      ])
    })

    // @lat: [[commerce#Purchase Transfers#Individual and team acceptance]]
    it.each([false, true])(
      "commits individual/team transfer (team=%s) while preserving payer",
      async (team) => {
        if (team) {
          await pool
            .promise()
            .query(
              `UPDATE \`${getTableName(competitionRegistrationsTable)}\` SET athlete_team_id = 'athlete-team'`,
            )
          await insert(teamMembershipTable, {
            id: "captain",
            teamId: "athlete-team",
            userId: "source",
            isActive: true,
            roleId: "captain",
          })
          await insert(teamMembershipTable, {
            id: "partner",
            teamId: "athlete-team",
            userId: "partner",
            isActive: true,
            roleId: "member",
          })
        }
        const purchaseBefore = await rows(commercePurchaseTable)
        await expect(
          accept({
            data: {
              transferId: "transfer",
              answers: [{ questionId: "question", answer: "New answer" }],
              waiverSignatures: [
                { waiverId: "waiver", signatureName: "Target Athlete" },
              ],
            },
          }),
        ).resolves.toEqual({
          success: true,
          competitionSlug: "test-competition",
        })
        expect(await rows(commercePurchaseTable)).toEqual(purchaseBefore)
        expect(await rows(purchaseTransfersTable)).toMatchObject([
          { transfer_state: "COMPLETED", target_user_id: "target" },
        ])
        expect(await rows(competitionRegistrationsTable)).toMatchObject([
          { user_id: "target", captain_user_id: "target" },
        ])
        expect(await rows(competitionHeatAssignmentsTable)).toEqual([])
        expect(await rows(scoresTable)).toEqual([])
        expect(await rows(competitionRegistrationAnswersTable)).toMatchObject([
          { user_id: "target", answer: "New answer" },
        ])
        expect(await rows(waiverSignaturesTable)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ user_id: "source" }),
            expect.objectContaining({ user_id: "target" }),
          ]),
        )
        const memberships = await rows(teamMembershipTable)
        expect(memberships.find((m) => m.id === "membership")).toMatchObject({
          is_active: 0,
        })
        expect(memberships).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              user_id: "target",
              team_id: "event-team",
              is_active: 1,
            }),
          ]),
        )
        if (team) {
          expect(memberships.find((m) => m.id === "captain")).toMatchObject({
            is_active: 0,
          })
          expect(memberships.find((m) => m.id === "partner")).toMatchObject({
            is_active: 1,
          })
          expect(memberships).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                user_id: "target",
                team_id: "athlete-team",
                role_id: "captain",
                is_active: 1,
              }),
            ]),
          )
        }
      },
    )

    // @lat: [[transfer-integrity-tests#Transfer integrity#Exact score scope]]
    it.each([
      { divisionId: "division", trackWorkoutId: "track-workout" },
      { divisionId: null, trackWorkoutId: "track-workout" },
      { divisionId: "division", trackWorkoutId: "event" },
    ])(
      "preserves retained-division, other-athlete, and other-event scores ($divisionId, $trackWorkoutId)",
      async ({ divisionId, trackWorkoutId }) => {
        // Real storage uses track-workout IDs, which differ from competition-event IDs.
        await pool
          .promise()
          .query("UPDATE competition_events SET track_workout_id = ?", [
            trackWorkoutId,
          ])
        await pool
          .promise()
          .query("UPDATE competition_registrations SET division_id = ?", [
            divisionId,
          ])
        await pool.promise().query("DELETE FROM scores")
        const fixtures = [
          {
            id: "transferred-score",
            userId: "source",
            competitionEventId: trackWorkoutId,
            scalingLevelId: divisionId,
          },
          {
            id: "retained-score",
            userId: "source",
            competitionEventId: trackWorkoutId,
            scalingLevelId: "retained-division",
          },
          {
            id: "other-athlete",
            userId: "partner",
            competitionEventId: trackWorkoutId,
            scalingLevelId: divisionId,
          },
          {
            id: "other-event",
            userId: "source",
            competitionEventId: "other-track-workout",
            scalingLevelId: divisionId,
          },
          {
            id: "personal",
            userId: "source",
            competitionEventId: null,
            scalingLevelId: divisionId,
          },
        ]
        await insert(competitionRegistrationsTable, {
          id: "retained-registration",
          userId: "source",
          eventId: "competition",
          divisionId: "retained-division",
          status: "active",
        })
        for (const score of fixtures) await insert(scoresTable, score)
        await insert(scoreRoundsTable, {
          id: "transferred-round",
          scoreId: "transferred-score",
          roundNumber: 1,
          value: 100,
        })
        await insert(scoreRoundsTable, {
          id: "retained-round",
          scoreId: "retained-score",
          roundNumber: 1,
          value: 200,
        })
        const roundsBefore = await rows(scoreRoundsTable)
        const before = await rows(scoresTable)
        await expect(
          accept({ data: { transferId: "transfer" } }),
        ).resolves.toMatchObject({ success: true })
        expect(await rows(scoresTable)).toEqual(
          before.filter((score) => score.id !== "transferred-score"),
        )
        expect(await rows(scoreRoundsTable)).toEqual(
          roundsBefore.filter((round) => round.id !== "transferred-round"),
        )
        expect(
          (await rows(competitionRegistrationsTable)).find(
            (reg) => reg.id === "retained-registration",
          ),
        ).toMatchObject({
          user_id: "source",
          division_id: "retained-division",
          status: "active",
        })
      },
    )

    // @lat: [[transfer-integrity-tests#Transfer integrity#Scored division moves]]
    it.each([
      { scoredUser: "source", divisionId: "division", teamSize: 2 },
      { scoredUser: "partner", divisionId: "division", teamSize: 2 },
      { scoredUser: "source", divisionId: null, teamSize: 1 },
    ])(
      "blocks a division move with $scoredUser results in $divisionId and preserves every table",
      async ({ scoredUser, divisionId, teamSize }) => {
        await insert(scalingLevelsTable, { id: "division", teamSize })
        await insert(scalingLevelsTable, { id: "target-division", teamSize })
        await pool
          .promise()
          .query("UPDATE competition_registrations SET division_id = ?", [
            divisionId,
          ])
        await pool
          .promise()
          .query(
            "UPDATE competition_registrations SET athlete_team_id = 'athlete-team'",
          )
        await pool
          .promise()
          .query(
            "UPDATE competition_events SET track_workout_id = 'track-workout'",
          )
        await pool
          .promise()
          .query(
            "UPDATE scores SET competition_event_id = 'track-workout', scaling_level_id = ?, user_id = ?",
            [divisionId, scoredUser],
          )
        await insert(teamMembershipTable, {
          id: "partner",
          teamId: "athlete-team",
          userId: "partner",
          isActive: true,
        })
        const before = await snapshot()
        await expect(
          transferRegistrationDivisionFn({
            data: {
              registrationId: "registration",
              competitionId: "competition",
              targetDivisionId: "target-division",
            },
          }),
        ).rejects.toThrow("recorded results")
        expect(await snapshot()).toEqual(before)
      },
    )

    // @lat: [[transfer-integrity-tests#Transfer integrity#Unscored division moves]]
    it("allows an unscored move without modifying scores in a retained division", async () => {
      await insert(scalingLevelsTable, { id: "division", teamSize: 1 })
      await insert(scalingLevelsTable, { id: "target-division", teamSize: 1 })
      await pool
        .promise()
        .query(
          "UPDATE competition_events SET track_workout_id = 'track-workout'",
        )
      await pool
        .promise()
        .query(
          "UPDATE scores SET competition_event_id = 'track-workout', scaling_level_id = 'retained-division'",
        )
      await insert(scoresTable, {
        id: "other-athlete-score",
        userId: "unrelated",
        competitionEventId: "track-workout",
        scalingLevelId: "division",
      })
      await insert(scoresTable, {
        id: "other-event-score",
        userId: "source",
        competitionEventId: "other-track-workout",
        scalingLevelId: "division",
      })
      const scoresBefore = await rows(scoresTable)
      await expect(
        transferRegistrationDivisionFn({
          data: {
            registrationId: "registration",
            competitionId: "competition",
            targetDivisionId: "target-division",
          },
        }),
      ).resolves.toMatchObject({ success: true, removedHeatAssignments: 1 })
      expect(await rows(scoresTable)).toEqual(scoresBefore)
      expect(await rows(competitionRegistrationsTable)).toMatchObject([
        { division_id: "target-division" },
      ])
      expect(await rows(commercePurchaseTable)).toMatchObject([
        { division_id: "target-division" },
      ])
      expect(await rows(competitionHeatAssignmentsTable)).toEqual([])
    })

    // @lat: [[transfer-integrity-tests#Transfer integrity#Typed waiver signature]]
    it("persists the typed signature with the accepting user and registration without changing source audit", async () => {
      const sourceBefore = await rows(waiverSignaturesTable)
      await accept({
        data: {
          transferId: "transfer",
          waiverSignatures: [
            { waiverId: "waiver", signatureName: "  Taylor J. Athlete  " },
          ],
        },
      })
      const signatures = await rows(waiverSignaturesTable)
      expect(
        signatures.find((signature) => signature.user_id === "source"),
      ).toEqual(sourceBefore[0])
      expect(
        signatures.find((signature) => signature.user_id === "target"),
      ).toMatchObject({
        signature_name: "  Taylor J. Athlete  ",
        registration_id: "registration",
        signed_at: expect.any(Date),
      })
    })

    // @lat: [[transfer-integrity-tests#Transfer integrity#Waiver validation boundaries]]
    it.each([
      { waiverId: "waiver", signatureName: "   " },
      { waiverId: "waiver", signatureName: "x".repeat(256) },
      { waiverId: "foreign-waiver", signatureName: "Target Athlete" },
    ])(
      "rejects invalid or foreign waiver signatures before registration changes ($waiverId)",
      async (signature) => {
        await insert(waiversTable, {
          id: "foreign-waiver",
          competitionId: "other-competition",
          required: true,
        })
        const before = await snapshot()
        await expect(
          accept({
            data: { transferId: "transfer", waiverSignatures: [signature] },
          }),
        ).rejects.toThrow()
        expect(await snapshot()).toEqual(before)
      },
    )

    // @lat: [[transfer-integrity-tests#Transfer integrity#Required transfer waivers]]
    it("requires every required waiver even when the request bypasses the form", async () => {
      await pool.promise().query("UPDATE waivers SET required = true")
      const before = await snapshot()
      await expect(
        accept({ data: { transferId: "transfer" } }),
      ).rejects.toThrow("required waivers")
      expect(await snapshot()).toEqual(before)
    })

    // @lat: [[transfer-integrity-tests#Transfer integrity#Existing recipient acknowledgement]]
    it("updates an existing recipient acknowledgement without duplicating or altering source signatures", async () => {
      await insert(waiverSignaturesTable, {
        id: "prior-target-signature",
        waiverId: "waiver",
        userId: "target",
        signatureName: "Previous Name",
        ipAddress: "192.0.2.42",
        registrationId: "other-registration",
        signedAt: new Date("2025-01-01"),
      })
      await accept({
        data: {
          transferId: "transfer",
          waiverSignatures: [
            { waiverId: "waiver", signatureName: "Current Typed Name" },
          ],
        },
      })
      const signatures = await rows(waiverSignaturesTable)
      expect(signatures).toHaveLength(2)
      expect(
        signatures.find((signature) => signature.user_id === "target"),
      ).toMatchObject({
        id: "prior-target-signature",
        signature_name: "Current Typed Name",
        ip_address: "192.0.2.42",
        registration_id: "registration",
      })
      const after = await snapshot()
      await expect(
        accept({ data: { transferId: "transfer" } }),
      ).rejects.toThrow("already been accepted")
      expect(await snapshot()).toEqual(after)
    })

    // @lat: [[transfer-integrity-tests#Transfer integrity#Signature status privacy]]
    it.each([startWaivers, crewWaivers])(
      "does not expose typed names through public or registration status endpoints",
      async (endpoints) => {
        await accept({
          data: {
            transferId: "transfer",
            waiverSignatures: [
              { waiverId: "waiver", signatureName: "Private Typed Name" },
            ],
          },
        })
        const userStatus = await endpoints.getWaiverSignaturesForUserFn({
          data: { userId: "target", competitionId: "competition" },
        })
        expect(userStatus.signatures).toHaveLength(1)
        expect(userStatus.signatures[0]).toHaveProperty("signatureName", null)
        vi.mocked(getSessionFromCookie).mockResolvedValue({
          userId: "unrelated-user",
        } as Awaited<ReturnType<typeof getSessionFromCookie>>)
        const registrationStatus =
          await endpoints.getWaiverSignaturesForRegistrationFn({
            data: { registrationId: "registration" },
          })
        expect(registrationStatus.signatures).toHaveLength(2)
        for (const signature of registrationStatus.signatures)
          expect(signature).toHaveProperty("signatureName", null)
      },
    )

    // @lat: [[transfer-integrity-tests#Transfer integrity#Transfer registration ownership]]
    it("rejects a transfer whose registration no longer belongs to the source user", async () => {
      await pool
        .promise()
        .query("UPDATE competition_registrations SET user_id = 'other-user'")
      const before = await snapshot()
      await expect(
        accept({ data: { transferId: "transfer" } }),
      ).rejects.toThrow("no longer belongs")
      expect(await snapshot()).toEqual(before)
    })

    // @lat: [[transfer-integrity-tests#Transfer integrity#Signature migration compatibility]]
    it("applies the signature migration without changing legacy acknowledgements", async () => {
      const before = await rows(waiverSignaturesTable)
      await pool
        .promise()
        .query("ALTER TABLE waiver_signatures DROP COLUMN signature_name")
      const migration = await readFile(
        resolve(
          dirname(fileURLToPath(import.meta.url)),
          "../../../../packages/wodsmith-db/mysql-migrations/0007_transfer_signature_name.sql",
        ),
        "utf8",
      )
      await pool.promise().query(migration)
      expect(await rows(waiverSignaturesTable)).toEqual(before)
    })

    // @lat: [[transfer-integrity-tests#Transfer integrity#Concurrent score wins]]
    it.each([
      ["source", "division"],
      ["partner", "division"],
      ["source", null],
    ] as const)(
      "blocks division transfer when %s score in %s wins the registration lock",
      async (athleteUserId, divisionId) => {
        await pool.promise().query("DELETE FROM scores")
        if (divisionId !== null)
          await insert(scalingLevelsTable, { id: "division", teamSize: 2 })
        else
          await pool
            .promise()
            .query("UPDATE competition_registrations SET division_id = NULL")
        await insert(scalingLevelsTable, {
          id: "next",
          teamSize: divisionId === null ? 1 : 2,
        })
        await pool
          .promise()
          .query(
            "UPDATE competition_registrations SET athlete_team_id = 'athlete-team'",
          )
        await insert(teamMembershipTable, {
          id: "partner",
          teamId: "athlete-team",
          userId: "partner",
          isActive: true,
        })
        const entered = deferred(),
          release = deferred()
        const db = fixture.db!
        const writing = db.transaction(async (tx) => {
          await persistCompetitionResultInTransaction({
            db: tx,
            target: {
              athleteUserId,
              ownerTeamId: "organizer",
              workoutId: "workout",
              trackWorkoutId: "track-workout",
              divisionId,
            },
            revision: decideCompetitionResult(
              { score: "42", status: "scored" },
              {
                workoutId: "workout",
                scheme: "reps",
                scoreType: "max",
                roundsToScore: 1,
                timeCap: null,
                tiebreakScheme: null,
              },
            ),
            recordedAt: new Date(),
          })
          entered.resolve()
          await release.promise
        })
        await Promise.race([entered.promise, writing])
        const moving = transferRegistrationDivisionFn({
          data: {
            registrationId: "registration",
            competitionId: "competition",
            targetDivisionId: "next",
          },
        })
        const outcome = Promise.allSettled([writing, moving])
        try {
          await Promise.race([
            moving.catch(() => undefined),
            waitForTransferLock(),
          ])
        } finally {
          release.resolve()
        }
        expect(await outcome).toMatchObject([
          { status: "fulfilled" },
          {
            status: "rejected",
            reason: expect.objectContaining({
              message: expect.stringContaining("recorded results"),
            }),
          },
        ])
        expect(await rows(competitionRegistrationsTable)).toMatchObject([
          { division_id: divisionId },
        ])
        expect(await rows(scoresTable)).toMatchObject([
          {
            user_id: athleteUserId,
            scaling_level_id: divisionId,
            score_value: 42,
          },
        ])
      },
    )

    // @lat: [[transfer-integrity-tests#Transfer integrity#Concurrent division move wins]]
    it("rejects a stale score when division transfer wins the registration lock", async () => {
      await pool.promise().query("DELETE FROM scores")
      await insert(scalingLevelsTable, { id: "division", teamSize: 1 })
      await insert(scalingLevelsTable, { id: "next", teamSize: 1 })
      const entered = deferred(),
        release = deferred()
      const db = fixture.db!
      const transact = db.transaction.bind(db)
      vi.spyOn(db, "transaction").mockImplementation(((callback) =>
        transact(async (tx) => {
          const findScore = tx.query.scoresTable.findFirst.bind(
            tx.query.scoresTable,
          )
          vi.spyOn(tx.query.scoresTable, "findFirst").mockImplementation(
            (async (config) => {
              const result = await findScore(config)
              entered.resolve()
              await release.promise
              return result
            }) as typeof findScore,
          )
          return callback(tx)
        })) as Database["transaction"])
      const moving = transferRegistrationDivisionFn({
        data: {
          registrationId: "registration",
          competitionId: "competition",
          targetDivisionId: "next",
        },
      })
      await Promise.race([entered.promise, moving])
      const writing = transact((tx) =>
        persistCompetitionResultInTransaction({
          db: tx,
          target: {
            athleteUserId: "source",
            ownerTeamId: "organizer",
            workoutId: "workout",
            trackWorkoutId: "track-workout",
            divisionId: "division",
          },
          revision: decideCompetitionResult(
            { score: "42", status: "scored" },
            {
              workoutId: "workout",
              scheme: "reps",
              scoreType: "max",
              roundsToScore: 1,
              timeCap: null,
              tiebreakScheme: null,
            },
          ),
          recordedAt: new Date(),
        }),
      )
      const outcome = Promise.allSettled([moving, writing])
      try {
        await Promise.race([
          writing.catch(() => undefined),
          waitForTransferLock(),
        ])
      } finally {
        release.resolve()
      }
      expect(await outcome).toMatchObject([
        { status: "fulfilled" },
        {
          status: "rejected",
          reason: expect.objectContaining({
            message: expect.stringContaining("Registration changed"),
          }),
        },
      ])
      expect(await rows(competitionRegistrationsTable)).toMatchObject([
        { division_id: "next" },
      ])
      expect(await rows(scoresTable)).toEqual([])
    })

    // @lat: [[transfer-integrity-tests#Transfer integrity#Reused workout competition identity]]
    it.each([
      ["division", "source", "retained"],
      [null, "source", "retained"],
      ["division", "other-athlete", "division"],
    ] as const)(
      "binds a reused workout to %s while retaining %s in %s",
      async (divisionId, retainedUserId, retainedDivisionId) => {
        await pool.promise().query("DELETE FROM scores")
        await pool
          .promise()
          .query("UPDATE competition_registrations SET division_id = ?", [
            divisionId,
          ])
        await insert(competitionsTable, { id: "other-competition" })
        await insert(competitionEventsTable, {
          id: "a-event",
          competitionId: "other-competition",
          trackWorkoutId: "track-workout",
        })
        await insert(competitionRegistrationsTable, {
          id: "retained",
          eventId: "other-competition",
          userId: retainedUserId,
          divisionId: retainedDivisionId,
          status: "active",
        })
        await insert(scoresTable, {
          id: "retained-score",
          userId: retainedUserId,
          competitionEventId: "track-workout",
          scalingLevelId: retainedDivisionId,
          scoreValue: 99,
        })
        await insert(programmingTracksTable, {
          id: "track",
          ownerTeamId: "organizer",
        })
        await insert(workouts, {
          id: "workout",
          scheme: "reps",
          scoreType: "max",
          roundsToScore: 1,
        })
        await insert(trackWorkoutsTable, {
          id: "track-workout",
          trackId: "track",
          workoutId: "workout",
        })
        const retainedScore = await rows(scoresTable)
        const registrations = await rows(competitionRegistrationsTable)
        await fixture.db!.transaction((tx) =>
          recordCompetitionResultInTransaction({
            db: tx,
            command: {
              competitionId: "competition",
              athleteUserId: "source",
              trackWorkoutId: "track-workout",
              divisionScope: divisionId
                ? { kind: "division", divisionId }
                : { kind: "open" },
              claim: { score: "42", status: "scored" },
            },
          }),
        )
        expect(await rows(scoresTable)).toEqual(
          expect.arrayContaining(retainedScore),
        )
        expect(await rows(scoresTable)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              user_id: "source",
              scaling_level_id: divisionId,
              score_value: 42,
            }),
          ]),
        )
        expect(await rows(competitionRegistrationsTable)).toEqual(registrations)
      },
    )

    // @lat: [[transfer-integrity-tests#Transfer integrity#Ambiguous workout registration lock]]
    it("rejects ambiguous unbound workout participation without writes", async () => {
      await insert(competitionEventsTable, {
        id: "z-event",
        competitionId: "another-competition",
        trackWorkoutId: "track-workout",
      })
      const before = await snapshot()
      await expect(
        fixture.db!.transaction((tx) =>
          registrationLock.lockRegistrationForResult(tx, {
            athleteUserId: "source",
            trackWorkoutId: "track-workout",
            divisionId: "division",
          }),
        ),
      ).rejects.toThrow("Registration changed")
      expect(await snapshot()).toEqual(before)
    })

    // @lat: [[transfer-integrity-tests#Transfer integrity#Ambiguous shared score ownership]]
    it.each([
      ["division", "active"],
      [null, "active"],
      ["division", "removed"],
      [null, "inactive-member"],
      ["division", "transferred-owner"],
    ] as const)(
      "preserves every row when a %s result has %s competing ownership",
      async (divisionId, history) => {
        await pool
          .promise()
          .query("UPDATE competition_registrations SET division_id = ?", [
            divisionId,
          ])
        await pool
          .promise()
          .query("UPDATE scores SET scaling_level_id = ?", [divisionId])
        await insert(scoreRoundsTable, {
          id: "ambiguous-round",
          scoreId: "source-score",
          roundNumber: 1,
          value: 42,
        })
        await insert(videoSubmissionsTable, {
          id: "ambiguous-video",
          registrationId: "registration",
          trackWorkoutId: "track-workout",
          videoIndex: 0,
          userId: "source",
          videoUrl: "https://youtu.be/original",
        })
        await insert(competitionEventsTable, {
          id: "shared-event",
          competitionId: "other-competition",
          trackWorkoutId: "track-workout",
        })
        await insert(competitionRegistrationsTable, {
          id: "other-registration",
          eventId: "other-competition",
          userId:
            history === "inactive-member" || history === "transferred-owner"
              ? "another-owner"
              : "source",
          divisionId,
          status: history === "removed" ? "removed" : "active",
          athleteTeamId: history === "inactive-member" ? "old-team" : null,
          commercePurchaseId:
            history === "transferred-owner" ? "old-purchase" : null,
        })
        if (history === "inactive-member")
          await insert(teamMembershipTable, {
            id: "past-member",
            userId: "source",
            teamId: "old-team",
            isActive: false,
          })
        if (history === "transferred-owner")
          await insert(purchaseTransfersTable, {
            id: "past-transfer",
            purchaseId: "old-purchase",
            sourceUserId: "source",
            targetUserId: "another-owner",
            transferState: "COMPLETED",
          })
        const before = await snapshot()
        await expect(
          accept({ data: { transferId: "transfer" } }),
        ).rejects.toThrow("multiple competitions")
        expect(await snapshot()).toEqual(before)
        await expect(
          fixture.db!.transaction((tx) =>
            persistCompetitionResultInTransaction({
              db: tx,
              target: {
                competitionId: "competition",
                athleteUserId: "source",
                ownerTeamId: "organizer",
                workoutId: "workout",
                trackWorkoutId: "track-workout",
                divisionId,
              },
              revision: decideCompetitionResult(
                { score: "99", status: "scored" },
                {
                  workoutId: "workout",
                  scheme: "reps",
                  scoreType: "max",
                  roundsToScore: 1,
                  timeCap: null,
                  tiebreakScheme: null,
                },
              ),
              recordedAt: new Date(),
            }),
          ),
        ).rejects.toThrow("multiple competitions")
        expect(await snapshot()).toEqual(before)
      },
    )

    // @lat: [[transfer-integrity-tests#Transfer integrity#Concurrent ambiguous writers]]
    it.each(["division", null])(
      "rejects both concurrent competition writers for an ambiguous %s tuple",
      async (divisionId) => {
        await pool
          .promise()
          .query("UPDATE competition_registrations SET division_id = ?", [
            divisionId,
          ])
        await pool
          .promise()
          .query("UPDATE scores SET scaling_level_id = ?", [divisionId])
        await insert(competitionEventsTable, {
          id: "other-event",
          competitionId: "other-competition",
          trackWorkoutId: "track-workout",
        })
        await insert(competitionRegistrationsTable, {
          id: "other-registration",
          eventId: "other-competition",
          userId: "source",
          divisionId,
          status: "active",
        })
        const before = await snapshot()
        const write = (competitionId: string) =>
          fixture.db!.transaction((tx) =>
            persistCompetitionResultInTransaction({
              db: tx,
              target: {
                competitionId,
                athleteUserId: "source",
                ownerTeamId: "organizer",
                workoutId: "workout",
                trackWorkoutId: "track-workout",
                divisionId,
              },
              revision: decideCompetitionResult(
                { score: "99", status: "scored" },
                {
                  workoutId: "workout",
                  scheme: "reps",
                  scoreType: "max",
                  roundsToScore: 1,
                  timeCap: null,
                  tiebreakScheme: null,
                },
              ),
              recordedAt: new Date(),
            }),
          )
        const results = await Promise.allSettled([
          write("competition"),
          write("other-competition"),
        ])
        expect(results).toMatchObject([
          {
            status: "rejected",
            reason: expect.objectContaining({
              message: expect.stringContaining("multiple competitions"),
            }),
          },
          {
            status: "rejected",
            reason: expect.objectContaining({
              message: expect.stringContaining("multiple competitions"),
            }),
          },
        ])
        expect(await snapshot()).toEqual(before)
      },
    )

    // @lat: [[transfer-integrity-tests#Transfer integrity#Concurrent first video submissions]]
    it.each(["API", "legacy"])(
      "serializes concurrent first %s submissions into one slot and returns its current ID",
      async (writer) => {
        await pool.promise().query("DELETE FROM scores")
        await pool
          .promise()
          .query("UPDATE competitions SET competition_type = 'online'")
        await insert(programmingTracksTable, {
          id: "track",
          ownerTeamId: "organizer",
        })
        await insert(workouts, {
          id: "workout",
          scheme: "reps",
          scoreType: "max",
          roundsToScore: 1,
        })
        await insert(trackWorkoutsTable, {
          id: "track-workout",
          trackId: "track",
          workoutId: "workout",
        })
        await pool
          .promise()
          .query(
            "ALTER TABLE video_submissions ALTER COLUMN video_index SET DEFAULT 0",
          )
        await pool
          .promise()
          .query(
            "ALTER TABLE scores ADD UNIQUE INDEX fixture_score_key (competition_event_id, user_id, scaling_level_id)",
          )
        await pool
          .promise()
          .query(
            "ALTER TABLE video_submissions ADD UNIQUE INDEX fixture_video_slot (registration_id, track_workout_id, video_index)",
          )
        const entered = deferred(),
          release = deferred()
        const originalLock = registrationLock.lockRegistrationForResult
        vi.spyOn(
          registrationLock,
          "lockRegistrationForResult",
        ).mockImplementationOnce(async (...args) => {
          await originalLock(...args)
          entered.resolve()
          await release.promise
        })
        const post = (
          videoRoute as unknown as {
            server: {
              handlers: {
                POST: (arg: { request: Request }) => Promise<Response>
              }
            }
          }
        ).server.handlers.POST
        const request = (score: string) =>
          new Request("https://test.example/api/compete/video/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              competitionId: "competition",
              trackWorkoutId: "track-workout",
              divisionId: "division",
              videoUrl: "https://youtu.be/" + score,
              score,
              scoreStatus: "scored",
            }),
          })
        vi.mocked(getSessionFromCookie).mockResolvedValue({
          userId: "source",
        } as Awaited<ReturnType<typeof getSessionFromCookie>>)
        const write = async (score: string) => {
          if (writer === "API") return post({ request: request(score) })
          const result = await submitVideoFn({
            data: {
              competitionId: "competition",
              trackWorkoutId: "track-workout",
              divisionId: "division",
              videoUrl: "https://youtu.be/" + score,
              score,
              scoreStatus: "scored",
            },
          })
          return new Response(JSON.stringify(result))
        }
        try {
          const first = write("42")
          await Promise.race([entered.promise, first])
          const second = write("43")
          const responses = Promise.all([first, second])
          try {
            await Promise.race([second, waitForTransferLock()])
          } finally {
            release.resolve()
          }
          const result = await responses
          expect(result.map((r) => r.status)).toEqual([200, 200])
          const bodies = await Promise.all(result.map((r) => r.json()))
          expect(bodies[1]).toMatchObject({
            submissionId: (bodies[0] as { submissionId: string }).submissionId,
            isUpdate: true,
          })
          expect(await rows(videoSubmissionsTable)).toMatchObject([
            { video_url: "https://youtu.be/43" },
          ])
          expect(await rows(scoresTable)).toMatchObject([{ score_value: 43 }])
        } finally {
          release.resolve()
          await pool
            .promise()
            .query(
              "ALTER TABLE video_submissions DROP INDEX fixture_video_slot",
            )
          await pool
            .promise()
            .query("ALTER TABLE scores DROP INDEX fixture_score_key")
        }
      },
    )

    // @lat: [[transfer-integrity-tests#Transfer integrity#Stale submission snapshots]]
    it.each([
      "canonical",
      "manual",
      "benchmark",
      "video-only",
      "api-score",
      "api-video-only",
    ] as const)(
      "rejects %s after a division move despite a pre-lock transaction snapshot",
      async (writer) => {
        await pool.promise().query("DELETE FROM scores")
        await insert(scalingLevelsTable, { id: "division", teamSize: 2 })
        await insert(scalingLevelsTable, { id: "next", teamSize: 2 })
        await pool
          .promise()
          .query("UPDATE competitions SET competition_type = 'online'")
        await pool
          .promise()
          .query(
            "UPDATE competition_events SET submission_opens_at = ?, submission_closes_at = ?",
            [
              new Date(Date.now() - 60_000).toISOString(),
              new Date(Date.now() + 60_000),
            ],
          )
        await insert(programmingTracksTable, {
          id: "track",
          ownerTeamId: "organizer",
        })
        await insert(workouts, {
          id: "workout",
          scheme: "reps",
          scoreType: "max",
          roundsToScore: 1,
        })
        await insert(trackWorkoutsTable, {
          id: "track-workout",
          trackId: "track",
          workoutId: "workout",
        })
        await insert(benchmarkBatteriesTable, { id: "battery", maxTier: 1 })
        await insert(benchmarkTestsTable, {
          id: "test",
          batteryId: "battery",
          scoreModel: "single",
        })
        await insert(benchmarkTierThresholdsTable, {
          id: "threshold",
          testId: "test",
          variant: "male",
          tier: 1,
          thresholdValue: 10,
        })
        vi.mocked(getSessionFromCookie).mockResolvedValue({
          userId: "source",
        } as Awaited<ReturnType<typeof getSessionFromCookie>>)
        const db = fixture.db!
        const snapshotEntered = deferred(),
          releaseWriter = deferred()
        const moveEntered = deferred(),
          releaseMove = deferred()
        const originalLock = registrationLock.lockRegistrationForResult
        vi.spyOn(
          registrationLock,
          "lockRegistrationForResult",
        ).mockImplementationOnce(async (tx, target) => {
          // Force a real REPEATABLE READ snapshot before the winner changes division.
          await tx.select().from(competitionRegistrationsTable)
          snapshotEntered.resolve()
          await releaseWriter.promise
          return originalLock(tx, target)
        })
        const transact = db.transaction.bind(db)
        vi.spyOn(db, "transaction").mockImplementation(((callback) =>
          transact(async (tx) => {
            const findScore = tx.query.scoresTable.findFirst.bind(
              tx.query.scoresTable,
            )
            vi.spyOn(tx.query.scoresTable, "findFirst").mockImplementation(
              (async (config) => {
                const result = await findScore(config)
                moveEntered.resolve()
                await releaseMove.promise
                return result
              }) as typeof findScore,
            )
            return callback(tx)
          })) as Database["transaction"])
        const target = {
          athleteUserId: "source",
          ownerTeamId: "organizer",
          workoutId: "workout",
          trackWorkoutId: "track-workout",
          divisionId: "division",
        }
        const revision = decideCompetitionResult(
          { score: "42", status: "scored" },
          {
            workoutId: "workout",
            scheme: "reps",
            scoreType: "max",
            roundsToScore: 1,
            timeCap: null,
            tiebreakScheme: null,
          },
        )
        const write = async () => {
          if (writer === "canonical")
            return db.transaction((tx) =>
              persistCompetitionResultInTransaction({
                db: tx,
                target,
                revision,
                recordedAt: new Date(),
              }),
            )
          if (writer === "manual")
            return db.transaction((tx) =>
              insertManualSubmissionWorkoutResult({
                db: tx,
                target: {
                  userId: "source",
                  teamId: "organizer",
                  workoutId: "workout",
                  trackWorkoutId: "track-workout",
                  divisionId: "division",
                },
                result: normalizeManualSubmissionWorkoutResult({
                  score: "42",
                  workout: {
                    scheme: "reps",
                    scoreType: "max",
                    timeCapMs: null,
                    tiebreakScheme: null,
                    roundsToScore: 1,
                  },
                }),
                recordedAt: new Date(),
                context: {},
              }),
            )
          if (writer === "benchmark")
            return db.transaction((tx) =>
              saveBenchmarkScoreInTransaction({
                db: tx,
                context: {
                  batteryId: "battery",
                  testId: "test",
                  competitionId: "competition",
                  competitionTeamId: "event-team",
                  openDivisionId: "division",
                  openDivisionTeamSize: 1,
                  videoPolicy: "never",
                  isOpenJoin: true,
                  competitionStatus: "published",
                  competitionVisibility: "public",
                  batteryStatus: "published",
                },
                variant: "male",
                score: {
                  userId: "source",
                  teamId: "organizer",
                  workoutId: "workout",
                  competitionEventId: "track-workout",
                  scheme: "reps",
                  scoreType: "max",
                  scoreValue: 42,
                  status: "scored",
                  statusOrder: 0,
                  sortKey: null,
                  tiebreakScheme: null,
                  tiebreakValue: null,
                  timeCapMs: null,
                  secondaryValue: null,
                  recordedAt: new Date(),
                },
              }),
            )
          const body = {
            competitionId: "competition",
            trackWorkoutId: "track-workout",
            divisionId: "division",
            videoUrl: "https://youtu.be/example",
            videoIndex: 1,
          }
          if (writer === "video-only") return submitVideoFn({ data: body })
          const route = (writer === "api-score"
            ? scoreRoute
            : videoRoute) as unknown as {
            server: {
              handlers: {
                POST: (args: { request: Request }) => Promise<Response>
              }
            }
          }
          const response = await route.server.handlers.POST({
            request: new Request("https://test.example/api/compete/submit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                writer === "api-score"
                  ? { ...body, score: "42", status: "scored" }
                  : body,
              ),
            }),
          })
          if (!response.ok)
            throw new Error(
              ((await response.json()) as { error: string }).error,
            )
          return response
        }
        const writing = write()
        try {
          await Promise.race([snapshotEntered.promise, writing])
          const moving = transferRegistrationDivisionFn({
            data: {
              registrationId: "registration",
              competitionId: "competition",
              targetDivisionId: "next",
            },
          })
          const outcome = Promise.allSettled([moving, writing])
          await Promise.race([moveEntered.promise, moving])
          releaseWriter.resolve()
          try {
            await Promise.race([
              writing.catch(() => undefined),
              waitForTransferLock(),
            ])
          } finally {
            releaseMove.resolve()
          }
          expect(await outcome).toMatchObject([
            { status: "fulfilled" },
            {
              status: "rejected",
              reason: expect.objectContaining({
                message: expect.stringContaining("Registration changed"),
              }),
            },
          ])
          expect(await rows(competitionRegistrationsTable)).toMatchObject([
            { division_id: "next" },
          ])
          expect(await rows(scoresTable)).toEqual([])
          expect(await rows(scoreRoundsTable)).toEqual([])
          expect(await rows(videoSubmissionsTable)).toEqual([])
        } finally {
          releaseWriter.resolve()
          releaseMove.resolve()
        }
      },
    )

    // @lat: [[commerce#Purchase Transfers#Concurrent acceptance and cancellation]]
    it("allows only acceptance to commit when cancellation races an in-flight handler", async () => {
      const pause = pauseAfterHandler()
      const accepting = accept({ data: { transferId: "transfer" } })
      await Promise.race([pause.entered, accepting])
      const cancelling = cancel({ data: { transferId: "transfer" } })
      // A second connection must still see the pre-transfer registration.
      expect(await rows(competitionRegistrationsTable)).toMatchObject([
        { user_id: "source" },
      ])
      const outcome = Promise.allSettled([accepting, cancelling])
      try {
        await waitForTransferLock()
      } finally {
        pause.release()
      }
      const results = await outcome
      expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"])
      expect(await rows(purchaseTransfersTable)).toMatchObject([
        { transfer_state: "COMPLETED" },
      ])
      expect(await rows(competitionRegistrationsTable)).toMatchObject([
        { user_id: "target" },
      ])
    })

    // @lat: [[commerce#Purchase Transfers#Cancelled transfer has no side effects]]
    it("leaves all registration state untouched when cancellation wins", async () => {
      await cancel({ data: { transferId: "transfer" } })
      const before = await snapshot()
      await expect(
        accept({ data: { transferId: "transfer" } }),
      ).rejects.toThrow("cancelled")
      expect(await snapshot()).toEqual(before)
    })

    // @lat: [[commerce#Purchase Transfers#Cancellation lock ordering]]
    it("rechecks cancelled state after waiting for a cancellation row lock", async () => {
      const connection = await pool.promise().getConnection()
      const before = await snapshot()
      try {
        await connection.beginTransaction()
        // This is the cancellation endpoint's conditional state transition, kept
        // uncommitted to force the accepting connection to wait on its row lock.
        await connection.query(
          `UPDATE \`${getTableName(purchaseTransfersTable)}\` SET transfer_state = 'CANCELLED' WHERE id = 'transfer' AND transfer_state = 'INITIATED'`,
        )
        const accepting = accept({ data: { transferId: "transfer" } })
        const result = Promise.allSettled([accepting])
        await waitForTransferLock()
        await connection.commit()
        expect(await result).toMatchObject([
          {
            status: "rejected",
            reason: expect.objectContaining({
              message: "This transfer was cancelled by the organizer",
            }),
          },
        ])
        const after = await snapshot()
        // All tables except the explicit cancellation record remain identical.
        for (let i = 0; i < tables.length; i++) {
          if (tables[i] !== purchaseTransfersTable)
            expect(after[i]).toEqual(before[i])
        }
      } finally {
        await connection.rollback()
        connection.release()
      }
    })

    // @lat: [[commerce#Purchase Transfers#Concurrent acceptance commits once]]
    it("commits a simultaneous acceptance only once", async () => {
      const pause = pauseAfterHandler()
      const first = accept({ data: { transferId: "transfer" } })
      await Promise.race([pause.entered, first])
      const second = accept({ data: { transferId: "transfer" } })
      const outcome = Promise.allSettled([first, second])
      try {
        await waitForTransferLock()
      } finally {
        pause.release()
      }
      const results = await outcome
      expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"])
      const memberships = await rows(teamMembershipTable)
      expect(memberships.filter((m) => m.user_id === "target")).toHaveLength(1)
      expect(await rows(commercePurchaseTable)).toMatchObject([
        { user_id: "original-payer" },
      ])
    })
  },
)
