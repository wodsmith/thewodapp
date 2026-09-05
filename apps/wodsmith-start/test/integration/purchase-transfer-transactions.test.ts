import { randomUUID } from "node:crypto"
import { createWodsmithDb } from "@repo/wodsmith-db/mysql"
import { getTableColumns, getTableName } from "drizzle-orm"
import { CasingCache } from "drizzle-orm/casing"
import { mysqlTestConfig } from "./mysql-test-config"
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
  commerceProductTable,
  commercePurchaseTable,
  competitionEventsTable,
  competitionHeatAssignmentsTable,
  competitionRegistrationAnswersTable,
  competitionRegistrationsTable,
  competitionsTable,
  purchaseTransfersTable,
  scoresTable,
  teamMembershipTable,
  waiverSignaturesTable,
} from "@/db/schema"

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
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({ handler: (fn: unknown) => fn }),
    handler: (fn: unknown) => fn,
  }),
  createServerOnlyFn: (fn: unknown) => fn,
}))

import { acceptPurchaseTransferFn } from "@/server-fns/purchase-transfer-accept-fns"
import { cancelPurchaseTransferFn } from "@/server-fns/purchase-transfer-fns"
import * as handlers from "@/server/commerce/transfer-handlers"

const accept = acceptPurchaseTransferFn as unknown as (input: {
  data: {
    transferId: string
    answers?: Array<{ questionId: string; answer: string }>
    waiverSignatures?: Array<{ waiverId: string }>
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
  commerceProductTable,
  commercePurchaseTable,
  competitionsTable,
  purchaseTransfersTable,
  competitionRegistrationsTable,
  teamMembershipTable,
  competitionHeatAssignmentsTable,
  competitionRegistrationAnswersTable,
  waiverSignaturesTable,
  competitionEventsTable,
  scoresTable,
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
      await insert(competitionEventsTable, {
        id: "event",
        competitionId: "competition",
      })
      await insert(scoresTable, {
        id: "source-score",
        competitionEventId: "event",
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
              waiverSignatures: [{ waiverId: "waiver" }],
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
              waiverSignatures: [{ waiverId: "waiver" }],
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
              waiverSignatures: [{ waiverId: "waiver" }],
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
