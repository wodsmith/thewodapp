import { FakeDrizzleDb } from "@repo/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { signInFn } from "@/server-fns/auth-fns"
import { createAndStoreSession } from "@/utils/auth"
import { verifyPassword } from "@/utils/password-hasher"

const db = new FakeDrizzleDb()
vi.mock("@/db", () => ({ getDb: () => db }))
vi.mock("@/utils/auth", () => ({ createAndStoreSession: vi.fn() }))
vi.mock("@/utils/password-hasher", () => ({ verifyPassword: vi.fn() }))
vi.mock("@tanstack/react-start", () => ({
  createServerOnlyFn: (fn: unknown) => fn,
  createServerFn: () => ({
    handler: (handler: unknown) => handler,
    inputValidator: (validate: (data: unknown) => unknown) => ({
      handler:
        (handler: (ctx: { data: unknown }) => unknown) =>
        (ctx: { data: unknown }) =>
          handler({ data: validate(ctx.data) }),
    }),
  }),
}))

describe("supported sign-in providers", () => {
  beforeEach(() => {
    db.reset()
    db.registerTable("userTable")
  })

  // @lat: [[auth-boundary-tests#Account boundary regressions#Legacy provider recovery]]
  it("uses the same password error for legacy Google-only accounts as any passwordless account", async () => {
    db.query.userTable.findFirst.mockResolvedValue({
      id: "usr_legacy",
      googleAccountId: "legacy-provider-id",
      passwordHash: null,
      emailVerified: new Date(),
    })
    await expect(
      signInFn({
        data: { email: "owned@example.com", password: "Password123" },
      }),
    ).rejects.toThrow("Invalid email or password")
    expect(createAndStoreSession).not.toHaveBeenCalled()
    expect(verifyPassword).not.toHaveBeenCalled()
  })

  // @lat: [[auth-boundary-tests#Account boundary regressions#Password sign-in preservation]]
  it("continues password sign-in for verified accounts with a legacy provider id", async () => {
    db.query.userTable.findFirst.mockResolvedValue({
      id: "usr_legacy",
      googleAccountId: "legacy-provider-id",
      passwordHash: "saved-hash",
      emailVerified: new Date(),
    })
    vi.mocked(verifyPassword).mockResolvedValue(true)
    await expect(
      signInFn({
        data: { email: "owned@example.com", password: "Password123" },
      }),
    ).resolves.toMatchObject({ success: true, userId: "usr_legacy" })
    expect(verifyPassword).toHaveBeenCalledWith({
      storedHash: "saved-hash",
      passwordAttempt: "Password123",
    })
    expect(vi.mocked(createAndStoreSession).mock.calls.at(-1)?.slice(0, 4)).toEqual([
      "usr_legacy",
      "password",
      undefined,
      expect.any(Number),
    ])
  })
})
