import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  execute: vi.fn(),
  end: vi.fn(),
}))
vi.mock("mysql2/promise", () => ({
  default: { createConnection: mocks.connect },
}))
import { verifyPreparedCrewDatabase } from "../../e2e/fixtures/prepared-database"
const databaseUrl = "mysql://root@127.0.0.1:33329/crew_ci_preparation_e2e"
const columns = [
  "championship_competition_id",
  "email",
  "championship_division_id",
  "active_marker",
]
const validRows = () =>
  columns.map((columnName, index) => ({
    columnName,
    sequence: index + 1,
    nonUnique: 0,
    subPart: null as number | null,
  }))
beforeEach(() => {
  mocks.connect.mockResolvedValue({ execute: mocks.execute, end: mocks.end })
  mocks.execute.mockResolvedValue([validRows()])
})

// @lat: [[crew#Prepared Crew database requires isolated CI context]]
it.each([
  [databaseUrl, undefined],
  [databaseUrl, "false"],
  [undefined, "true"],
  ["not-a-url", "true"],
  ["mysql://root@db.example.com/crew_e2e", "true"],
  ["mysql://root@127.0.0.1/production", "true"],
  ["postgres://root@127.0.0.1/crew_e2e", "true"],
  ["mysql://root@127.0.0.1/crew_e2e?socketPath=/tmp/other", "true"],
  ["mysql://root@127.0.0.1/crew_e2e#other", "true"],
])(
  "rejects unsafe prepared context %s / CI=%s before connecting",
  async (url, ci) => {
    await expect(verifyPreparedCrewDatabase(url, ci)).rejects.toThrow(
      /only allowed in CI|local MySQL/,
    )
    expect(mocks.connect).not.toHaveBeenCalled()
  },
)

// @lat: [[crew#Prepared Crew verifies exact unique index shape]]
it.each(["missing", "nonunique", "reordered", "prefix", "extra", "sequence"])(
  "rejects a %s index and closes the read-only connection",
  async (change) => {
    const rows = validRows()
    if (change === "missing") rows.length = 0
    if (change === "nonunique") rows[0].nonUnique = 1
    if (change === "reordered")
      [rows[0].columnName, rows[1].columnName] = [
        rows[1].columnName,
        rows[0].columnName,
      ]
    if (change === "prefix") rows[1].subPart = 20
    if (change === "extra") rows.push({ ...rows[0], sequence: 5 })
    if (change === "sequence") rows[0].sequence = 2
    mocks.execute.mockResolvedValue([rows])
    await expect(
      verifyPreparedCrewDatabase(databaseUrl, "true"),
    ).rejects.toThrow("missing the exact unique")
    expect(mocks.execute).toHaveBeenCalledTimes(1)
    expect(mocks.end).toHaveBeenCalledTimes(1)
  },
)

// @lat: [[crew#Prepared Crew verification uses read-only parameterized metadata]]
it("accepts the exact index using one ordered metadata read and closes the connection", async () => {
  await verifyPreparedCrewDatabase(databaseUrl, "true")
  expect(mocks.connect).toHaveBeenCalledWith(
    expect.objectContaining({
      host: "127.0.0.1",
      port: 33329,
      database: "crew_ci_preparation_e2e",
      connectTimeout: 5000,
    }),
  )
  expect(mocks.execute).toHaveBeenCalledTimes(1)
  const [sql, parameters] = mocks.execute.mock.calls[0]
  expect(sql.trim()).toMatch(/^SELECT /)
  expect(sql).toContain("ORDER BY SEQ_IN_INDEX")
  expect(sql).not.toMatch(/CREATE|ALTER|INSERT|UPDATE|DELETE|TRUNCATE/i)
  expect(parameters).toEqual([
    "crew_ci_preparation_e2e",
    "competition_invites",
    "competition_invites_active_invite_idx",
  ])
  expect(mocks.end).toHaveBeenCalledTimes(1)
})

// @lat: [[crew#Prepared Crew read failures close connections]]
it("closes its connection when metadata reading fails", async () => {
  mocks.execute.mockRejectedValue(new Error("Read interrupted"))
  await expect(verifyPreparedCrewDatabase(databaseUrl, "true")).rejects.toThrow(
    "Read interrupted",
  )
  expect(mocks.end).toHaveBeenCalledTimes(1)
})
