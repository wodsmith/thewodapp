import { afterEach, beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({
  setup: vi.fn(),
  connect: vi.fn(),
  execute: vi.fn(),
  end: vi.fn(),
}))
vi.mock("node:child_process", () => ({
  default: { execSync: mocks.setup },
  execSync: mocks.setup,
}))
vi.mock("mysql2/promise", () => ({
  default: { createConnection: mocks.connect },
}))
import globalSetup from "../../e2e/global-setup"
const columns = [
  "championship_competition_id",
  "email",
  "championship_division_id",
  "active_marker",
]
beforeEach(() => {
  vi.stubEnv("CI", "true")
  vi.stubEnv("CREW_E2E_DB_PREPARED", "1")
  vi.stubEnv(
    "DATABASE_URL",
    "mysql://root@127.0.0.1:33329/crew_ci_preparation_e2e",
  )
  mocks.connect.mockResolvedValue({ execute: mocks.execute, end: mocks.end })
  mocks.execute.mockResolvedValue([
    columns.map((columnName, index) => ({
      columnName,
      sequence: index + 1,
      nonUnique: 0,
      subPart: null,
    })),
  ])
})
afterEach(() => vi.unstubAllEnvs())

// @lat: [[crew#Prepared Crew CI skips duplicate provisioning]]
it("verifies prepared CI state without executing the provisioning or seed script", async () => {
  mocks.setup.mockImplementation(() => {
    throw new Error("Unexpected second provisioning command")
  })
  await expect(globalSetup()).resolves.toBeUndefined()
  expect(mocks.setup).not.toHaveBeenCalled()
  expect(mocks.execute).toHaveBeenCalledTimes(1)
  expect(mocks.end).toHaveBeenCalledTimes(1)
})

// @lat: [[crew#Ordinary Crew E2E setup remains available]]
it("retains the setup script when no preparation flag is present", async () => {
  vi.stubEnv("CI", undefined)
  vi.stubEnv("CREW_E2E_DB_PREPARED", undefined)
  await globalSetup()
  expect(mocks.setup).toHaveBeenCalledWith(
    "pnpm tsx scripts/setup-e2e-db.ts",
    expect.objectContaining({
      stdio: "inherit",
      env: expect.objectContaining({ NODE_ENV: "test" }),
    }),
  )
  expect(mocks.connect).not.toHaveBeenCalled()
})

// @lat: [[crew#Invalid prepared state never falls back to provisioning]]
it.each(["outside-ci", "missing-index", "invalid-flag"])(
  "rejects %s without invoking setup as fallback",
  async (failure) => {
    if (failure === "outside-ci") vi.stubEnv("CI", undefined)
    if (failure === "missing-index") mocks.execute.mockResolvedValue([[]])
    if (failure === "invalid-flag") vi.stubEnv("CREW_E2E_DB_PREPARED", "true")
    await expect(globalSetup()).rejects.toThrow(
      /only allowed in CI|missing the exact unique|must be 1/,
    )
    expect(mocks.setup).not.toHaveBeenCalled()
  },
)
