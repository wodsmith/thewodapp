import { beforeEach, it, expect, vi } from "vitest"
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  db: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
}))
vi.mock("@/db", () => ({
  getDb: mocks.db,
  env: {
    CROSSFIT_DAILY_IMPORT_WORKFLOW: { create: mocks.create, get: mocks.get },
  },
}))
vi.mock("@/utils/auth", () => ({ requireAdmin: mocks.admin }))
vi.mock("@/server/crossfit-import", () => ({
  getPublishedCrossFitDays: vi.fn(),
}))
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (schema: { parse: (value: unknown) => unknown }) => ({
      handler:
        (fn: (ctx: { data: unknown }) => unknown) => (ctx: { data: unknown }) =>
          fn({ data: schema.parse(ctx.data) }),
    }),
    handler: (fn: () => unknown) => fn,
  }),
}))
import {
  getCrossFitImportsFn,
  getCrossFitRunStatusFn,
  runCrossFitImportFn,
} from "@/server-fns/crossfit-import-fns"
beforeEach(() => {
  mocks.admin.mockRejectedValue(new Error("Admin required"))
})
it("authorizes administrator reads and both workflow mutations before accessing infrastructure", async () => {
  await expect(getCrossFitImportsFn()).rejects.toThrow("Admin required")
  await expect(
    getCrossFitRunStatusFn({ data: { id: "crossfit-admin-auth-test" } }),
  ).rejects.toThrow("Admin required")
  for (const mode of ["dry-run", "publish"] as const)
    await expect(
      runCrossFitImportFn({
        data: {
          sourceDate: "2026-09-06",
          mode,
          expectedSourceHash: "a".repeat(64),
        },
      }),
    ).rejects.toThrow("Admin required")
  expect(mocks.db).not.toHaveBeenCalled()
  expect(mocks.create).not.toHaveBeenCalled()
  expect(mocks.get).not.toHaveBeenCalled()
})
it("requires an expected preview hash even for an authorized manual publish", async () => {
  mocks.admin.mockResolvedValue({ userId: "admin" })
  await expect(
    runCrossFitImportFn({
      data: { sourceDate: "2026-09-06", mode: "publish" },
    }),
  ).rejects.toThrow("Preview this date")
  expect(mocks.create).not.toHaveBeenCalled()
})
